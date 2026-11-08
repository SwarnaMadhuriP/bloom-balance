
import uuid

from pydantic import BaseModel
from datetime import date



class WasteByReason(BaseModel):
    reason: str
    quantity: int


class BloomTraceSummaryResponse(BaseModel):
    organization_id: uuid.UUID
    total_wasted: int
    total_waste_records: int
    waste_by_reason: list[WasteByReason]


class WasteByFlowerResponse(BaseModel):
    flower_id: uuid.UUID
    flower_name: str
    variety: str
    unit: str
    total_wasted: int



class DailyWasteTrendResponse(BaseModel):
    date: date
    total_wasted: int
    record_count: int



class RescuedFlowersResponse(BaseModel):
    organization_id: uuid.UUID
    total_rescued: int
    delivered_surplus_orders: int
