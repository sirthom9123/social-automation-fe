import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthenticatedImage } from "../components/AuthenticatedImage";
import { PipelineJobResult } from "../components/PipelineJobResult";
import { ApiError, apiFetch } from "../api";

type JobRow = {
  id: string;
  status: string;
  job_type: string;
  result_json: Record<string, unknown> | null;
  error: string | null;
};

type MediaItem = {
  prompt_id?: string;
  filename?: string;
  url_path?: string;
  error?: string | null;
};

export function CampaignFlowPage() {
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
  const [companyContext, setCompanyContext] = useState("");
  const [pipelineJobId, setPipelineJobId] = useState<string | null>(null);
  const [pipelineJob, setPipelineJob] = useState<JobRow | null>(null);
  const [generateRunId, setGenerateRunId] = useState<string | null>(null);
  const [mediaJobId, setMediaJobId] = useState<string | null>(null);
  const [mediaJob, setMediaJob] = useState<JobRow | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyPipe, setBusyPipe] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [weeklyLivePostAutomation, setWeeklyLivePostAutomation] = useState(false);
  const [weeklyProfileDefault, setWeeklyProfileDefault] = useState(false);
  const [platform, setPlatform] = useState<"facebook" | "linkedin" | "">("");
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiFetch<{ weekly_live_post_automation?: boolean }>("/notifications/settings");
        const w = Boolean(r.weekly_live_post_automation);
        setWeeklyProfileDefault(w);
        setWeeklyLivePostAutomation(w);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const fetchJob = useCallback(async (id: string) => {
    const r = await apiFetch<{ job: JobRow }>(`/jobs/${id}`);
    return r.job;
  }, []);

  const applyPipelineJob = useCallback((j: JobRow) => {
    setPipelineJob(j);
    if (j.status === "completed" && j.result_json) {
      const gen = j.result_json.generate as { run?: { id?: string } } | undefined;
      const rid = gen?.run?.id;
      if (rid) setGenerateRunId(rid);
    }
  }, []);

  const applyMediaJob = useCallback((j: JobRow) => {
    setMediaJob(j);
    if (j.status === "completed" && j.result_json && Array.isArray(j.result_json.items)) {
      setMediaItems(j.result_json.items as MediaItem[]);
    }
  }, []);

  useEffect(() => {
    if (!pipelineJobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await fetchJob(pipelineJobId);
        if (cancelled) return;
        applyPipelineJob(j);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const terminal = pipelineJob?.status === "completed" || pipelineJob?.status === "failed";
    if (terminal) {
      return () => {
        cancelled = true;
      };
    }
    const t = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pipelineJobId, pipelineJob?.status, fetchJob, applyPipelineJob]);

  useEffect(() => {
    if (!mediaJobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await fetchJob(mediaJobId);
        if (cancelled) return;
        applyMediaJob(j);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const terminal = mediaJob?.status === "completed" || mediaJob?.status === "failed";
    if (terminal) {
      return () => {
        cancelled = true;
      };
    }
    const t = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [mediaJobId, mediaJob?.status, fetchJob, applyMediaJob]);

  async function onStartPipeline(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusyPipe(true);
    setPipelineJob(null);
    setPipelineJobId(null);
    setGenerateRunId(null);
    setMediaJob(null);
    setMediaJobId(null);
    setMediaItems([]);
    setWeeklyLivePostAutomation(weeklyProfileDefault);
    try {
      const r = await apiFetch<{
        job: { id: string; status: string; job_type: string };
        project: { id: string; slug: string; root_url: string };
      }>("/flows/start", {
        method: "POST",
        body: JSON.stringify({
          url,
          company_context: companyContext.trim() || undefined,
        }),
      });
      setPipelineJobId(r.job.id);
      const j0 = await fetchJob(r.job.id);
      applyPipelineJob(j0);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Failed to start");
    } finally {
      setBusyPipe(false);
    }
  }

  async function onCreateMedia() {
    if (!generateRunId) return;
    setErr(null);
    setBusyMedia(true);
    try {
      const r = await apiFetch<{ job: { id: string } }>("/jobs", {
        method: "POST",
        body: JSON.stringify({ job_type: "create_media", generate_run_id: generateRunId }),
      });
      setMediaJobId(r.job.id);
      const j0 = await fetchJob(r.job.id);
      applyMediaJob(j0);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Could not start media job");
    } finally {
      setBusyMedia(false);
    }
  }

  async function onRedoPrompt(pid: string) {
    if (!generateRunId) return;
    setErr(null);
    setBusyMedia(true);
    try {
      const r = await apiFetch<{ job: { id: string } }>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          job_type: "create_media",
          generate_run_id: generateRunId,
          only_prompt_ids: [pid],
        }),
      });
      setMediaJobId(r.job.id);
      setMediaJob(null);
      const j0 = await fetchJob(r.job.id);
      applyMediaJob(j0);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Redo failed");
    } finally {
      setBusyMedia(false);
    }
  }

  async function onSaveDecision(e: FormEvent) {
    e.preventDefault();
    if (!generateRunId) return;
    try {
      await apiFetch(`/runs/${generateRunId}/campaign-flow`, {
        method: "POST",
        body: JSON.stringify({
          accepted_copy: accepted,
          campaign_platform: platform || null,
          weekly_live_post_automation: weeklyLivePostAutomation,
        }),
      });
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function onPublish() {
    if (!platform) {
      setErr("Choose Meta or LinkedIn first.");
      return;
    }
    setErr(null);
    try {
      const path =
        platform === "facebook"
          ? "/publish/facebook"
          : "/publish/linkedin";
      const body =
        platform === "facebook"
          ? { campaign_name: "Flow campaign", objective: "OUTCOME_TRAFFIC" }
          : { campaign_name: "Flow campaign" };
      const out = await apiFetch<Record<string, unknown>>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPublishResult(out);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Publish request failed");
    }
  }

  const pipeDone = pipelineJob?.status === "completed";
  const pipeFailed = pipelineJob?.status === "failed";
  const mediaDone = mediaJob?.status === "completed";
  const mediaFailed = mediaJob?.status === "failed";

  return (
    <div>
      <h1>{projectId ? "Campaign flow (this website)" : "Campaign automation"}</h1>
      <p className="muted">
        Enter a site URL once—we upsert your project, analyze and generate copy in the background, then you can create ad
        images, review, redo any creative, accept, and pick a platform to send the publish stub.
      </p>
      {err ? <div className="error">{err}</div> : null}

      <form className="card stack" onSubmit={onStartPipeline}>
        <h2 className="run-section-title">1. Website</h2>
        <p className="muted">Same URL for your account updates the existing project row (no duplicate sites).</p>
        <label>
          URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        <label>
          Extra context (optional)
          <textarea value={companyContext} onChange={(e) => setCompanyContext(e.target.value)} placeholder="Tone, offer, audience…" />
        </label>
        <button className="btn" type="submit" disabled={busyPipe}>
          {busyPipe ? "Starting…" : "Run analysis & generate copy"}
        </button>
      </form>

      {pipelineJobId ? (
        <section className="run-section card stack">
          <h2 className="run-section-title">2. Pipeline status</h2>
          <p>
            Job <code>{pipelineJobId}</code> ·{" "}
            <span className={`job-status-badge job-status-${pipelineJob?.status || "queued"}`}>
              {pipelineJob?.status || "…"}
            </span>
          </p>
          {pipeFailed && pipelineJob?.error ? <div className="error">{pipelineJob.error}</div> : null}
          <button
            type="button"
            className="btn secondary"
            onClick={() => pipelineJobId && void fetchJob(pipelineJobId).then(applyPipelineJob)}
          >
            Refresh
          </button>
          {pipeDone && pipelineJob?.result_json ? (
            <PipelineJobResult jobType="url_analyze_generate" resultJson={pipelineJob.result_json} />
          ) : null}
        </section>
      ) : null}

      {pipeDone && generateRunId ? (
        <section className="run-section card stack">
          <h2 className="run-section-title">3. Create images</h2>
          <p className="muted">Uses your image model on OpenRouter (see README). Runs as a separate background job.</p>
          <p>
            Generate run: <code>{generateRunId}</code>
          </p>
          <button type="button" className="btn" onClick={() => void onCreateMedia()} disabled={busyMedia || !generateRunId}>
            {busyMedia ? "Starting…" : "Create ad images from prompts"}
          </button>
        </section>
      ) : null}

      {mediaJobId ? (
        <section className="run-section card stack">
          <h2 className="run-section-title">4. Image job</h2>
          <p>
            Job <code>{mediaJobId}</code> ·{" "}
            <span className={`job-status-badge job-status-${mediaJob?.status || "queued"}`}>{mediaJob?.status || "…"}</span>
          </p>
          {mediaFailed && mediaJob?.error ? <div className="error">{mediaJob.error}</div> : null}
          <button
            type="button"
            className="btn secondary"
            onClick={() => mediaJobId && void fetchJob(mediaJobId).then(applyMediaJob)}
          >
            Refresh
          </button>
          {mediaDone && mediaJob?.result_json ? <PipelineJobResult jobType="create_media" resultJson={mediaJob.result_json} /> : null}
        </section>
      ) : null}

      {mediaItems.length > 0 ? (
        <section className="run-section">
          <h2 className="run-section-title">5. Image results</h2>
          <div className="media-grid">
            {mediaItems.map((it) => (
              <div key={String(it.prompt_id)} className="media-card">
                <div className="media-thumb">
                  {!it.error && it.url_path ? (
                    <AuthenticatedImage urlPath={it.url_path} alt={String(it.prompt_id)} />
                  ) : (
                    <div className="media-thumb-err">{it.error || "Failed"}</div>
                  )}
                </div>
                <p className="media-caption">
                  <code>{String(it.prompt_id)}</code>
                </p>
                <button type="button" className="btn secondary small" onClick={() => onRedoPrompt(String(it.prompt_id))} disabled={busyMedia}>
                  Redo this image
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {generateRunId && pipeDone ? (
        <section className="run-section card stack">
          <h2 className="run-section-title">6. Accept &amp; campaign</h2>
          <form className="stack" onSubmit={onSaveDecision}>
            <label className="checkbox-row">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I accept the generated
              copy and media for posting
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={weeklyLivePostAutomation}
                onChange={(e) => setWeeklyLivePostAutomation(e.target.checked)}
              />
              Automate a week of posts while this campaign is live
            </label>
            <p className="muted" style={{ marginTop: "-0.25rem" }}>
              When enabled, we store your choice on this run for a future scheduler. Your default comes from{" "}
              <Link to="/notifications">Notifications</Link>; starting a new URL flow resets to that default unless you change
              it here.
            </p>
            <label>
              Platform to use next (stub)
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as "facebook" | "linkedin" | "")}
              >
                <option value="">Select…</option>
                <option value="facebook">Meta / Facebook</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </label>
            <div className="row">
              <button className="btn secondary" type="submit">
                Save decision
              </button>
              <button type="button" className="btn" onClick={() => void onPublish()} disabled={!accepted}>
                Send publish stub
              </button>
            </div>
          </form>
          {publishResult ? (
            <div className="card">
              <h3>Publish API response</h3>
              <pre className="json-view">{JSON.stringify(publishResult, null, 2)}</pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
