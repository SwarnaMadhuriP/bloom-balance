
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FlowerBatchCreate(BaseModel):
    flower_id: uuid.UUID
    grower_organization_id: uuid.UUID
    harvest_date: date
    expiry_date: date
    initial_quantity: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expiry_date < self.harvest_date:
            raise ValueError(
                "Expiry date cannot be before harvest date"
            )
        return self


class FlowerBatchResponse(FlowerBatchCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
