
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SurplusListingCreate(BaseModel):
    batch_id: uuid.UUID
    grower_organization_id: uuid.UUID
    listed_quantity: int = Field(gt=0)
    price_per_unit: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    expires_at: datetime


class SurplusListingResponse(SurplusListingCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    remaining_quantity: int
    status: str
    created_at: datetime
