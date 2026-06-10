"use client";

import { useState, useTransition } from "react";

import type { GeneratedDataset, GeneratorConfig } from "@/lib/generator/types";
import { availableStorePerformanceStatuses } from "@/lib/generator/performance";

const initialConfig: GeneratorConfig = {
  seed: 32,
  year: 2024,
  storeCount: 5,
  productCount: 100,
  customerCount: 1000,
  includeAccessories: true,
  includeInterns: true,
  storePerformancePlan: [],
};

const performanceStatusOptions = availableStorePerformanceStatuses();

type GenerateResponse = {
  dataset: GeneratedDataset;
};

const downloadFiles = [
  "magasins.csv",
  "magasins.xlsx",
  "employes.csv",
  "employes.xlsx",
  "articles.csv",
  "articles.xlsx",
  "clients.csv",
  "clients.xlsx",
  "ventes.csv",
  "ventes.xlsx",
  "ventes_filtre.csv",
  "ventes_filtre.xlsx",
  "ventes_exam.csv",
  "ventes_exam.xlsx",
  "store_month_costs.csv",
  "store_month_costs.xlsx",
  "canonical.json",
] as const;

function queryParams(config: GeneratorConfig, filename: string) {
  const params = new URLSearchParams({
    seed: String(config.seed),
    year: String(config.year),
    storeCount: String(config.storeCount),
    productCount: String(config.productCount),
    customerCount: String(config.customerCount),
    includeAccessories: String(config.includeAccessories),
    includeInterns: String(config.includeInterns),
    file: filename,
  });
  if ((config.storePerformancePlan?.length ?? 0) > 0) {
    params.set("storePerformancePlan", JSON.stringify(config.storePerformancePlan));
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

  function updatePerformanceRule(
    index: number,
    patch: Partial<NonNullable<GeneratorConfig["storePerformancePlan"]>[number]>,
  ) {
    setConfig((current) => ({
      ...current,
      storePerformancePlan: (current.storePerformancePlan ?? []).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      ),
    }));
  }

  function addPerformanceRule() {
    setConfig((current) => ({
      ...current,
      storePerformancePlan: [
        ...(current.storePerformancePlan ?? []),
        { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
      ],
    }));
  }

  function removePerformanceRule(index: number) {
    setConfig((current) => ({
      ...current,
      storePerformancePlan: (current.storePerformancePlan ?? []).filter(
        (_rule, ruleIndex) => ruleIndex !== index,
      ),
    }));
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
        <span className="eyebrow">exercise data generator</span>
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
            <section className="panel card">
              <h2>Store performance</h2>
              <p className="muted">
                Annual sales volume is derived from each store profile and its performance status.
              </p>
              <div className="stack">
                {(config.storePerformancePlan ?? []).map((rule, index) => (
                  <div className="panel card" key={`rule-${index}`}>
                    <div className="field">
                      <label>Target store</label>
                      <select
                        value={rule.storeId ?? ""}
                        onChange={(event) => {
                          const storeId = event.target.value || undefined;
                          const store = (dataset?.stores ?? []).find((entry) => entry.id === storeId);
                          updatePerformanceRule(index, {
                            storeId,
                            storeType: store ? store.type : rule.storeType,
                          });
                        }}
                      >
                        <option value="">auto</option>
                        {(dataset?.stores ?? []).map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.id} - {store.type} - {store.zone}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Target type</label>
                      <select
                        value={rule.storeType ?? ""}
                        onChange={(event) => {
                          const storeType =
                            (event.target.value as "Premium" | "Standard" | "Discount") ||
                            undefined;
                          const selectedStore = (dataset?.stores ?? []).find(
                            (store) => store.id === rule.storeId,
                          );
                          updatePerformanceRule(index, {
                            storeType,
                            storeId:
                              selectedStore && (!storeType || selectedStore.type === storeType)
                                ? rule.storeId
                                : undefined,
                          });
                        }}
                      >
                        <option value="">auto</option>
                        <option value="Premium">Premium</option>
                        <option value="Standard">Standard</option>
                        <option value="Discount">Discount</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={rule.performanceStatus}
                        onChange={(event) =>
                          updatePerformanceRule(index, {
                            performanceStatus: event.target.value as NonNullable<
                              GeneratorConfig["storePerformancePlan"]
                            >[number]["performanceStatus"],
                          })
                        }
                      >
                        {performanceStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="download-link mono"
                      onClick={() => removePerformanceRule(index)}
                    >
                      remove rule
                    </button>
                  </div>
                ))}
                <button type="button" className="download-link mono" onClick={addPerformanceRule}>
                  add performance rule
                </button>
              </div>
            </section>
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

              {summary.storePerformanceApplied.length > 0 ? (
                <section className="panel card">
                  <h2>Store performance plan</h2>
                  <div className="warning-list">
                    {summary.storePerformanceApplied.map((entry) => (
                      <div className="validation-item" key={`${entry.targetStoreId}-${entry.performanceStatus}`}>
                        <strong>{entry.targetStoreId}</strong> {entry.label}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

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
                <p className="muted">
                  Files match the previewed dataset, even if the form was edited since.
                </p>
                <div className="downloads">
                  {downloadFiles.map((file) => (
                    <a
                      className="download-link mono"
                      href={queryParams(dataset!.config, file)}
                      key={file}
                    >
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
