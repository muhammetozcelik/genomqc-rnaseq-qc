# Demonstration case: paired-end RNA-seq read QC

## Objective

Evaluate whether conservative paired-end preprocessing can improve terminal
read quality while preserving most read pairs.

## Dataset

- Accession label: `GSM461178`
- Input: paired-end RNA-seq FASTQ subset
- Input size: 100,000 read pairs
- Original read length: 37 bp

This repository does not redistribute the source FASTQ files. The case study
records the workflow parameters and aggregate QC metrics only.

## Parameters

```text
adapter detection: paired-end automatic detection
tail trimming: enabled
sliding-window size: 4 bases
mean quality threshold: Q20
minimum retained length: 20 bases
threads: 2
```

## Results

| Metric | Raw R1 | Trimmed R1 | Raw R2 | Trimmed R2 |
|---|---:|---:|---:|---:|
| Read count | 100,000 | 98,376 | 100,000 | 98,376 |
| Average length | 37.0 bp | 36.7 bp | 37.0 bp | 35.8 bp |
| Q30 bases | 91.29% | 92.40% | 82.28% | 85.41% |
| FastQC per-base quality | PASS | PASS | WARN | PASS |

Additional fastp results:

- retained pairs: 98.38%;
- reads with adapters trimmed: 756;
- adapter-affected reads: approximately 0.4%;
- duplication estimate: 0.899%.

## Interpretation

R2 showed stronger 3-prime quality decay than R1. Conservative tail trimming
improved R2 Q30 by 3.13 percentage points and changed its FastQC per-base
quality status from WARN to PASS while retaining 98.38% of input pairs.

Sequence-length distribution warnings after trimming are expected because
quality trimming produces variable-length reads. Per-base sequence-content and
GC-content warnings remained and were not treated as automatic evidence of
adapter contamination; such patterns can reflect RNA-seq library construction
and priming effects.

## Reproducibility check

Manual and automated executions produced identical decompressed FASTQ MD5
hashes:

```text
R1: 16c2eebb847a314b4f51aa41ded26a49
R2: 42a662b257a8f4cb8c4563610415ad33
```

## Decision

The trimmed reads were considered suitable for the next research analysis
stage. This decision is specific to the demonstrated dataset and preprocessing
goal; QC thresholds should not be applied blindly across library types.

