#!/usr/bin/env python3

"""Validate paired-end FASTQ structure and mate synchronization."""

from __future__ import annotations

import argparse
import gzip
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, TextIO


class FastqValidationError(ValueError):
    """Raised when a FASTQ file or read pair is invalid."""


@contextmanager
def open_text(path: Path) -> Iterator[TextIO]:
    """Open plain-text or gzip-compressed sequence data."""
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8", newline="") as handle:
            yield handle
    else:
        with path.open("r", encoding="utf-8", newline="") as handle:
            yield handle


def normalized_read_id(header: str) -> str:
    """Return a mate-independent read identifier."""
    token = header[1:].split()[0]
    if token.endswith("/1") or token.endswith("/2"):
        token = token[:-2]
    return token


def read_record(handle: TextIO, path: Path, index: int) -> tuple[str, str] | None:
    """Read and validate one four-line FASTQ record."""
    header = handle.readline()
    if not header:
        return None

    sequence = handle.readline()
    separator = handle.readline()
    quality = handle.readline()

    if not sequence or not separator or not quality:
        raise FastqValidationError(
            f"{path}: incomplete FASTQ record at read {index}"
        )

    header = header.rstrip("\r\n")
    sequence = sequence.rstrip("\r\n")
    separator = separator.rstrip("\r\n")
    quality = quality.rstrip("\r\n")

    if not header.startswith("@"):
        raise FastqValidationError(
            f"{path}: read {index} header does not start with '@'"
        )
    if not separator.startswith("+"):
        raise FastqValidationError(
            f"{path}: read {index} separator does not start with '+'"
        )
    if not sequence:
        raise FastqValidationError(f"{path}: read {index} has an empty sequence")
    if len(sequence) != len(quality):
        raise FastqValidationError(
            f"{path}: read {index} sequence/quality lengths differ "
            f"({len(sequence)} != {len(quality)})"
        )

    return normalized_read_id(header), sequence


def validate_pairs(r1_path: Path, r2_path: Path) -> tuple[int, int]:
    """Validate two FASTQ files and return read-pair and base counts."""
    pair_count = 0
    total_bases = 0

    with open_text(r1_path) as r1_handle, open_text(r2_path) as r2_handle:
        while True:
            index = pair_count + 1
            r1_record = read_record(r1_handle, r1_path, index)
            r2_record = read_record(r2_handle, r2_path, index)

            if r1_record is None and r2_record is None:
                break
            if r1_record is None or r2_record is None:
                raise FastqValidationError(
                    "paired files contain different numbers of reads"
                )

            r1_id, r1_sequence = r1_record
            r2_id, r2_sequence = r2_record
            if r1_id != r2_id:
                raise FastqValidationError(
                    f"read-pair mismatch at record {index}: {r1_id!r} != {r2_id!r}"
                )

            pair_count += 1
            total_bases += len(r1_sequence) + len(r2_sequence)

    if pair_count == 0:
        raise FastqValidationError("input FASTQ files contain no reads")

    return pair_count, total_bases


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate paired-end FASTQ structure and synchronization."
    )
    parser.add_argument("r1", type=Path, help="Read 1 FASTQ or FASTQ.GZ")
    parser.add_argument("r2", type=Path, help="Read 2 FASTQ or FASTQ.GZ")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        pair_count, total_bases = validate_pairs(args.r1, args.r2)
    except (FastqValidationError, OSError, UnicodeError) as exc:
        print(f"FASTQ validation failed: {exc}")
        return 1

    print(f"FASTQ validation passed: {pair_count} read pairs, {total_bases} bases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

