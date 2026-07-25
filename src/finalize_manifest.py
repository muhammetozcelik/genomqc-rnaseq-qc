#!/usr/bin/env python3

"""Record successful completion in an existing run manifest."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: finalize_manifest.py <manifest.json> <completed_at_utc>")
        return 2

    path = Path(sys.argv[1])
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["completed_at_utc"] = sys.argv[2]
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

