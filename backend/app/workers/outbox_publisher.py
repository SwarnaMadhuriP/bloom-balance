
import json
import logging
import os
import time
from datetime import datetime, timezone

from confluent_kafka import Producer
from sqlalchemy import select

from app.database import SessionLocal
from app.models.outbox_event import OutboxEvent


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


EVENT_TOPICS = {
    "OrderAccepted": "bloombalance.orders",
    "InventoryWasteRecorded": "bloombalance.inventory.waste",
}


producer = Producer({
    "bootstrap.servers": os.getenv(
        "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
    ),
    "enable.idempotence": True,
    "acks": "all",
})


def publish_pending_events():
    with SessionLocal() as db:
        events = db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.status == "PENDING")
            .order_by(OutboxEvent.created_at, OutboxEvent.id)
            .limit(10)
            .with_for_update(skip_locked=True)
        ).all()

        # Release the initial transaction before processing
        # individual events.
        event_ids = [event.id for event in events]
        db.rollback()

        for event_id in event_ids:
            with SessionLocal() as event_db:
                try:
                    event = event_db.scalar(
                        select(OutboxEvent)
                        .where(
                            OutboxEvent.id == event_id,
                            OutboxEvent.status == "PENDING",
                        )
                        .with_for_update(skip_locked=True)
                    )

                    if event is None:
                        event_db.rollback()
                        continue

                    topic = EVENT_TOPICS.get(event.event_type)

                    if topic is None:
                        logger.error(
                            "Unknown event type: %s",
                            event.event_type,
                        )
                        event_db.rollback()
                        continue

                    delivery = {
                        "error": None,
                        "acknowledged": False,
                    }

                    def delivery_callback(error, message):
                        delivery["error"] = error
                        delivery["acknowledged"] = error is None

                    message = {
                        **event.payload,
                        "event_id": str(event.id),
                    }

                    producer.produce(
                        topic=topic,
                        key=str(event.aggregate_id),
                        value=json.dumps(message).encode("utf-8"),
                        on_delivery=delivery_callback,
                    )

                    remaining = producer.flush(timeout=10)

                    if (
                        remaining != 0
                        or not delivery["acknowledged"]
                        or delivery["error"] is not None
                    ):
                        raise RuntimeError(
                            f"Kafka delivery failed: "
                            f"{delivery['error']}"
                        )

                    event.status = "PUBLISHED"
                    event.published_at = datetime.now(timezone.utc)

                    event_db.commit()

                    logger.info(
                        "Published event %s to %s",
                        event.id,
                        topic,
                    )

                except Exception:
                    event_db.rollback()
                    logger.exception(
                        "Failed to publish event %s",
                        event_id,
                    )


if __name__ == "__main__":
    while True:
        publish_pending_events()
        time.sleep(5)
