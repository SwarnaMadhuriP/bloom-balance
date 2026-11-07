
import json
import logging
import os
import uuid

from confluent_kafka import Consumer, KafkaException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models.order import Order
from app.models.notification import Notification
from app.models.processed_event import ProcessedEvent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)

TOPIC = "bloombalance.orders"
GROUP_ID = "bloombalance-notifications"


def process_event(event):
    if event.get("event_type") != "OrderAccepted":
        return

    # Ignore legacy test events without an event_id.
    if not event.get("event_id"):
        logger.warning("Skipping event without event_id")
        return

    event_id = uuid.UUID(event["event_id"])
    order_id = uuid.UUID(event["order_id"])

    with SessionLocal() as db:
        try:
            # Atomically claim the event.
            stmt = (
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

            claimed_id = db.scalar(stmt)

            if claimed_id is None:
                logger.info(
                    "Duplicate event %s. Skipping.",
                    event_id,
                )
                db.commit()
                return

            order = db.scalar(
                select(Order).where(Order.id == order_id)
            )

            if order is None:
                raise ValueError(
                    f"Order {order_id} does not exist"
                )

            notification = Notification(
                organization_id=order.buyer_organization_id,
                order_id=order.id,
                event_id=event_id,
                notification_type="ORDER_ACCEPTED",
                message=(
                    f"Your order {order.id} has been accepted! "
                    "Your flowers are being prepared."
                ),
                status="UNREAD",
            )

            db.add(notification)

            # Both records commit together.
            db.commit()

            logger.info(
                "Notification created for order %s",
                order_id,
            )

        except Exception:
            db.rollback()
            raise


def start_consumer():
    consumer = Consumer({
        "bootstrap.servers": os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS",
            "kafka:9092",
        ),
        "group.id": GROUP_ID,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })

    consumer.subscribe([TOPIC])

    logger.info("Notification consumer started")

    try:
        while True:
            message = consumer.poll(timeout=1.0)

            if message is None:
                continue

            if message.error():
                raise KafkaException(message.error())

            try:
                event = json.loads(
                    message.value().decode("utf-8")
                )

                process_event(event)

                # Commit Kafka offset only after DB success.
                consumer.commit(
                    message=message,
                    asynchronous=False,
                )

                logger.info(
                    "Committed partition=%s offset=%s",
                    message.partition(),
                    message.offset(),
                )

            except Exception:
                logger.exception("Event processing failed")
                raise

    finally:
        consumer.close()


if __name__ == "__main__":
    start_consumer()
