from pydantic import BaseModel
from typing import Optional

class StockAdjust(BaseModel):
    delta: int
    reason: Optional[str] = None
