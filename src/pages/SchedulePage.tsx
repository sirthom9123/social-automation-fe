import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

type ScheduledDraft = {
  draft_id: string;
  run_id: string;
  platform: string;
  status: string;
  scheduled_for: string;
  headline: string | null;
};

export function SchedulePage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [items, setItems] = useState<ScheduledDraft[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const r = await apiFetch<{ upcoming: ScheduledDraft[] }>(`/schedule${q}`);
    setItems(r.upcoming);
  }, [projectId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function runNow() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await apiFetch<{ weekly_job_id: string | null; monthly_job_id: string | null }>(
        "/schedule/run-now",
        { method: "POST" },
      );
      setMsg(
        `Queued: weekly=${r.weekly_job_id || "(none)"}, monthly=${r.monthly_job_id || "(none)"}. Due drafts enqueued.`,
      );
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "run-now failed");
    } finally {
      setBusy(false);
    }
  }

  const byDay = items.reduce<Record<string, ScheduledDraft[]>>((acc, d) => {
    const key = (d.scheduled_for || "").slice(0, 10) || "unscheduled";
    (acc[key] = acc[key] || []).push(d);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort();

  return (
    <div>
      <h1>{projectId ? "Schedule (this website)" : "Schedule"}</h1>
      <p className="muted">
        {projectId
          ? "Scheduled posts for this project only."
          : "All your upcoming scheduled drafts across projects."}{" "}
        Approved drafts with a <code>scheduled_for</code> time show up here. The scheduler process
        (<code>python -m app.scheduler_entry</code>) ticks hourly and enqueues publish jobs when drafts are due.
        Use <strong>Run now</strong> for a manual trigger.
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <div className="row">
        <button type="button" className="btn" onClick={() => void runNow()} disabled={busy}>
          {busy ? "Running…" : "Run scheduler now"}
        </button>
        <Link to={projectId ? `/project/${projectId}/drafts` : "/drafts"} className="btn secondary">
          Manage drafts
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="muted">
          No scheduled drafts yet. Go to{" "}
          <Link to={projectId ? `/project/${projectId}/drafts` : "/drafts"}>Drafts</Link> to set a time.
        </p>
      ) : (
        <div className="stack">
          {days.map((day) => (
            <section key={day} className="card stack">
              <h2 style={{ margin: 0 }}>{day}</h2>
              {byDay[day].map((d) => (
                <div key={d.draft_id} className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{d.platform}</strong> · {d.headline || "(no headline)"}
                  </div>
                  <div className="muted">
                    {d.scheduled_for} ·{" "}
                    <span className={`job-status-badge job-status-${d.status}`}>{d.status}</span>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
