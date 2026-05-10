import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnalysisResults } from "../components/AnalysisResults";
import { ApiError, apiFetch } from "../api";

type ProjectBrief = { id: string; slug: string; root_url: string; created_at: string | null };

export function HomePage() {
  const [url, setUrl] = useState("https://");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [projects, setProjects] = useState<ProjectBrief[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiFetch<{ projects: ProjectBrief[] }>("/projects?limit=20");
        setProjects(r.projects);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function onAnalyze(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setResult(null);
    try {
      const data = await apiFetch<Record<string, unknown>>("/analyze", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setResult(data);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  const runId = result?.run && typeof result.run === "object" && result.run !== null && "id" in result.run
    ? String((result.run as { id: string }).id)
    : null;
  const projectId =
    result?.project && typeof result.project === "object" && result.project !== null && "id" in result.project
      ? String((result.project as { id: string }).id)
      : null;

  return (
    <div>
      <h1>Websites</h1>
      <p className="muted">
        Analyze a URL — each site becomes a project. Open its workspace from the list below for drafts, themes,
        newsletters, and leads scoped to that URL.
      </p>

      <form className="card stack" onSubmit={onAnalyze}>
        <div className="row">
          <label style={{ flex: 1 }}>
            Website URL
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Analyzing…" : "Run analysis"}
          </button>
        </div>
        {err ? <div className="error">{err}</div> : null}
        {result && projectId && runId ? (
          <p className="success">
            Done.{" "}
            <Link to={`/project/${projectId}/overview`}>Open workspace</Link> ·{" "}
            <Link to={`/run/${runId}`}>View run &amp; generate assets</Link>
          </p>
        ) : null}
      </form>

      {result ? <AnalysisResults result={result} /> : null}

      <h2>Recent projects</h2>
      {projects.length === 0 ? (
        <p className="muted">No projects yet. Run an analysis above.</p>
      ) : (
        <ul className="card" style={{ listStyle: "none", padding: "0.5rem 1rem", margin: 0 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ padding: "0.35rem 0" }}>
              <Link to={`/project/${p.id}/overview`}>{p.root_url}</Link>
              <span className="muted" style={{ marginLeft: "0.5rem" }}>
                {p.slug}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
