"use strict";

const assert = require("node:assert/strict");
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

console.log("GenomQC browser core tests passed");
