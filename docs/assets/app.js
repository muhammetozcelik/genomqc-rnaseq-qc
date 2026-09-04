(function () {
  "use strict";

  const core = window.GenomQCCore;
  const elements = {
    fileInput: document.getElementById("qc-file"),
    chooseFile: document.getElementById("choose-file"),
    loadDemo: document.getElementById("load-demo"),
    dropZone: document.getElementById("drop-zone"),
    error: document.getElementById("error-message"),
    source: document.getElementById("source-label"),
    overall: document.getElementById("overall-status"),
    metrics: document.getElementById("metric-grid"),
    findings: document.getElementById("findings-list"),
    actions: document.getElementById("actions-list"),
    table: document.getElementById("sample-table"),
    download: document.getElementById("download-json"),
    print: document.getElementById("print-report")
  };

  let currentReport = null;

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
    return new Intl.NumberFormat("tr-TR").format(Math.round(value));
  }

  function formatPercent(value) {
    return value === undefined ? "—" : `%${value.toFixed(1)}`;
  }

  function statusBadge(status) {
    return createElement("span", `status-badge status-${status.toLowerCase()}`, status);
  }

  function renderList(container, items, emptyText) {
    clear(container);
    const values = items.length ? items : [emptyText];
    values.forEach((item) => container.appendChild(createElement("li", "", item)));
  }

  function renderReport(samples, sourceName) {
    const evaluated = core.evaluateSamples(samples);
    const summary = core.summarize(evaluated);
    currentReport = {
      generatedAt: new Date().toISOString(),
      source: sourceName,
      engineVersion: core.version,
      summary,
      samples: evaluated
    };

    elements.source.textContent = `Kaynak: ${sourceName}`;
    elements.overall.textContent = summary.overall;
    elements.overall.className = `status-badge status-${summary.overall.toLowerCase()}`;

    clear(elements.metrics);
    [
      [evaluated.length, "Toplam örnek"],
      [summary.counts.PASS, "Pass"],
      [summary.counts.WARN, "Warn"],
      [summary.counts.FAIL, "Fail"]
    ].forEach(([value, label]) => {
      const metric = createElement("div", "metric");
      metric.append(createElement("strong", "", String(value)), createElement("span", "", label));
      elements.metrics.appendChild(metric);
    });

    renderList(elements.findings, summary.risks, "Tanımlı eşiklerde belirgin bir kohort riski saptanmadı.");
    renderList(elements.actions, summary.actions, "Uzman incelemesiyle birlikte aşağı akış analizine geçin.");

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
    renderReport(samples, fileName || "İçe aktarılan veri");
    return currentReport;
  }

  async function handleFile(file) {
    hideError();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showError("Dosya 10 MB sınırını aşıyor. MultiQC general stats dışa aktarımını kullanın.");
      return;
    }
    try {
      const text = await file.text();
      analyzeText(text, file.name);
      document.getElementById("report").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Dosya analiz edilemedi.");
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
    renderReport(core.demoSamples, "GenomQC demo kohortu");
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

  renderReport(core.demoSamples, "GenomQC demo kohortu");
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
        const report = analyzeText(input.content, input.fileName || "AI ile içe aktarılan veri");
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

