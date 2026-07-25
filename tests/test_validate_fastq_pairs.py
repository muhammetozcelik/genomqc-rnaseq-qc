from __future__ import annotations

import gzip
import tempfile
import unittest
from pathlib import Path

from src.validate_fastq_pairs import FastqValidationError, validate_pairs


VALID_R1 = """@read1/1
ACGT
+
IIII
@read2/1
TGCA
+
IIII
"""

VALID_R2 = """@read1/2
GGGG
+
IIII
@read2/2
CCCC
+
IIII
"""


class ValidateFastqPairsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def write(self, name: str, content: str) -> Path:
        path = self.root / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_valid_pairs(self) -> None:
        result = validate_pairs(
            self.write("reads_R1.fastq", VALID_R1),
            self.write("reads_R2.fastq", VALID_R2),
        )
        self.assertEqual(result, (2, 16))

    def test_gzip_input(self) -> None:
        r1 = self.root / "reads_R1.fastq.gz"
        r2 = self.root / "reads_R2.fastq.gz"
        for path, content in ((r1, VALID_R1), (r2, VALID_R2)):
            with gzip.open(path, "wt", encoding="utf-8") as handle:
                handle.write(content)
        self.assertEqual(validate_pairs(r1, r2), (2, 16))

    def test_rejects_mismatched_ids(self) -> None:
        r2 = VALID_R2.replace("@read2/2", "@different/2")
        with self.assertRaisesRegex(FastqValidationError, "mismatch"):
            validate_pairs(
                self.write("reads_R1.fastq", VALID_R1),
                self.write("reads_R2.fastq", r2),
            )

    def test_rejects_sequence_quality_length_difference(self) -> None:
        invalid = VALID_R1.replace("ACGT\n+\nIIII", "ACGT\n+\nIII")
        with self.assertRaisesRegex(FastqValidationError, "lengths differ"):
            validate_pairs(
                self.write("reads_R1.fastq", invalid),
                self.write("reads_R2.fastq", VALID_R2),
            )

    def test_rejects_different_read_counts(self) -> None:
        r2 = VALID_R2.split("@read2/2")[0]
        with self.assertRaisesRegex(FastqValidationError, "different numbers"):
            validate_pairs(
                self.write("reads_R1.fastq", VALID_R1),
                self.write("reads_R2.fastq", r2),
            )


if __name__ == "__main__":
    unittest.main()

