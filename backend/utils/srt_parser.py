"""SRT subtitle file parser."""

import re
from dataclasses import dataclass
from typing import List


@dataclass
class SRTEntry:
    index: int
    start_ms: int
    end_ms: int
    text: str

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


def _parse_timestamp(ts: str) -> int:
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid timestamp: {ts}")
    hours, minutes, seconds = parts
    sec_parts = seconds.split(".")
    sec = int(sec_parts[0])
    millis = int(sec_parts[1]) if len(sec_parts) > 1 else 0
    return int(hours) * 3600000 + int(minutes) * 60000 + sec * 1000 + millis


def _clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    lines = [line.strip() for line in text.split("\n")]
    return " ".join(line for line in lines if line)


def parse_srt(content: str) -> List[SRTEntry]:
    entries: List[SRTEntry] = []
    content = content.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")
    
    # Split into blocks separated by blank lines
    blocks_raw = re.split(r"\n{2,}", content)
    
    for block in blocks_raw:
        block = block.strip()
        if not block:
            continue
        
        lines = block.split("\n")
        if len(lines) < 3:
            continue
        
        # Parse index
        try:
            idx = int(lines[0].strip())
        except ValueError:
            continue
        
        # Parse timestamp line
        ts_match = re.match(
            r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})",
            lines[1].strip(),
        )
        if not ts_match:
            continue
        
        try:
            start_ms = _parse_timestamp(ts_match.group(1))
            end_ms = _parse_timestamp(ts_match.group(2))
        except ValueError:
            continue
        
        # Extract text (remaining lines)
        text = _clean_text("\n".join(lines[2:]))
        if not text:
            continue
        
        if end_ms <= start_ms:
            continue
        
        entries.append(SRTEntry(index=idx, start_ms=start_ms, end_ms=end_ms, text=text))
    
    return entries
