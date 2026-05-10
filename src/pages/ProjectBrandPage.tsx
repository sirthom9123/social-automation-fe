import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnalysisResults, analysisResultFromRunArtifacts } from "../components/AnalysisResults";
import { ApiError, apiFetch } from "../api";

type RunBrief = {
  id: string;
  status: string;
  created_at: string | null;
};

export function ProjectBrandPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [pickRunId, setPickRunId] = useState<string | null>(null);
  const [rootUrl, setRootUrl] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [analyzeOk, setAnalyzeOk] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      setErr(null);
      setLoading(true);
      setResult(null);
      try {
        const pr = await apiFetch<{ project: { root_url: string }; runs: RunBrief[] }>(
          `/projects/${projectId}`,
        );
        if (!cancelled) setRootUrl(pr.project.root_url || null);
        const runs = [...(pr.runs || [])].sort((a, b) => {
          const ta = a.created_at ? Date.parse(a.created_at) : 0;
          const tb = b.created_at ? Date.parse(b.created_at) : 0;
          return tb - ta;
        });
        for (const run of runs) {
          const r = await apiFetch<{ content?: Record<string, unknown> }>(
            `/runs/${run.id}?include=brand_snapshot,landing_page_qa`,
          );
          const content = r.content || {};
          const built = analysisResultFromRunArtifacts(content);
          if (built) {
            if (!cancelled) {
              setResult(built);
              setPickRunId(run.id);
            }
            return;
          }
        }
        if (!cancelled) {
          setResult(null);
          setPickRunId(null);
        }
      } catch (ex) {
        if (!cancelled) setErr(ex instanceof ApiError ? ex.message : "Failed to load brand data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadTick]);

  async function reanalyze() {
    if (!rootUrl?.trim()) return;
    setAnalyzeBusy(true);
    setAnalyzeErr(null);
    setAnalyzeOk(null);
    try {
      await apiFetch("/analyze", {
        method: "POST",
        body: JSON.stringify({ url: rootUrl.trim() }),
      });
      setAnalyzeOk("Snapshot refreshed from the latest crawl.");
      setReloadTick((t) => t + 1);
    } catch (ex) {
      setAnalyzeErr(ex instanceof ApiError ? ex.message : "Analyze failed");
    } finally {
      setAnalyzeBusy(false);
    }
  }

  if (!projectId) return null;
  if (loading) return <p className="muted">Loading brand snapshot…</p>;
  if (err) return <div className="error">{err}</div>;

  return (
    <div>
      <section className="card stack">
        <h3 style={{ marginTop: 0 }}>Site changed?</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Re-run the crawler on <code style={{ wordBreak: "break-all" }}>{rootUrl ?? "…"}</code> so this page matches
          the live site.
        </p>
        <div className="row">
          <button type="button" className="btn" disabled={analyzeBusy || !rootUrl} onClick={() => void reanalyze()}>
            {analyzeBusy ? "Analyzing…" : "Re-analyze website"}
          </button>
          <Link to={`/project/${projectId}/overview`} className="btn ghost">
            Workspace overview
          </Link>
        </div>
        {analyzeErr ? <div className="error">{analyzeErr}</div> : null}
        {analyzeOk ? <div className="success">{analyzeOk}</div> : null}
      </section>

      <h2 style={{ marginTop: "1.25rem" }}>Brand Bible</h2>
      <p className="muted">
        Latest structured snapshot from an analyze run for this project.{" "}
        {pickRunId ? (
          <>
            Source run:{" "}
            <Link to={`/run/${pickRunId}`}>
              {pickRunId.slice(0, 8)}…
            </Link>
          </>
        ) : null}
      </p>
      {!result ? (
        <p className="muted">
          No brand snapshot yet.{" "}
          <Link to="/">Run Analyze</Link> for this site’s URL (or open an existing run) to populate the Brand Bible.
        </p>
      ) : (
        <AnalysisResults result={result} hideRawToggle />
      )}
    </div>
  );
}
