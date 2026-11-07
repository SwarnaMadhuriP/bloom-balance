
import uuid

from pydantic import BaseModel, Field


class SurplusPurchaseCreate(BaseModel):
    buyer_organization_id: uuid.UUID
    quantity: int = Field(gt=0)
