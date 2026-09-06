# MultiQC 1.35 compatibility fixtures

These fixtures were generated on 2026-09-07 with MultiQC 1.35 from two files in the official MIT-licensed `MultiQC/test-data` repository:

- `data/modules/fastp/SAMPLE.json` at commit `0485df3a9a49bd158346926e4a8ff9112de2f0b7`
- `data/modules/fastqc/fastqc_data.txt` at commit `ea3268141118fc4ad042bebd0c30090315fc649c`

Source: <https://github.com/MultiQC/test-data>

`multiqc_general_stats.txt` is the complete general-statistics TSV produced by MultiQC. `multiqc_data.general-stats-extract.json` contains the unmodified `report_general_stats_data` section from the 1.16 MB `multiqc_data.json`; unrelated plot data was omitted to keep the repository fixture small. Local verification also parses the complete generated `multiqc_data.json`.

These are compatibility fixtures, not biological validation data and not a customer case study.
