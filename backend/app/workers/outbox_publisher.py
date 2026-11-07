
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

TOPIC = "bloombalance.orders"

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

        for event in events:
            try:
                delivery = {"error": None, "acknowledged": False}

                def delivery_callback(error, message):
                    delivery["error"] = error
                    delivery["acknowledged"] = error is None

                message = {
                    **event.payload,
                    "event_id": str(event.id),
                }

                producer.produce(
                    topic=TOPIC,
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
                        f"Kafka delivery failed: {delivery['error']}"
                    )

                event.status = "PUBLISHED"
                event.published_at = datetime.now(timezone.utc)

                db.commit()
                logger.info("Published event %s", event.id)

            except Exception:
                db.rollback()
                logger.exception(
                    "Failed to publish event %s", event.id
                )


if __name__ == "__main__":
    while True:
        publish_pending_events()
        time.sleep(5)
