"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../docs/assets/qc-core.js");

const parsed = core.parseQcFile(
  "sample,reads,q30,gc,duplication,adapter,retained\nA,12000000,84,48,45,3,90\nB,12000000,92,49,45,3,90\nC,12000000,92,50,45,3,90",
  "example.csv"
);

assert.equal(parsed.length, 3);
assert.equal(core.evaluateSamples(parsed)[0].status, "WARN");

const relaxed = core.evaluateSamples(parsed, { q30WarnMin: 80, q30FailMin: 75 });
assert.equal(relaxed[0].status, "PASS");

const strict = core.evaluateSamples(parsed, { duplicationWarnMax: 40, duplicationFailMax: 60 });
assert.equal(strict[0].status, "WARN");

const resolved = core.resolveThresholds({ q30WarnMin: "91", adapterFailMax: "invalid" });
assert.equal(resolved.q30WarnMin, 91);
assert.equal(resolved.adapterFailMax, core.defaultThresholds.adapterFailMax);

const explicitPercent = core.parseQcFile(
  "sample,reads,q30,gc,duplication,adapter,retained\nA,12000000,92%,48%,30%,0.5%,90%",
  "percent-signs.csv"
);
assert.equal(explicitPercent[0].adapter, 0.5);
assert.equal(core.evaluateSamples(explicitPercent)[0].status, "PASS");

const blanks = core.parseQcFile(
  "sample,reads,q30,gc,duplication,adapter,retained\nA,12000000,,48,30,,90",
  "blanks.csv"
);
assert.equal(blanks[0].q30, undefined);
assert.equal(blanks[0].adapter, undefined);
assert.equal(core.evaluateSamples(blanks)[0].status, "PASS");

const decimalComma = core.parseQcFile(
  "sample;reads;q30;gc;duplication;adapter;retained\nA;12000000;92,5%;48,1%;30%;0,5%;90%",
  "decimal-comma.csv"
);
assert.equal(decimalComma[0].q30, 92.5);
assert.equal(decimalComma[0].adapter, 0.5);

assert.throws(
  () => core.parseQcFile("sample,q30\nA,92", "too-narrow.csv"),
  /fewer than two recognized metrics/
);

assert.throws(
  () => core.parseQcFile("sample,reads,q30\nA,12000000,92\nB,,91", "mixed-coverage.csv"),
  /fewer than two recognized metrics for B/
);

const fixtureDir = path.join(__dirname, "fixtures", "multiqc-1.35");
const realTsv = core.parseQcFile(
  fs.readFileSync(path.join(fixtureDir, "multiqc_general_stats.txt"), "utf8"),
  "multiqc_general_stats.txt"
);
assert.equal(realTsv.length, 2);
const fastpTsv = realTsv.find((sample) => sample.sample === "smalltest_S10");
assert.equal(fastpTsv.reads, 16034314);
assert.equal(fastpTsv.q30, 94.1898);
assert.equal(fastpTsv.gc, 46.7941);
assert.equal(fastpTsv.adapter, 0.8814870772653499);
assert.equal(fastpTsv.retained, 95.64762325619795);

const realJson = core.parseQcFile(
  fs.readFileSync(path.join(fixtureDir, "multiqc_data.general-stats-extract.json"), "utf8"),
  "multiqc_data.json"
);
assert.equal(realJson.length, 2);
const fastpJson = realJson.find((sample) => sample.sample === "smalltest_S10");
assert.equal(fastpJson.reads, 16034314);
assert.equal(fastpJson.q30, 94.1898);
assert.equal(fastpJson.gc, 46.7941);

console.log("GenomQC browser core tests passed");
