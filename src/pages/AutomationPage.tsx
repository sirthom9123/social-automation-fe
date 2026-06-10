import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

export function AutomationPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    daily_publish_tick?: {
      last_tick_at: string | null;
      last_due_count: number;
      next_tick_at: string | null;
      schedule: string;
    };
    recent_publish_jobs?: Array<{
      job_id: string;
      status: string;
      platform: string;
      draft_id: string;
      error?: string | null;
      created_at?: string | null;
    }>;
  } | null>(null);
  const [drafts, setDrafts] = useState<Array<{ status: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const [s, d] = await Promise.all([
        apiFetch<{
          daily_publish_tick: {
            last_tick_at: string | null;
            last_due_count: number;
            next_tick_at: string | null;
            schedule: string;
          };
          recent_publish_jobs: Array<{
            job_id: string;
            status: string;
            platform: string;
            draft_id: string;
            error?: string | null;
            created_at?: string | null;
          }>;
        }>(`/schedule/status${query}`),
        apiFetch<{ drafts: Array<{ status: string }> }>(`/post-drafts${query}`),
      ]);
      setStatus(s);
      setDrafts(d.drafts || []);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Could not load automation status");
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!projectId) {
      setProjectName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiFetch<{ project: { slug?: string } }>(`/projects/${projectId}`);
        if (!cancelled) setProjectName(r.project?.slug || null);
      } catch {
        if (!cancelled) setProjectName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const draftCounts = useMemo(() => {
    const counts: Record<string, number> = {
      draft: 0,
      pending_review: 0,
      approved: 0,
      posted: 0,
      failed: 0,
    };
    for (const d of drafts) {
      const key = String(d.status || "draft");
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [drafts]);

  return (
    <div>
      <h1>{projectId ? "Automation (this website)" : "Automation"}</h1>
      <p className="muted">
        This page is now status-only. Scheduler ticks publish approved drafts automatically (including approved drafts
        with no schedule). Use Integrations + Drafts to configure the system; monitor runtime health here.
      </p>
      {err ? <div className="error">{err}</div> : null}

      <section className="card stack">
        <h2>Scheduler status</h2>
        {projectName ? <p className="muted">Project: {projectName}</p> : null}
        <p>
          <strong>Last publish tick:</strong>{" "}
          {status?.daily_publish_tick?.last_tick_at || "Not yet observed in this process"}
        </p>
        <p>
          <strong>Due drafts at last tick:</strong> {status?.daily_publish_tick?.last_due_count ?? 0}
        </p>
        <p>
          <strong>Next scheduled tick:</strong> {status?.daily_publish_tick?.next_tick_at || "Unknown"}
        </p>
        <p>
          <strong>Schedule:</strong> {status?.daily_publish_tick?.schedule || "hourly at minute 05 (UTC)"}
        </p>
        <button type="button" className="btn secondary" onClick={() => void loadStatus()} disabled={busy}>
          {busy ? "Refreshing..." : "Refresh status"}
        </button>
      </section>

      <section className="card stack">
        <h2>Draft queue snapshot</h2>
        <p>
          <strong>draft:</strong> {draftCounts.draft || 0} | <strong>pending_review:</strong>{" "}
          {draftCounts.pending_review || 0} | <strong>approved:</strong> {draftCounts.approved || 0} |{" "}
          <strong>posted:</strong> {draftCounts.posted || 0} | <strong>failed:</strong> {draftCounts.failed || 0}
        </p>
      </section>

      <section className="card stack">
        <h2>Recent publish attempts</h2>
        {!status?.recent_publish_jobs?.length ? (
          <p className="muted">No publish jobs yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #2a3544" }}>
                <th>When</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Draft</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {status.recent_publish_jobs.map((j) => (
                <tr key={j.job_id} style={{ borderBottom: "1px solid #1e2733" }}>
                  <td>{j.created_at || "—"}</td>
                  <td>{j.platform || "—"}</td>
                  <td>
                    <span className={`job-status-badge job-status-${j.status}`}>{j.status}</span>
                  </td>
                  <td>
                    <code>{j.draft_id || "—"}</code>
                  </td>
                  <td>{j.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
