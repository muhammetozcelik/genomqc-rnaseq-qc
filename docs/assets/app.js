(function () {
  "use strict";

  const core = window.GenomQCCore;
  const language = () => (window.GenomQCI18n && window.GenomQCI18n.getLanguage() === "tr" ? "tr" : "en");
  const copy = (english, turkish) => language() === "tr" ? turkish : english;
  const elements = {
    fileInput: document.getElementById("qc-file"),
    chooseFile: document.getElementById("choose-file"),
    loadDemo: document.getElementById("load-demo"),
    dropZone: document.getElementById("drop-zone"),
    error: document.getElementById("error-message"),
    source: document.getElementById("source-label"),
    datasetKind: document.getElementById("dataset-kind"),
    generated: document.getElementById("generated-label"),
    overall: document.getElementById("overall-status"),
    metrics: document.getElementById("metric-grid"),
    findings: document.getElementById("findings-list"),
    actions: document.getElementById("actions-list"),
    table: document.getElementById("sample-table"),
    gate: document.getElementById("decision-gate"),
    gateTitle: document.getElementById("gate-title"),
    gateCopy: document.getElementById("gate-copy"),
    coverage: document.getElementById("coverage-value"),
    queueCount: document.getElementById("queue-value"),
    reviewQueue: document.getElementById("review-queue"),
    thresholds: document.getElementById("threshold-grid"),
    download: document.getElementById("download-json"),
    print: document.getElementById("print-report")
  };

  let currentReport = null;
  let currentInput = null;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function formatNumber(value) {
    if (value === undefined) return "—";
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}M`;
    return new Intl.NumberFormat(language() === "tr" ? "tr-TR" : "en-US").format(Math.round(value));
  }

  function formatPercent(value) {
    if (value === undefined) return "—";
    return language() === "tr" ? `%${value.toFixed(1)}` : `${value.toFixed(1)}%`;
  }

  function statusBadge(status) {
    return createElement("span", `status-badge status-${status.toLowerCase()}`, status);
  }

  function renderList(container, items, emptyText) {
    clear(container);
    const values = items.length ? items : [emptyText];
    values.forEach((item) => container.appendChild(createElement("li", "", item)));
  }

  function isDemoSource(sourceName) {
    return /illustrative|demo kohortu|demo cohort/i.test(sourceName);
  }

  function metricCoverage(samples) {
    const metricNames = ["reads", "q30", "gc", "duplication", "adapter", "retained"];
    const available = samples.reduce((total, sample) => total + metricNames.filter((name) => sample[name] !== undefined).length, 0);
    return samples.length ? Math.round((available / (samples.length * metricNames.length)) * 100) : 0;
  }

  function renderGate(summary, evaluated) {
    const queue = evaluated.filter((sample) => sample.status !== "PASS");
    const messages = {
      PASS: [copy("Clear at the active thresholds", "Etkin eşiklerde engel yok"), copy("No sample crosses a WARN or FAIL boundary. Confirm the result against the experimental design before downstream use.", "Hiçbir örnek WARN veya FAIL sınırını aşmıyor. Aşağı akış kullanımından önce sonucu deney tasarımıyla doğrulayın.")],
      WARN: [copy("Review before downstream analysis", "Aşağı akış analizinden önce inceleyin"), copy("At least one sample crosses a WARN boundary. Review the flagged evidence before accepting the cohort.", "En az bir örnek WARN sınırını aşıyor. Kohortu kabul etmeden önce işaretli kanıtları inceleyin.")],
      FAIL: [copy("Hold before downstream analysis", "Aşağı akış analizinden önce bekletin"), copy("One or more samples cross a FAIL boundary and require qualified review.", "Bir veya daha fazla örnek FAIL sınırını aşıyor ve yetkin inceleme gerektiriyor.")]
    };
    elements.gate.className = `decision-gate is-${summary.overall.toLowerCase()}`;
    elements.gateTitle.textContent = messages[summary.overall][0];
    elements.gateCopy.textContent = messages[summary.overall][1];
    elements.coverage.textContent = `${metricCoverage(evaluated)}%`;
    elements.queueCount.textContent = String(queue.length);
  }

  function renderReviewQueue(evaluated) {
    clear(elements.reviewQueue);
    const flagged = evaluated.filter((sample) => sample.status !== "PASS");
    if (!flagged.length) {
      elements.reviewQueue.appendChild(createElement("p", "review-empty", copy("No samples are in the review queue at the active thresholds.", "Etkin eşiklerde inceleme kuyruğunda örnek yok.")));
      return;
    }
    flagged.forEach((sample) => {
      const card = createElement("article", `review-item is-${sample.status.toLowerCase()}`);
      const head = createElement("div", "review-item-head");
      head.append(createElement("h4", "", sample.sample), statusBadge(sample.status));
      const evidenceTitle = createElement("h5", "", copy("Evidence", "Kanıt"));
      const evidence = document.createElement("ul");
      sample.findings.forEach((finding) => evidence.appendChild(createElement("li", "", finding)));
      const action = createElement("p", "review-action");
      action.append(createElement("strong", "", `${copy("Next action", "Sonraki eylem")}: `), document.createTextNode(sample.actions[0]));
      card.append(head, evidenceTitle, evidence, action);
      elements.reviewQueue.appendChild(card);
    });
  }

  function renderThresholds() {
    const threshold = core.defaultThresholds;
    const rules = [
      ["Q30", `< ${threshold.q30WarnMin}% WARN · < ${threshold.q30FailMin}% FAIL`],
      [copy("Read retention", "Okuma tutulumu"), `< ${threshold.retainedWarnMin}% WARN · < ${threshold.retainedFailMin}% FAIL`],
      [copy("Duplication", "Duplikasyon"), `> ${threshold.duplicationWarnMax}% WARN · > ${threshold.duplicationFailMax}% FAIL`],
      [copy("Adapter content", "Adaptör içeriği"), `> ${threshold.adapterWarnMax}% WARN · > ${threshold.adapterFailMax}% FAIL`],
      [copy("Read depth", "Okuma derinliği"), `< ${formatNumber(threshold.readsWarnMin)} WARN · < ${formatNumber(threshold.readsFailMin)} FAIL`],
      [copy("Cohort GC deviation", "Kohort GC sapması"), `> ${threshold.gcDeviationWarnMax} pp WARN · > ${threshold.gcDeviationFailMax} pp FAIL`]
    ];
    clear(elements.thresholds);
    rules.forEach(([label, value]) => {
      const wrapper = createElement("div", "threshold-rule");
      wrapper.append(createElement("dt", "", label), createElement("dd", "", value));
      elements.thresholds.appendChild(wrapper);
    });
  }

  function renderReport(samples, sourceName) {
    currentInput = { samples, sourceName };
    const evaluated = core.evaluateSamples(samples);
    const summary = core.summarize(evaluated);
    currentReport = {
      generatedAt: new Date().toISOString(),
      source: sourceName,
      engineVersion: core.version,
      decisionProfile: {
        id: "genomqc-rnaseq-default",
        name: "Default RNA-seq screening profile",
        thresholds: core.defaultThresholds
      },
      summary,
      samples: evaluated
    };

    elements.source.textContent = `${copy("Source", "Kaynak")}: ${sourceName}`;
    elements.datasetKind.textContent = isDemoSource(sourceName) ? copy("ILLUSTRATIVE DATASET", "ÖRNEK VERİ SETİ") : copy("LOCAL FILE", "YEREL DOSYA");
    elements.generated.textContent = `${copy("Generated", "Oluşturuldu")}: ${new Intl.DateTimeFormat(language() === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
    elements.overall.textContent = summary.overall;
    elements.overall.className = `status-badge status-${summary.overall.toLowerCase()}`;

    clear(elements.metrics);
    [
      [evaluated.length, copy("Total samples", "Toplam örnek")],
      [summary.counts.PASS, "PASS"],
      [summary.counts.WARN, "WARN"],
      [summary.counts.FAIL, "FAIL"]
    ].forEach(([value, label]) => {
      const metric = createElement("div", "metric");
      metric.append(createElement("strong", "", String(value)), createElement("span", "", label));
      elements.metrics.appendChild(metric);
    });

    renderList(elements.findings, summary.risks, copy("No notable cohort risk was detected at the defined thresholds.", "Tanımlı eşiklerde belirgin bir kohort riski saptanmadı."));
    renderList(elements.actions, summary.actions, copy("Proceed to downstream analysis together with qualified review.", "Uzman incelemesiyle birlikte aşağı akış analizine geçin."));
    renderGate(summary, evaluated);
    renderReviewQueue(evaluated);
    renderThresholds();

    clear(elements.table);
    evaluated.forEach((sample) => {
      const row = document.createElement("tr");
      const nameCell = createElement("td", "", sample.sample);
      const statusCell = document.createElement("td");
      statusCell.appendChild(statusBadge(sample.status));
      const values = [
        formatNumber(sample.reads),
        formatPercent(sample.q30),
        formatPercent(sample.gc),
        formatPercent(sample.duplication),
        formatPercent(sample.adapter),
        sample.findings[0]
      ];
      row.append(nameCell, statusCell);
      values.forEach((value, index) => row.appendChild(createElement("td", value === "—" ? "value-muted" : "", value)));
      elements.table.appendChild(row);
    });
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
  }

  function hideError() {
    elements.error.hidden = true;
    elements.error.textContent = "";
  }

  function analyzeText(text, fileName) {
    const samples = core.parseQcFile(text, fileName);
    renderReport(samples, fileName || copy("Imported data", "İçe aktarılan veri"));
    return currentReport;
  }

  async function handleFile(file) {
    hideError();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showError(copy("The file exceeds the 10 MB limit. Use a MultiQC general-stats export.", "Dosya 10 MB sınırını aşıyor. MultiQC general stats dışa aktarımını kullanın."));
      return;
    }
    try {
      const text = await file.text();
      analyzeText(text, file.name);
      document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showError(error instanceof Error ? error.message : copy("The file could not be analyzed.", "Dosya analiz edilemedi."));
    }
  }

  function downloadReport() {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `genomqc-decision-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  elements.chooseFile.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files && event.target.files[0]));
  elements.loadDemo.addEventListener("click", () => {
    hideError();
    renderReport(core.demoSamples, copy("Illustrative bulk RNA-seq cohort · 5 samples", "Örnek bulk RNA-seq kohortu · 5 örnek"));
    document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.download.addEventListener("click", downloadReport);
  elements.print.addEventListener("click", () => window.print());

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("is-dragging");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => handleFile(event.dataTransfer && event.dataTransfer.files[0]));

  renderReport(core.demoSamples, copy("Illustrative bulk RNA-seq cohort · 5 samples", "Örnek bulk RNA-seq kohortu · 5 örnek"));
  window.addEventListener("genomqc:languagechange", () => {
    if (!currentInput) return;
    const demo = isDemoSource(currentInput.sourceName) || /örnek bulk/i.test(currentInput.sourceName);
    renderReport(currentInput.samples, demo ? copy("Illustrative bulk RNA-seq cohort · 5 samples", "Örnek bulk RNA-seq kohortu · 5 örnek") : currentInput.sourceName);
  });
  window.GenomQCApp = { analyzeText };

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== "function") return;
    const lifecycle = new AbortController();
    const tool = {
      name: "analyze_qc_report",
      title: "Analyze RNA-seq QC report",
      description: "Analyze MultiQC JSON, TSV, or CSV text and update the visible GenomQC decision report with PASS, WARN, and FAIL results.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", minLength: 1, description: "Full text content of a MultiQC JSON, TSV, or CSV export." },
          fileName: { type: "string", description: "Optional source filename including .json, .tsv, or .csv extension." }
        },
        required: ["content"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object" || typeof input.content !== "string" || !input.content.trim()) {
          throw new Error("content must be a non-empty string");
        }
        if (new Blob([input.content]).size > 10 * 1024 * 1024) {
          throw new Error("content exceeds the 10 MB limit");
        }
        if (input.fileName !== undefined && typeof input.fileName !== "string") {
          throw new Error("fileName must be a string when provided");
        }
        hideError();
        const report = analyzeText(input.content, input.fileName || copy("AI-imported data", "AI ile içe aktarılan veri"));
        document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
        return {
          overall: report.summary.overall,
          counts: report.summary.counts,
          sampleCount: report.samples.length,
          source: report.source
        };
      }
    };

    try {
      Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => lifecycle.abort());
    } catch (error) {
      lifecycle.abort();
    }
  }

  registerWebMcp();
})();

