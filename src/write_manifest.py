#!/usr/bin/env python3

"""Create a machine-readable GenomQC run manifest."""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
from pathlib import Path


def tool_version(command: list[str]) -> str:
    executable = shutil.which(command[0])
    if executable is None:
        return "not available"
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )
    output = (result.stdout or result.stderr).strip().splitlines()
    return output[0] if output else "unknown"


def parse_bool(value: str) -> bool:
    return value.lower() == "true"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--started-at", required=True)
    parser.add_argument("--sample", required=True)
    parser.add_argument("--r1", required=True)
    parser.add_argument("--r2", required=True)
    parser.add_argument("--threads", required=True, type=int)
    parser.add_argument("--cut-mean-quality", required=True, type=int)
    parser.add_argument("--length-required", required=True, type=int)
    parser.add_argument("--skip-trimming", required=True, type=parse_bool)
    args = parser.parse_args()

    manifest = {
        "pipeline": {"name": "GenomQC", "version": args.version},
        "sample": args.sample,
        "started_at_utc": args.started_at,
        "completed_at_utc": None,
        "inputs": {
            "r1": str(Path(args.r1).resolve()),
            "r2": str(Path(args.r2).resolve()),
        },
        "parameters": {
            "threads": args.threads,
            "cut_mean_quality": args.cut_mean_quality,
            "length_required": args.length_required,
            "skip_trimming": args.skip_trimming,
        },
        "software": {
            "python": platform.python_version(),
            "seqkit": tool_version(["seqkit", "version"]),
            "fastqc": tool_version(["fastqc", "--version"]),
            "fastp": tool_version(["fastp", "--version"]),
            "multiqc": tool_version(["multiqc", "--version"]),
        },
    }

    args.output.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

