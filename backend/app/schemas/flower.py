
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FlowerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    variety: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=50)
    unit: Literal["stem", "bunch", "kg"] = "stem"


class FlowerResponse(FlowerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
