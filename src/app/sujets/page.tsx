import { examMeta, examSections, examTotalPoints } from "@/lib/subjects";

const DIFFICULTY_LABEL: Record<string, string> = {
  facile: "facile",
  intermediaire: "intermédiaire",
  avance: "avancé",
};

export default function SubjectsPage() {
  return (
    <div className="page-shell">
      <section className="hero">
        <span className="eyebrow">exercise data generator</span>
        <h1>{examMeta.title}</h1>
        <p className="muted">
          {examMeta.subtitle} — noté sur {examTotalPoints} points — durée conseillée{" "}
          {examMeta.durationMinutes} min.
        </p>
      </section>

      <div className="subject-grid">
        <section className="panel card">
          <h2>Classeur à distribuer</h2>
          <p className="muted">
            Étude de cas progressive (parties A à D). La feuille « Sujet » contient une colonne
            réponse vide ; le barème et le contexte sont dans la feuille « Consignes ».
          </p>
          <div className="downloads">
            <a className="download-link mono" href="/api/subjects">
              sujets.xlsx
            </a>
          </div>
        </section>

        <section className="panel card">
          <h2>Structure de l&apos;examen</h2>
          <table className="subject-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Partie</th>
                <th>Indicateur</th>
                <th>Source</th>
                <th>Niveau</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {examSections.flatMap((section) =>
                section.questions.map((question) => (
                  <tr key={question.id}>
                    <td className="mono">{question.id}</td>
                    <td>{section.title}</td>
                    <td>{question.competence}</td>
                    <td className="mono">{question.sources.join(" + ")}</td>
                    <td>{DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty}</td>
                    <td>{question.points}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
