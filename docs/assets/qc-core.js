(function (root) {
  "use strict";

  const copy = (english, turkish) => root.GenomQCI18n && root.GenomQCI18n.getLanguage() === "tr" ? turkish : english;

  const demoSamples = [
    { sample: "CTRL_01", reads: 24840000, q30: 91.7, gc: 48.2, duplication: 28.4, adapter: 1.2, retained: 96.8 },
    { sample: "CTRL_02", reads: 22190000, q30: 90.8, gc: 47.6, duplication: 31.1, adapter: 1.8, retained: 95.4 },
    { sample: "TREAT_01", reads: 20760000, q30: 85.41, gc: 49.1, duplication: 46.8, adapter: 3.4, retained: 98.38 },
    { sample: "TREAT_02", reads: 18340000, q30: 83.2, gc: 48.8, duplication: 58.6, adapter: 7.1, retained: 84.3 },
    { sample: "TREAT_03", reads: 4180000, q30: 77.9, gc: 66.5, duplication: 74.2, adapter: 18.7, retained: 62.5 }
  ];

  const metricAliases = {
    reads: [/total.?reads/, /total.?sequences/, /input.?read.?pairs/, /read.?count/, /^reads?$/],
    q30: [/q30/, /percent.?bases.?q30/, /bases.?q30/],
    gc: [/percent.?gc/, /gc.?percent/, /^gc$/],
    duplication: [/duplication/, /percent.?duplicates/, /duplicate.?percent/],
    adapter: [/adapter.?percent/, /percent.?adapter/, /adapter.?content/, /^adapter$/],
    retained: [/retained/, /passed.?filter.?percent/, /surviving.?percent/, /reads.?after.?filter.?percent/]
  };

  const defaultThresholds = Object.freeze({
    q30WarnMin: 85,
    q30FailMin: 80,
    retainedWarnMin: 85,
    retainedFailMin: 70,
    duplicationWarnMax: 50,
    duplicationFailMax: 70,
    adapterWarnMax: 5,
    adapterFailMax: 15,
    readsWarnMin: 5000000,
    readsFailMin: 1000000,
    gcDeviationWarnMax: 8,
    gcDeviationFailMax: 15
  });

  function normalizedKey(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }

  function numeric(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return undefined;
    const clean = value.trim().replace(/%/g, "").replace(/\s/g, "");
    const decimal = clean.includes(",") && !clean.includes(".") ? clean.replace(",", ".") : clean.replace(/,/g, "");
    const parsed = Number(decimal);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function percentage(value) {
    if (value === undefined) return undefined;
    return value > 0 && value < 1 ? value * 100 : value;
  }

  function flatten(record, prefix, depth) {
    const result = {};
    const base = prefix || "";
    const level = depth || 0;
    Object.entries(record).forEach(([key, value]) => {
      const joined = base ? `${base}_${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value) && level < 2) {
        Object.assign(result, flatten(value, joined, level + 1));
      } else {
        result[joined] = value;
      }
    });
    return result;
  }

  function metricValue(flat, aliases) {
    for (const [key, value] of Object.entries(flat)) {
      const cleanKey = normalizedKey(key);
      if (aliases.some((alias) => alias.test(cleanKey))) {
        const parsed = numeric(value);
        if (parsed !== undefined) return parsed;
      }
    }
    return undefined;
  }

  function normalizeRecord(record, sampleHint) {
    const flat = flatten(record);
    const sampleEntry = Object.entries(flat).find(([key]) => /(^|_)(sample|sample_name|name|file|filename)$/.test(normalizedKey(key)));
    const rawSample = sampleEntry && sampleEntry[1];
    const sample = typeof rawSample === "string" || typeof rawSample === "number"
      ? String(rawSample).trim()
      : String(sampleHint || "").trim();
    if (!sample) return null;

    const result = {
      sample,
      reads: metricValue(flat, metricAliases.reads),
      q30: percentage(metricValue(flat, metricAliases.q30)),
      gc: percentage(metricValue(flat, metricAliases.gc)),
      duplication: percentage(metricValue(flat, metricAliases.duplication)),
      adapter: percentage(metricValue(flat, metricAliases.adapter)),
      retained: percentage(metricValue(flat, metricAliases.retained))
    };
    const available = Object.entries(result).filter(([key, value]) => key !== "sample" && value !== undefined).length;
    return available ? result : null;
  }

  function recordsFromJson(value) {
    const candidates = [];
    const visit = (node, depth) => {
      const level = depth || 0;
      if (!node || typeof node !== "object" || level > 7) return;
      if (Array.isArray(node)) {
        node.forEach((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const normalized = normalizeRecord(item);
            if (normalized) candidates.push(normalized);
          }
          visit(item, level + 1);
        });
        return;
      }

      const direct = normalizeRecord(node);
      if (direct) candidates.push(direct);
      const entries = Object.entries(node);
      const objectValues = entries.filter(([, child]) => child && typeof child === "object" && !Array.isArray(child));
      if (objectValues.length >= 2) {
        objectValues.forEach(([sample, child]) => {
          const normalized = normalizeRecord(child, sample);
          if (normalized) candidates.push(normalized);
        });
      }
      entries.forEach(([, child]) => visit(child, level + 1));
    };
    visit(value, 0);

    const unique = new Map();
    candidates.forEach((item) => {
      const key = `${item.sample}|${item.reads ?? ""}|${item.q30 ?? ""}|${item.gc ?? ""}|${item.duplication ?? ""}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return Array.from(unique.values());
  }

  function splitRow(line, delimiter) {
    const values = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === "\"") {
        if (quoted && line[index + 1] === "\"") {
          current += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }
    values.push(current.trim());
    return values;
  }

  function recordsFromDelimited(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const headers = splitRow(lines[0], delimiter);
    return lines.slice(1).map((line) => {
      const values = splitRow(line, delimiter);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      return normalizeRecord(record);
    }).filter(Boolean);
  }

  function parseQcFile(text, fileName) {
    const trimmed = String(text || "").trim();
    if (!trimmed) throw new Error(copy("The file appears to be empty.", "Dosya boş görünüyor."));
    let samples;
    if (String(fileName || "").toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        samples = recordsFromJson(JSON.parse(trimmed));
      } catch (error) {
        throw new Error(copy("The JSON could not be read. Upload a valid MultiQC JSON export.", "JSON okunamadı. Geçerli bir MultiQC JSON dışa aktarımı yükleyin."));
      }
    } else {
      samples = recordsFromDelimited(trimmed);
    }
    if (!samples.length) {
      throw new Error(copy("No samples or QC metrics were found. Use MultiQC JSON or a TSV/CSV file with sample, reads, q30, gc, duplication, adapter and retained columns.", "Numune ve QC metrikleri bulunamadı. MultiQC JSON ya da sample, reads, q30, gc, duplication, adapter, retained sütunlu TSV/CSV kullanın."));
    }
    return samples.slice(0, 500);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function resolveThresholds(overrides) {
    const source = overrides && typeof overrides === "object" ? overrides : {};
    return Object.fromEntries(Object.entries(defaultThresholds).map(([key, fallback]) => {
      const value = Number(source[key]);
      return [key, Number.isFinite(value) ? value : fallback];
    }));
  }

  function evaluateSamples(samples, thresholdOverrides) {
    const thresholds = resolveThresholds(thresholdOverrides);
    const gcValues = samples.map((sample) => sample.gc).filter((value) => value !== undefined);
    const gcMedian = gcValues.length >= 3 ? median(gcValues) : undefined;

    return samples.map((sample) => {
      const findings = [];
      const actions = [];
      let severity = 0;
      let penalties = 0;
      const flag = (level, finding, action) => {
        severity = Math.max(severity, level);
        penalties += level === 2 ? 24 : 10;
        findings.push(finding);
        if (!actions.includes(action)) actions.push(action);
      };

      if (sample.q30 !== undefined) {
        if (sample.q30 < thresholds.q30FailMin) flag(2, copy(`Low Q30 (${sample.q30.toFixed(1)}%)`, `Q30 düşük (%${sample.q30.toFixed(1)})`), copy("Check raw data and quality profiles; consider retrimming or resequencing.", "Ham veriyi ve kalite profillerini kontrol edin; yeniden kırpma veya yeniden dizileme değerlendirin."));
        else if (sample.q30 < thresholds.q30WarnMin) flag(1, copy(`Borderline Q30 (${sample.q30.toFixed(1)}%)`, `Q30 sınırda (%${sample.q30.toFixed(1)})`), copy("Review the per-base quality plot and low-quality ends.", "Per-base kalite grafiğini ve düşük kaliteli uçları inceleyin."));
      }
      if (sample.retained !== undefined) {
        if (sample.retained < thresholds.retainedFailMin) flag(2, copy(`Critical read retention (${sample.retained.toFixed(1)}%)`, `Okuma tutulumu kritik (%${sample.retained.toFixed(1)})`), copy("Investigate filtering loss; verify adapter and quality thresholds.", "Filtreleme kaybının nedenini inceleyin; adaptör ve kalite eşiklerini doğrulayın."));
        else if (sample.retained < thresholds.retainedWarnMin) flag(1, copy(`Low read retention (${sample.retained.toFixed(1)}%)`, `Okuma tutulumu düşük (%${sample.retained.toFixed(1)})`), copy("Compare read loss before and after filtering.", "Filtre öncesi ve sonrası okuma kaybını karşılaştırın."));
      }
      if (sample.duplication !== undefined) {
        if (sample.duplication > thresholds.duplicationFailMax) flag(2, copy(`High duplication (${sample.duplication.toFixed(1)}%)`, `Duplikasyon yüksek (%${sample.duplication.toFixed(1)})`), copy("Assess library complexity and PCR amplification.", "Kütüphane karmaşıklığını ve PCR çoğaltımını değerlendirin."));
        else if (sample.duplication > thresholds.duplicationWarnMax) flag(1, copy(`Elevated duplication (${sample.duplication.toFixed(1)}%)`, `Duplikasyon artmış (%${sample.duplication.toFixed(1)})`), copy("Review the source of duplication alongside biological replicates.", "Duplikasyon kaynağını biyolojik tekrarlarla birlikte inceleyin."));
      }
      if (sample.adapter !== undefined) {
        if (sample.adapter > thresholds.adapterFailMax) flag(2, copy(`High adapter content (${sample.adapter.toFixed(1)}%)`, `Adaptör içeriği yüksek (%${sample.adapter.toFixed(1)})`), copy("Verify the adapter definition and rerun trimming.", "Adaptör tanımını doğrulayın ve trimming adımını tekrar çalıştırın."));
        else if (sample.adapter > thresholds.adapterWarnMax) flag(1, copy(`Residual adapter content (${sample.adapter.toFixed(1)}%)`, `Adaptör kalıntısı var (%${sample.adapter.toFixed(1)})`), copy("Review the adapter profile and trimming report.", "Adaptör profiline ve trimming raporuna bakın."));
      }
      if (sample.reads !== undefined) {
        if (sample.reads < thresholds.readsFailMin) flag(2, copy("Very low read depth", "Okuma derinliği çok düşük"), copy("Assess the need for resequencing against the study's power requirements.", "Çalışmanın güç gereksinimine göre yeniden dizileme ihtiyacını değerlendirin."));
        else if (sample.reads < thresholds.readsWarnMin) flag(1, copy("Low read depth", "Okuma derinliği düşük"), copy("Confirm the minimum depth requirement for downstream analysis.", "Aşağı akış analizinin minimum derinlik gereksinimini doğrulayın."));
      }
      if (sample.gc !== undefined && gcMedian !== undefined) {
        const deviation = Math.abs(sample.gc - gcMedian);
        if (deviation > thresholds.gcDeviationFailMax) flag(2, copy(`GC rate deviates from the cohort by ${deviation.toFixed(1)} points`, `GC oranı kohorttan ${deviation.toFixed(1)} puan sapıyor`), copy("Check for contamination, sample mix-up and the expected organism GC profile.", "Kontaminasyon, örnek karışması ve beklenen organizma GC profilini kontrol edin."));
        else if (deviation > thresholds.gcDeviationWarnMax) flag(1, copy(`GC rate deviates from the cohort by ${deviation.toFixed(1)} points`, `GC oranı kohorttan ${deviation.toFixed(1)} puan sapıyor`), copy("Compare the GC distribution with the other samples.", "GC dağılımını diğer numunelerle karşılaştırın."));
      }

      const available = [sample.reads, sample.q30, sample.gc, sample.duplication, sample.adapter, sample.retained].filter((value) => value !== undefined).length;
      if (available < 2) flag(1, copy("Limited metrics available for a decision", "Karar için metrik sayısı sınırlı"), copy("Use a more complete MultiQC general-stats export.", "Daha kapsamlı bir MultiQC general stats dışa aktarımı kullanın."));
      if (!findings.length) {
        findings.push(copy("No notable QC risk was detected at the defined thresholds.", "Tanımlı eşiklerde belirgin QC riski görülmedi."));
        actions.push(copy("Validate against the experimental design and biological controls before downstream analysis.", "Aşağı akış analizine geçmeden önce deney tasarımı ve biyolojik kontrollerle birlikte doğrulayın."));
      }

      return Object.assign({}, sample, {
        status: severity === 2 ? "FAIL" : severity === 1 ? "WARN" : "PASS",
        findings,
        actions,
        score: Math.max(0, 100 - penalties)
      });
    });
  }

  function summarize(samples) {
    const counts = { PASS: 0, WARN: 0, FAIL: 0 };
    samples.forEach((sample) => { counts[sample.status] += 1; });
    const overall = counts.FAIL ? "FAIL" : counts.WARN ? "WARN" : "PASS";
    const rank = { FAIL: 2, WARN: 1, PASS: 0 };
    const prioritized = samples.slice().sort((a, b) => rank[b.status] - rank[a.status]);
    const actions = Array.from(new Set(prioritized.flatMap((sample) => sample.actions))).slice(0, 4);
    const risks = Array.from(new Set(prioritized.filter((sample) => sample.status !== "PASS").flatMap((sample) => sample.findings))).slice(0, 4);
    return { counts, overall, actions, risks };
  }

  const api = { version: "1.1.0-beta", demoSamples, defaultThresholds, resolveThresholds, parseQcFile, evaluateSamples, summarize };
  root.GenomQCCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);


