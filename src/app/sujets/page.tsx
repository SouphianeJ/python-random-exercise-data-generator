"use client";

import { useEffect, useMemo, useState } from "react";

interface ParamField {
  key: string;
  label: string;
  type: "int" | "select";
  min?: number;
  max?: number;
  default: number | string;
  options?: Array<{ value: string; label: string }>;
}

interface TemplateInfo {
  id: string;
  label: string;
  description: string;
  params: ParamField[];
}

interface SeedCandidate {
  seed: number;
  score: number;
  summary: Record<string, string | number>;
}

function defaultsFor(template: TemplateInfo): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.params) {
    values[field.key] = String(field.default);
  }
  return values;
}

export default function SubjectsPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<SeedCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchRange, setSearchRange] = useState({ from: "1", to: "60" });
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/api/subjects/templates")
      .then((response) => response.json())
      .then((data: { templates: TemplateInfo[] }) => {
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          setTemplateId(data.templates[0].id);
          setValues(defaultsFor(data.templates[0]));
        }
      })
      .catch(() => setError("Impossible de charger les gabarits."));
  }, []);

  const template = useMemo(
    () => templates.find((entry) => entry.id === templateId),
    [templates, templateId],
  );

  function selectTemplate(id: string) {
    setTemplateId(id);
    setCandidates([]);
    const next = templates.find((entry) => entry.id === id);
    if (next) setValues(defaultsFor(next));
  }

  function buildQuery(extra: Record<string, string> = {}) {
    const query = new URLSearchParams({ template: templateId, ...values, ...extra });
    return query.toString();
  }

  async function proposeSeeds() {
    if (!template) return;
    setSearching(true);
    setError("");
    setCandidates([]);
    try {
      const query = buildQuery({ from: searchRange.from, to: searchRange.to, limit: "5" });
      const response = await fetch(`/api/subjects/seeds?${query}`);
      const data = await response.json();
      setCandidates(data.candidates ?? []);
      if ((data.candidates ?? []).length === 0) {
        setError("Aucun seed intéressant trouvé sur cette plage : élargissez la recherche.");
      }
    } catch {
      setError("Échec de la recherche de seeds.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="hero">
        <span className="eyebrow">exercise data generator</span>
        <h1>Générateur de sujets notés</h1>
        <p className="muted">
          Choisissez un type de sujet, réglez les paramètres, faites proposer des seeds intéressants,
          puis téléchargez le sujet, les données et le corrigé — sans coder.
        </p>
      </section>

      <div className="subject-grid">
        <section className="panel card">
          <h2>1. Type de sujet</h2>
          <div className="field">
            <label htmlFor="template">Gabarit</label>
            <select
              id="template"
              value={templateId}
              onChange={(event) => selectTemplate(event.target.value)}
            >
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          {template ? <p className="muted">{template.description}</p> : null}

          <h2>2. Paramètres</h2>
          {template?.params.map((field) => (
            <div className="field" key={field.key}>
              <label htmlFor={field.key}>{field.label}</label>
              {field.type === "select" ? (
                <select
                  id={field.key}
                  value={values[field.key] ?? String(field.default)}
                  onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.key}
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={values[field.key] ?? String(field.default)}
                  onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                />
              )}
            </div>
          ))}
        </section>

        <section className="panel card">
          <h2>3. Proposer des seeds intéressants</h2>
          <p className="muted">
            Le serveur balaie une plage de seeds et classe les tirages selon l&apos;intérêt
            pédagogique (écart marqué, hypothèses qui tiennent).
          </p>
          <div className="field">
            <label htmlFor="from">Plage de seeds (de / à)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="from"
                type="number"
                min={1}
                value={searchRange.from}
                onChange={(event) => setSearchRange((r) => ({ ...r, from: event.target.value }))}
              />
              <input
                id="to"
                type="number"
                min={1}
                value={searchRange.to}
                onChange={(event) => setSearchRange((r) => ({ ...r, to: event.target.value }))}
              />
            </div>
          </div>
          <button className="primary-button" onClick={proposeSeeds} disabled={searching}>
            {searching ? "Recherche en cours…" : "Proposer des seeds"}
          </button>
          {error ? <p className="muted">{error}</p> : null}

          {candidates.length > 0 ? (
            <table className="subject-table">
              <thead>
                <tr>
                  <th>seed</th>
                  <th>score</th>
                  <th>aperçu</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.seed}>
                    <td className="mono">{candidate.seed}</td>
                    <td>{candidate.score}</td>
                    <td>
                      {Object.entries(candidate.summary).map(([key, value]) => (
                        <div key={key} className="muted">
                          <span className="mono">{key}</span> : {value}
                        </div>
                      ))}
                    </td>
                    <td>
                      <button
                        className="primary-button"
                        onClick={() =>
                          setValues((v) => ({ ...v, seed: String(candidate.seed) }))
                        }
                      >
                        Utiliser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="panel card">
          <h2>4. Générer (seed {values.seed ?? "—"})</h2>
          <p className="muted">
            Trois classeurs cohérents, recalculés depuis le même tirage.
          </p>
          <div className="downloads">
            <a className="download-link mono" href={`/api/subjects/build?${buildQuery({ file: "sujet" })}`}>
              sujet.xlsx
            </a>
            <a className="download-link mono" href={`/api/subjects/build?${buildQuery({ file: "donnees" })}`}>
              donnees.xlsx
            </a>
            <a className="download-link mono" href={`/api/subjects/build?${buildQuery({ file: "corrige" })}`}>
              corrige.xlsx
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
