import { subjectPrompts } from "@/lib/subjects";

export default function SubjectsPage() {
  return (
    <div className="page-shell">
      <section className="hero">
        <span className="eyebrow">exercise data generator</span>
      </section>

      <div className="subject-grid">
        <section className="panel card">
          <h2>Sujets Excel</h2>
          <p className="muted">
            Cette page fournit un classeur pret a distribuer aux etudiants avec les indicateurs a
            calculer et une colonne reponse vide.
          </p>
          <div className="downloads">
            <a className="download-link mono" href="/api/subjects">
              sujets.xlsx
            </a>
          </div>
        </section>

        <section className="panel card">
          <h2>Indicateurs inclus</h2>
          <table className="subject-table">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Indicateur</th>
                <th>Source</th>
                <th>Niveau</th>
              </tr>
            </thead>
            <tbody>
              {subjectPrompts.map((prompt) => (
                <tr key={prompt.indicator}>
                  <td>{prompt.theme}</td>
                  <td>{prompt.indicator}</td>
                  <td className="mono">{prompt.source}</td>
                  <td>{prompt.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
