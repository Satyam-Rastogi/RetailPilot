from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StockAdjust(BaseModel):
    delta: int
    reason: Optional[str] = None

class StockAuditResponse(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str] = None
    delta: int
    delta_after: int
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
