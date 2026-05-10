import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { PipelineJobResult } from "../components/PipelineJobResult";
import { ApiError, apiFetch } from "../api";

export function AutomationPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [url, setUrl] = useState("https://");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiFetch<{ project: { root_url: string } }>(`/projects/${projectId}`);
        if (!cancelled && r.project?.root_url) setUrl(r.project.root_url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const [platform, setPlatform] = useState<"facebook" | "tiktok" | "">("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  async function enqueue(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setJobId(null);
    setJob(null);
    try {
      const r = await apiFetch<{ job: { id: string; status: string; job_type: string } }>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          job_type: "full_pipeline",
          url,
          publish_platform: platform || undefined,
          campaign_name: "Auto draft",
        }),
      });
      setJobId(r.job.id);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Could not enqueue job (is Redis running?)");
    } finally {
      setBusy(false);
    }
  }

  async function poll() {
    if (!jobId) return;
    try {
      const r = await apiFetch<{ job: Record<string, unknown> }>(`/jobs/${jobId}`);
      setJob(r.job);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Poll failed");
    }
  }

  const status = typeof job?.status === "string" ? job.status : null;
  const jobType = typeof job?.job_type === "string" ? job.job_type : "full_pipeline";
  const completedAt = typeof job?.completed_at === "string" ? job.completed_at : null;
  const jobError = typeof job?.error === "string" ? job.error : null;
  const resultJson = job?.result_json as Record<string, unknown> | null | undefined;

  return (
    <div>
      <h1>{projectId ? "Automation (this website)" : "Automation"}</h1>
      <p className="muted">
        {projectId ? "Site URL defaults from this workspace; jobs still enqueue globally." : null}{" "}
        Enqueues a background job: analyze → generate → stub publish. Requires Redis and an RQ worker (
        <code>rq worker -u $REDIS_URL marketing_jobs</code>). When the job finishes, results appear below in the same
        readable layout as the Analyze and Run pages—not raw JSON.
      </p>
      {err ? <div className="error">{err}</div> : null}

      <form className="card stack" onSubmit={enqueue}>
        <label>
          Site URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        <label>
          Stub publish platform (optional)
          <select value={platform} onChange={(e) => setPlatform(e.target.value as "facebook" | "tiktok" | "")}>
            <option value="">None</option>
            <option value="facebook">facebook</option>
            <option value="tiktok">tiktok</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Enqueueing…" : "Run full pipeline in background"}
        </button>
      </form>

      {jobId ? (
        <div className="card stack run-section">
          <h2 className="run-section-title">Job status</h2>
          <p>
            Job ID: <code>{jobId}</code>
          </p>
          {status ? (
            <p>
              <span className="analysis-label">Status</span>
              <span className={`job-status-badge job-status-${status}`}>{status}</span>
              {completedAt ? (
                <span className="muted" style={{ marginLeft: "0.75rem" }}>
                  {completedAt}
                </span>
              ) : null}
            </p>
          ) : null}
          {jobError ? (
            <div className="analysis-card issue" style={{ marginTop: "0.5rem" }}>
              <span className="analysis-card-icon" aria-hidden>
                !
              </span>
              <p style={{ margin: 0 }}>{jobError}</p>
            </div>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => void poll()}>
            Refresh status
          </button>

          {status === "completed" && resultJson && !jobError ? (
            <div style={{ marginTop: "1rem" }}>
              <PipelineJobResult jobType={jobType} resultJson={resultJson} />
            </div>
          ) : null}

          {job ? (
            <div className="analysis-raw-toggle">
              <button type="button" className="btn ghost small" onClick={() => setShowTechnical(!showTechnical)}>
                {showTechnical ? "Hide" : "Show"} full job payload (advanced)
              </button>
              {showTechnical ? <pre className="json-view analysis-raw-json">{JSON.stringify(job, null, 2)}</pre> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
