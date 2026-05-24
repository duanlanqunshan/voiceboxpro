"""
SRT subtitle file parser.

Parses .srt files and yields cue entries with index, start/end timestamps, and text.
Non-destructive: does not modify timestamps, does not merge or split cues.
"""

import re
from dataclasses import dataclass
from typing import Iterator, List, Optional


@dataclass
class SRTEntry:
    """A single SRT cue entry."""

    index: int
    start_ms: int
    end_ms: int
    text: str

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


def _parse_timestamp(ts: str) -> int:
    """Convert SRT timestamp (HH:MM:SS,mmm) to milliseconds."""
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid timestamp format: {ts}")
    hours, minutes, seconds = parts
    sec_parts = seconds.split(".")
    sec = int(sec_parts[0])
    millis = int(sec_parts[1]) if len(sec_parts) > 1 else 0
    return int(hours) * 3600000 + int(minutes) * 60000 + sec * 1000 + millis


def _clean_text(text: str) -> str:
    """Non-destructive text clean: whitespace normalisation and zero-width removal only."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    lines = [line.strip() for line in text.split("\n")]
    return " ".join(line for line in lines if line)


# Pattern: index on its own line, then timestamp line, then text lines until blank
_TIMESTAMP_RE = re.compile(
    r"(\d{1,6})\s*\n(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n((?:.*\n?)*?)(?=\n\n|\n?$)",
    re.UNICODE,
)


def parse_srt(content: str) -> List[SRTEntry]:
    """Parse SRT file content and return a list of SRTEntry objects.

    Does NOT modify timestamps or text content.
    """
    entries: List[SRTEntry] = []

    content = content.replace("\ufeff", "")
    start = 0
    while True:
        match = _TIMESTAMP_RE.search(content, start)
        if not match:
            break
        idx = int(match.group(1))
        start_ms = _parse_timestamp(match.group(2))
        end_ms = _parse_timestamp(match.group(3))
        raw_text = match.group(4).rstrip("\n")

        if end_ms <= start_ms:
            start = match.end()
            continue

        text = _clean_text(raw_text)
        if not text:
            start = match.end()
            continue

        entries.append(SRTEntry(index=idx, start_ms=start_ms, end_ms=end_ms, text=text))
        start = match.end()

    return entries


def parse_srt_lines(lines: Iterator[str]) -> List[SRTEntry]:
    """Parse SRT from a line iterator (useful for streaming)."""
    return parse_srt("".join(lines))