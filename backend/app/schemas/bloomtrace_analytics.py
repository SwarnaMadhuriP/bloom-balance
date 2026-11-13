
import uuid
from datetime import date

from pydantic import BaseModel


class WasteByReason(BaseModel):
    reason: str
    unit: str
    quantity: int

class WasteByUnit(BaseModel):
    unit: str
    quantity: int


class BloomTraceSummaryResponse(BaseModel):
    organization_id: uuid.UUID
    total_wasted: int
    total_waste_records: int
    waste_by_reason: list[WasteByReason]
    waste_by_unit: list[WasteByUnit]


class WasteByFlowerResponse(BaseModel):
    flower_id: uuid.UUID
    flower_name: str
    variety: str
    unit: str
    total_wasted: int


class DailyWasteTrendResponse(BaseModel):
    date: date
    unit: str
    total_wasted: int
    record_count: int


class RescuedFlowersResponse(BaseModel):
    organization_id: uuid.UUID
    total_rescued: int
    delivered_surplus_orders: int
    rescued_by_unit: list[WasteByUnit]
