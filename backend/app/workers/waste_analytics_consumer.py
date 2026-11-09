
import json
import logging
import os
import time
import uuid
from datetime import date

from confluent_kafka import Consumer, Producer, KafkaException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import OperationalError

from app.database import SessionLocal
from app.models.processed_event import ProcessedEvent
from app.models.waste_analytics import WasteAnalytics

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

TOPIC = "bloombalance.inventory.waste"
DLQ_TOPIC = "bloombalance.inventory.waste.dlq"
GROUP_ID = "bloombalance-waste-analytics"

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


def process_event(event):
    if not isinstance(event, dict):
        raise ValueError("Event must be a JSON object")

    if event.get("event_type") != "InventoryWasteRecorded":
        raise ValueError("Unexpected event type")

    event_id = uuid.UUID(event["event_id"])
    organization_id = uuid.UUID(event["organization_id"])
    quantity = int(event["quantity"])

    if quantity <= 0:
        raise ValueError("Waste quantity must be positive")

    waste_date = date.today()

    with SessionLocal() as db:
        try:
            claim = (
                insert(ProcessedEvent)
                .values(
                    consumer_group=GROUP_ID,
                    event_id=event_id,
                )
                .on_conflict_do_nothing(
                    constraint="uq_processed_event_group_event"
                )
                .returning(ProcessedEvent.id)
            )

            claimed_id = db.scalar(claim)

            if claimed_id is None:
                logger.info("Duplicate event %s. Skipping.", event_id)
                db.commit()
                return

            stmt = (
                insert(WasteAnalytics)
                .values(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    waste_date=waste_date,
                    total_quantity=quantity,
                )
                .on_conflict_do_update(
                    constraint="uq_waste_analytics_org_date",
                    set_={
                        "total_quantity":
                            WasteAnalytics.total_quantity + quantity
                    },
                )
            )

            db.execute(stmt)
            db.commit()
            logger.info("Processed waste event %s", event_id)

        except Exception:
            db.rollback()
            raise



def publish_to_dlq(producer, message, error):
    payload = {
        "original_topic": message.topic(),
        "partition": message.partition(),
        "offset": message.offset(),
        "error": str(error),
        "original_value": message.value().decode(
            "utf-8", errors="replace"
        ),
    }

    delivery = {
        "acknowledged": False,
        "error": None,
    }

    def delivery_callback(err, msg):
        if err is not None:
            delivery["error"] = err
        else:
            delivery["acknowledged"] = True

    producer.produce(
        DLQ_TOPIC,
        key=message.key(),
        value=json.dumps(payload).encode("utf-8"),
        on_delivery=delivery_callback,
    )

    remaining = producer.flush(timeout=10)

    if (
        remaining > 0
        or delivery["error"] is not None
        or not delivery["acknowledged"]
    ):
        raise RuntimeError(
            "DLQ delivery was not acknowledged by Kafka"
        )

    logger.warning(
        "Message sent to DLQ: partition=%s offset=%s",
        message.partition(),
        message.offset(),
    )


def start_consumer():
    consumer = Consumer({
        "bootstrap.servers": os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
        ),
        "group.id": GROUP_ID,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })

    producer = Producer({
        "bootstrap.servers": os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
        ),
        "enable.idempotence": True,
        "acks": "all",
    })

    consumer.subscribe([TOPIC])
    logger.info("Waste analytics consumer started")

    try:
        while True:
            message = consumer.poll(timeout=1.0)

            if message is None:
                continue

            if message.error():
                raise KafkaException(message.error())

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    event = json.loads(message.value().decode("utf-8"))
                    process_event(event)

                    consumer.commit(
                        message=message,
                        asynchronous=False,
                    )
                    break

                except (ValueError, KeyError, TypeError) as exc:
                    # Invalid payload: retrying won't fix it.
                    publish_to_dlq(producer, message, exc)
                    consumer.commit(
                        message=message,
                        asynchronous=False,
                    )
                    break

                except OperationalError:
                    logger.exception(
                        "Temporary database failure, attempt %s/%s",
                        attempt, MAX_RETRIES,
                    )

                    if attempt == MAX_RETRIES:
                        # Don't DLQ temporary infrastructure failures.
                        # Stop without committing so Kafka can redeliver.
                        raise

                    time.sleep(RETRY_DELAY_SECONDS)

                except Exception:
                    logger.exception(
                        "Unexpected processing failure; "
                        "offset will remain uncommitted"
                    )
                    raise

    finally:
        consumer.close()


if __name__ == "__main__":
    start_consumer()
