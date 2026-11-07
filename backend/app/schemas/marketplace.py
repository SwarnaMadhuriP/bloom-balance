
import uuid
from datetime import date

from pydantic import BaseModel, Field
from decimal import Decimal


class MarketplaceFlower(BaseModel):
    batch_id: uuid.UUID
    flower_id: uuid.UUID
    name: str
    variety: str
    color: str | None
    unit: str

    grower_organization_id: uuid.UUID
    grower_name: str

    available_quantity: int
    harvest_date: date
    expiry_date: date
    price_per_unit: Decimal


class MarketplaceResponse(BaseModel):
    flowers: list[MarketplaceFlower]
    total: int = Field(ge=0)
    limit: int
    offset: int
