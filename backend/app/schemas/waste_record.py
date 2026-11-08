
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


WasteReason = Literal[
    "WILTED",
    "DAMAGED",
    "EXPIRED",
    "UNSOLD",
    "OTHER",
]


class WasteRecordCreate(BaseModel):
    organization_id: uuid.UUID
    batch_id: uuid.UUID
    location_id: uuid.UUID
    quantity: int = Field(gt=0)
    reason: WasteReason


class WasteRecordResponse(WasteRecordCreate):
    id: uuid.UUID
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)
