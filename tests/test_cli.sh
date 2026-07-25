#!/usr/bin/env bash

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$root/bin/genomqc" --version | grep -q '^GenomQC 0\.1\.0$'
"$root/bin/genomqc" --help | grep -q -- '--cut-mean-quality'

if "$root/bin/genomqc" \
    --r1 missing_R1.fastq \
    --r2 missing_R2.fastq \
    --sample demo \
    --output output 2>/dev/null; then
    echo "Expected missing-input validation to fail"
    exit 1
fi

echo "CLI checks passed"

