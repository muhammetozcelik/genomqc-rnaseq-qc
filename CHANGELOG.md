# Changelog

## 1.1.1 - 2026-09-07

- Fixed percentage-sign values such as `0.5%` being multiplied twice.
- Preserved blank, NA, null and non-numeric cells as missing instead of zero.
- Added unit-aware parsing for MultiQC 1.35 JSON and general-statistics TSV exports.
- Stopped evaluation when a detected sample has fewer than two recognized metrics.
- Added reproducible MultiQC 1.35 compatibility fixtures and a public field/unit contract.
- Replaced the unsupported public case claim with verifiable compatibility evidence.

## 1.1.0 - 2026-09-04

- Added configurable decision thresholds to the browser QC engine while
  preserving the public beta defaults.
- Added the GenomQC Pro product page and clear free-versus-Pro positioning.
- Added privacy, terms, and refund pages plus basic search/social metadata.
- Added automated coverage for default and custom browser thresholds.

All notable changes to GenomQC are documented here.

## [0.1.0] - 2026-07-25

### Added

- paired-end FASTQ structure and synchronization validation;
- raw and post-trimming QC with SeqKit and FastQC;
- conservative paired-end preprocessing with fastp;
- consolidated MultiQC report;
- input and output SHA-256 manifests;
- machine-readable run metadata and software version capture;
- synthetic example data and automated unit/integration tests;
- documented public RNA-seq demonstration case.

