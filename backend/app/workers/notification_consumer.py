
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

NOTIFICATION_CONFIG = {
    "OrderAccepted": (
        "ORDER_ACCEPTED",
        "🌸 Your order has been accepted! "
        "The grower will begin preparing your flowers.",
    ),
    "OrderPreparing": (
        "ORDER_PREPARING",
        "💐 Your flowers are being prepared with care.",
    ),
    "OrderDispatched": (
        "ORDER_DISPATCHED",
        "🚚 Your flowers are on their way!",
    ),
    "OrderDelivered": (
        "ORDER_DELIVERED",
        "🎉 Your flowers have arrived!",
    ),
    "OrderCancelled": (
        "ORDER_CANCELLED",
        "Your flower order has been cancelled.",
    ),
}


def process_event(event):
    event_type = event.get("event_type")

    if event_type not in NOTIFICATION_CONFIG:
        return

    if not event.get("event_id"):
        logger.warning(
            "Skipping event without event_id"
        )
        return

    event_id = uuid.UUID(event["event_id"])
    order_id = uuid.UUID(event["order_id"])

    with SessionLocal() as db:
        try:
            claim_statement = (
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

            claimed_id = db.scalar(claim_statement)

            if claimed_id is None:
                logger.info(
                    "Duplicate event %s. Skipping.",
                    event_id,
                )
                db.commit()
                return

            order = db.scalar(
                select(Order).where(
                    Order.id == order_id
                )
            )

            if order is None:
                raise ValueError(
                    f"Order {order_id} does not exist"
                )

            notification_type, message = (
                NOTIFICATION_CONFIG[event_type]
            )

            notification = Notification(
                organization_id=order.buyer_organization_id,
                order_id=order.id,
                event_id=event_id,
                notification_type=notification_type,
                message=message,
                status="UNREAD",
            )

            db.add(notification)

            # Commit notification and processed-event
            # record in the same transaction.
            db.commit()

            logger.info(
                "Notification created: %s for order %s",
                notification_type,
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

                # Commit offset only after successful
                # database processing.
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
                logger.exception(
                    "Event processing failed"
                )
                raise

    finally:
        consumer.close()


if __name__ == "__main__":
    start_consumer()
