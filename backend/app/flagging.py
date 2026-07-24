"""heuristic code flagging for suspicious submissions, informational only"""

import re
from datetime import datetime

_DIACRITIC_PATTERN = re.compile(r"[ăîșțâĂÎȘȚÂ]")

# Unicode emoji ranges (covers the vast majority of emoji)
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001f600-\U0001f64f"
    "\U0001f300-\U0001f5ff"
    "\U0001f680-\U0001f6ff"
    "\U0001f1e0-\U0001f1ff"
    "\U00002600-\U000027bf"
    "\U0001f900-\U0001f9ff"
    "\U0001fa00-\U0001fa6f"
    "\U0001fa70-\U0001faff"
    "♀-♂"
    "☀-⭕"
    "‍"
    "⏏"
    "⏩"
    "⌚"
    "️"
    "〰"
    "]+",
    flags=re.UNICODE,
)

_IMPOSSIBLY_FAST_SECONDS = 10


def detect_flag(code: str, contest_start: datetime | None, submitted_at: datetime) -> str | None:
    """return flag reason string when suspicious; heuristics checked in order, returns only first match"""
    if contest_start is not None:
        delta = (submitted_at - contest_start).total_seconds()
        if 0 <= delta < _IMPOSSIBLY_FAST_SECONDS:
            return "impossibly_fast"

    if _EMOJI_PATTERN.search(code):
        return "emoji"

    if _DIACRITIC_PATTERN.search(code):
        return "diacritics"

    return None
