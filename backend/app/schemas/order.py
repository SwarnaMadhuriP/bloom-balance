
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OrderItemCreate(BaseModel):
    flower_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(
        ge=0,
        max_digits=10,
        decimal_places=2,
    )


class OrderCreate(BaseModel):
    buyer_organization_id: uuid.UUID
    seller_organization_id: uuid.UUID
    items: list[OrderItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_organizations(self):
        if self.buyer_organization_id == self.seller_organization_id:
            raise ValueError(
                "Buyer and seller must be different organizations"
            )
        return self


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    flower_id: uuid.UUID
    quantity: int
    unit_price: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    buyer_organization_id: uuid.UUID
    seller_organization_id: uuid.UUID
    status: str
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemResponse]
