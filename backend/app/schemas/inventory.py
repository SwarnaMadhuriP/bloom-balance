
import uuid

from pydantic import BaseModel, Field


class InventoryReceiveRequest(BaseModel):
    batch_id: uuid.UUID
    location_id: uuid.UUID
    quantity: int = Field(gt=0)
