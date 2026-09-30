from pydantic import BaseModel
from typing import Optional, List


class TenderTextIn(BaseModel):
    text: str
    family: Optional[str] = None


class ClauseIn(BaseModel):
    is_number: str
    part: Optional[str] = None


class BeforeAfterIn(BaseModel):
    tender_id: int
    original_text: str
    revised_text: str


class VerificationIn(BaseModel):
    tender_id: int
    record_id: str
    action: str  # accept / reject / modify / note
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    officer: Optional[str] = None

