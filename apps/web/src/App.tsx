const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">FlashDrop Prototype</p>
        <h1>React frontend and FastAPI backend are wired for local development.</h1>
        <p className="lede">
          This scaffold is intentionally minimal. It gives the team a running
          web app, a running API, and a local Postgres option without starting
          product implementation yet.
        </p>
        <div className="actions">
          <a href={apiBaseUrl} target="_blank" rel="noreferrer">
            Open API
          </a>
          <a href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
            Open Docs
          </a>
          <a href={`${apiBaseUrl}/health`} target="_blank" rel="noreferrer">
            Health Check
          </a>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Frontend</h2>
          <p>React + Vite in <code>apps/web</code>.</p>
        </article>
        <article className="panel">
          <h2>Backend</h2>
          <p>FastAPI in <code>apps/api</code>.</p>
        </article>
        <article className="panel">
          <h2>Database</h2>
          <p>Optional local Postgres via <code>docker compose up -d db</code>.</p>
        </article>
      </section>
    </main>
  );
}
