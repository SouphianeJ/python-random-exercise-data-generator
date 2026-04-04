"use client";

import { useState, useTransition } from "react";

import type { GeneratedDataset, GeneratorConfig } from "@/lib/generator/types";

const initialConfig: GeneratorConfig = {
  seed: 32,
  year: 2024,
  storeCount: 5,
  productCount: 100,
  customerCount: 1000,
  targetSaleLineCount: 1500,
  exportMode: "legacy-compatible-clean",
  includeAccessories: true,
  includeInterns: true,
};

type GenerateResponse = {
  dataset: GeneratedDataset;
};

function queryParams(config: GeneratorConfig, filename: string) {
  const params = new URLSearchParams({
    seed: String(config.seed),
    year: String(config.year),
    storeCount: String(config.storeCount),
    productCount: String(config.productCount),
    customerCount: String(config.customerCount),
    exportMode: config.exportMode,
    includeAccessories: String(config.includeAccessories),
    includeInterns: String(config.includeInterns),
    file: filename,
  });
  if (typeof config.targetSaleLineCount === "number") {
    params.set("targetSaleLineCount", String(config.targetSaleLineCount));
  }
  if (typeof config.targetSaleCount === "number") {
    params.set("targetSaleCount", String(config.targetSaleCount));
  }
  return `/api/export?${params.toString()}`;
}

function PreviewTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<object>;
}) {
  if (rows.length === 0) return null;
  const entries = rows as Array<Record<string, unknown>>;
  const headers = Object.keys(entries[0]).slice(0, 6);

  return (
    <section className="panel card">
      <h2>{title}</h2>
      <table className="preview-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 5).map((row, index) => (
            <tr key={`${title}-${index}`}>
              {headers.map((header) => (
                <td key={header} className={header.endsWith("id") ? "mono" : undefined}>
                  {String(row[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function GeneratorClient() {
  const [config, setConfig] = useState<GeneratorConfig>(initialConfig);
  const [dataset, setDataset] = useState<GeneratedDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof GeneratorConfig>(key: K, value: GeneratorConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        setError((await response.text()) || "Generation failed.");
        return;
      }
      const data = (await response.json()) as GenerateResponse;
      setDataset(data.dataset);
    });
  }

  const summary = dataset?.summary;

  return (
    <div className="page-shell">
      <section className="hero">
        <span className="eyebrow">Next.js rebuild</span>
        <h1>Retail exercise data with coherent sales logic.</h1>
        <p>
          This generator reproduces the Python project intent with a stricter internal
          model: ticket-level sales, valid line items, deterministic seeds, and documented
          fixes for the old anomalies.
        </p>
      </section>

      <div className="layout-grid">
        <aside className="panel sidebar">
          <div className="stack">
            <div>
              <h2>Generator config</h2>
              <p className="muted">UI and API share the same typed configuration.</p>
            </div>
            <div className="field">
              <label htmlFor="seed">Seed</label>
              <input
                id="seed"
                type="number"
                value={config.seed}
                onChange={(event) => update("seed", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="year">Year</label>
              <input
                id="year"
                type="number"
                value={config.year}
                onChange={(event) => update("year", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="storeCount">Stores</label>
              <input
                id="storeCount"
                type="number"
                value={config.storeCount}
                onChange={(event) => update("storeCount", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="productCount">Products</label>
              <input
                id="productCount"
                type="number"
                value={config.productCount}
                onChange={(event) => update("productCount", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="customerCount">Customers</label>
              <input
                id="customerCount"
                type="number"
                value={config.customerCount}
                onChange={(event) => update("customerCount", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="targetSaleLineCount">Target sale lines</label>
              <input
                id="targetSaleLineCount"
                type="number"
                value={config.targetSaleLineCount ?? 0}
                onChange={(event) =>
                  update("targetSaleLineCount", Number(event.target.value) || undefined)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="exportMode">Export mode</label>
              <select
                id="exportMode"
                value={config.exportMode}
                onChange={(event) =>
                  update("exportMode", event.target.value as GeneratorConfig["exportMode"])
                }
              >
                <option value="legacy-compatible-clean">legacy-compatible-clean</option>
                <option value="canonical-json">canonical-json</option>
              </select>
            </div>
            <label className="checkbox-row">
              <span>Include accessories</span>
              <input
                type="checkbox"
                checked={config.includeAccessories}
                onChange={(event) => update("includeAccessories", event.target.checked)}
              />
            </label>
            <label className="checkbox-row">
              <span>Include interns</span>
              <input
                type="checkbox"
                checked={config.includeInterns}
                onChange={(event) => update("includeInterns", event.target.checked)}
              />
            </label>
            <div className="actions">
              <button className="primary-button" disabled={isPending} onClick={submit}>
                {isPending ? "Generating..." : "Generate dataset"}
              </button>
            </div>
            {error ? <div className="warning">{error}</div> : null}
          </div>
        </aside>

        <main className="content">
          {summary ? (
            <>
              <section className="summary-grid">
                {Object.entries(summary.counts).map(([label, value]) => (
                  <article className="panel stat-card" key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </article>
                ))}
              </section>

              <section className="panel card">
                <div className="badge">
                  anomaly count
                  <strong>{summary.anomalyCount}</strong>
                </div>
                <p className="muted">
                  Validation checks focus on sale timing, foreign keys, line uniqueness, and
                  negative pricing.
                </p>
              </section>

              {summary.warnings.length > 0 ? (
                <section className="panel card">
                  <h2>Warnings</h2>
                  <div className="warning-list">
                    {summary.warnings.map((warning) => (
                      <div className="warning" key={warning}>
                        {warning}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="panel card">
                <h2>Validation</h2>
                <div className="validation-list">
                  {summary.validationResults.map((issue) => (
                    <div
                      key={`${issue.code}-${issue.message}`}
                      className="validation-item"
                      data-severity={issue.severity}
                    >
                      <strong>{issue.severity}</strong> {issue.message}
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel card">
                <h2>Downloads</h2>
                <div className="downloads">
                  {[
                    "magasins.csv",
                    "employes.csv",
                    "articles.csv",
                    "clients.csv",
                    "ventes.csv",
                    "ventes_filtre.csv",
                    "canonical.json",
                  ].map((file) => (
                    <a className="download-link mono" href={queryParams(config, file)} key={file}>
                      {file}
                    </a>
                  ))}
                </div>
              </section>

              <PreviewTable title="Stores preview" rows={dataset?.stores ?? []} />
              <PreviewTable title="Employees preview" rows={dataset?.employees ?? []} />
              <PreviewTable title="Products preview" rows={dataset?.products ?? []} />
              <PreviewTable title="Customers preview" rows={dataset?.customers ?? []} />
              <PreviewTable title="Sales preview" rows={dataset?.saleLines ?? []} />
            </>
          ) : (
            <section className="panel card">
              <h2>No dataset generated yet</h2>
              <p className="muted">
                Use the form to generate a seed-stable sample and preview the canonical data.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
