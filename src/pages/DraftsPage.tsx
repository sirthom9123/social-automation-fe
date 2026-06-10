import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AuthenticatedImage } from "../components/AuthenticatedImage";
import { ApiError, apiFetch } from "../api";

type Draft = {
  id: string;
  run_id: string;
  platform: string;
  content_type?: string | null;
  organic_label?: string | null;
  aspect_ratio?: string | null;
  media_pixel_width?: number | null;
  media_pixel_height?: number | null;
  media_kind?: string | null;
  organic_notes?: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string[];
  theme_id: string | null;
  theme_name?: string | null;
  image_media_path: string | null;
  video_media_path: string | null;
  image_prompt_suggestion?: string | null;
  scheduled_for: string | null;
  status: string;
  created_at: string | null;
};

const PLATFORMS = ["", "facebook", "linkedin"];
const STATUSES = ["", "draft", "pending_review", "approved", "rejected", "posted", "failed"];

const STATUS_PIPELINE = ["draft", "pending_review", "approved", "scheduled", "posted"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    draft: { bg: "#e8e8e8", fg: "#555" },
    pending_review: { bg: "#fff3cd", fg: "#856404" },
    approved: { bg: "#d4edda", fg: "#155724" },
    scheduled: { bg: "#cce5ff", fg: "#004085" },
    posted: { bg: "#28a745", fg: "#fff" },
    rejected: { bg: "#f8d7da", fg: "#721c24" },
    failed: { bg: "#dc3545", fg: "#fff" },
  };
  const c = colors[status] || colors.draft;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    facebook: "FB",
    linkedin: "LI",
  };
  const colors: Record<string, string> = {
    facebook: "#1877f2",
    linkedin: "#0a66c2",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        background: colors[platform] || "#666",
        color: "#fff",
        marginRight: 8,
      }}
    >
      {labels[platform] || platform.toUpperCase()}
    </span>
  );
}

function StatusPipeline({ current }: { current: string }) {
  const idx = STATUS_PIPELINE.indexOf(current);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center", margin: "8px 0" }}>
      {STATUS_PIPELINE.map((step, i) => (
        <div
          key={step}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i <= idx ? "#28a745" : "#e0e0e0",
            transition: "background 0.3s",
          }}
          title={step.replace("_", " ")}
        />
      ))}
    </div>
  );
}

export function DraftsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [platform, setPlatform] = useState("");
  const [contentType, setContentType] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedBodies, setExpandedBodies] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    if (platform) params.set("platform", platform);
    if (contentType) params.set("content_type", contentType);
    if (status) params.set("status", status);
    const qs = params.toString();
    try {
      const r = await apiFetch<{ drafts: Draft[] }>(`/post-drafts${qs ? `?${qs}` : ""}`);
      setDrafts(r.drafts);
    } catch (ex) {
      setDrafts([]);
      setErr(ex instanceof ApiError ? ex.message : "Could not load drafts");
    }
  }, [projectId, platform, contentType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setDraftStatus(id: string, next: string) {
    setErr(null);
    try {
      await apiFetch(`/post-drafts/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Update failed");
    }
  }

  async function scheduleDraft(id: string, when: string) {
    setErr(null);
    try {
      await apiFetch(`/post-drafts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_for: when || null }),
      });
      setMsg(`Scheduled for ${new Date(when).toLocaleString()} (hourly tick when due).`);
      await load();
    } catch (ex) {
      setMsg(null);
      setErr(ex instanceof ApiError ? ex.message : "Schedule failed");
    }
  }

  async function sendReview(id: string) {
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ delivery: { telegram_sent: boolean; telegram_error: string | null } }>(
        `/post-drafts/${id}/review`,
        { method: "POST" },
      );
      if (r.delivery.telegram_sent) setMsg("Review request sent to Telegram.");
      else setMsg(`Marked pending_review. Telegram not sent: ${r.delivery.telegram_error || "unknown"}.`);
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Review request failed");
    }
  }

  async function publishDraft(id: string, draftPlatform: string) {
    if (publishingId) return;
    setErr(null);
    setMsg(null);
    setPublishingId(id);
    try {
      const r = await apiFetch<{ status: string; post_id?: string; error?: string }>(
        `/publish/${draftPlatform}`,
        { method: "POST", body: JSON.stringify({ draft_id: id }) },
      );
      if (r.status === "ok") {
        setMsg(`Published successfully! Post ID: ${r.post_id || "N/A"}`);
      } else {
        setErr(`Publish failed: ${r.error || r.status}`);
      }
      await load();
    } catch (ex) {
      if (ex instanceof ApiError) {
        const body = ex.body as { error?: string; detail?: unknown } | null;
        const detail =
          typeof body?.detail === "string"
            ? body.detail
            : body?.detail != null
              ? JSON.stringify(body.detail)
              : "";
        setErr(detail ? `${ex.message} — ${detail}` : ex.message);
      } else {
        setErr("Publish failed");
      }
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteDraft(id: string) {
    if (!window.confirm("Delete this draft permanently? This cannot be undone.")) return;
    setErr(null);
    setMsg(null);
    setDeletingId(id);
    try {
      await apiFetch<{ ok: boolean }>(`/post-drafts/${id}`, { method: "DELETE" });
      setMsg("Draft deleted.");
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function generateFromApprovedThemes() {
    if (!projectId) return;
    setErr(null);
    setMsg("Generating drafts from approved themes — this may take a few minutes…");
    setGenerateBusy(true);
    try {
      const r = await apiFetch<{
        job: { id: string; status: string; job_type: string };
      }>(`/projects/${encodeURIComponent(projectId)}/post-drafts/from-themes`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const jobId = r.job.id;
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const jr = await apiFetch<{
          job: {
            status: string;
            result_json: Record<string, unknown> | null;
            error: string | null;
          };
        }>(`/jobs/${jobId}`);
        const { status, result_json: result, error } = jr.job;
        if (status === "completed") {
          const created = Number(result?.created_drafts ?? 0);
          const scheduled = Number(result?.themes_scheduled ?? 0);
          const resultStatus = String(result?.status ?? "");
          if (resultStatus === "no_approved_themes") {
            setMsg(null);
            setErr("Approve at least one theme on the Themes page, then try again.");
          } else if (resultStatus === "no_runs") {
            setMsg(null);
            setErr("Run Analyze on this site first.");
          } else if (resultStatus === "no_brand_snapshot") {
            setMsg(null);
            setErr("No brand snapshot found for this project.");
          } else if (created > 0) {
            setMsg(
              `Created ${created} draft(s) from approved themes` +
                (scheduled ? ` (${scheduled} theme(s) marked scheduled).` : "."),
            );
          } else {
            setMsg("No new drafts were created.");
          }
          break;
        }
        if (status === "failed") {
          throw new ApiError(error || "Draft generation failed", 500, jr);
        }
      }
      await load();
    } catch (ex) {
      setMsg(null);
      setErr(ex instanceof ApiError ? ex.message : "Could not generate drafts from themes");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function deleteAllForProject() {
    if (!projectId) return;
    if (
      !window.confirm(
        "Delete ALL post drafts for this website? This cannot be undone. (Images on disk are removed when possible.)",
      )
    ) {
      return;
    }
    setErr(null);
    setMsg(null);
    setBulkBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; deleted_count: number }>(
        `/post-drafts?project_id=${encodeURIComponent(projectId)}`,
        { method: "DELETE" },
      );
      setMsg(`Deleted ${r.deleted_count} draft(s).`);
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Bulk delete failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <h1>{projectId ? "Post Drafts" : "All Post Drafts"}</h1>

      {err && <div className="error">{err}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
          <label>
            Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p || "any"} value={p}>
                  {p || "(any)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Content type
            <input
              type="text"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              placeholder="e.g. facebook_reel"
              style={{ minWidth: 140 }}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s || "any"} value={s}>
                  {s || "(any)"}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn secondary" onClick={() => void load()}>
            Reload
          </button>
          {projectId ? (
            <button
              type="button"
              className="btn"
              disabled={generateBusy}
              onClick={() => void generateFromApprovedThemes()}
            >
              {generateBusy ? "Generating…" : "Generate from approved themes"}
            </button>
          ) : null}
          {projectId ? (
            <button
              type="button"
              className="btn ghost"
              style={{ color: "#721c24", borderColor: "#f5c6cb" }}
              disabled={bulkBusy}
              onClick={() => void deleteAllForProject()}
            >
              {bulkBusy ? "Deleting…" : "Delete all drafts (this site)"}
            </button>
          ) : null}
        </div>
      </div>

      {drafts.length === 0 && !err && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted" style={{ margin: 0 }}>
            No drafts yet. Approve themes on the Themes page, then click{" "}
            <strong>Generate from approved themes</strong> (or enable weekly automation).
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {drafts.map((d) => (
          <div
            key={d.id}
            className="card"
            style={{
              display: "grid",
              gridTemplateColumns: d.image_media_path ? "140px 1fr" : "1fr",
              gap: 16,
              padding: 16,
            }}
          >
            {d.image_media_path && (
              <div style={{ borderRadius: 8, overflow: "hidden", background: "#f5f5f5" }}>
                <AuthenticatedImage
                  urlPath={d.image_media_path}
                  alt={d.headline || "Post image"}
                  className="media-thumb-img"
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <PlatformIcon platform={d.platform} />
                <StatusBadge status={d.status} />
                {d.theme_name && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Theme: {d.theme_name}
                  </span>
                )}
                {d.aspect_ratio && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    {d.aspect_ratio}
                  </span>
                )}
              </div>

              <StatusPipeline current={d.status} />

              {d.headline && (
                <h3 style={{ margin: 0, fontSize: 16 }}>{d.headline}</h3>
              )}

              {d.body && (
                <>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                    {expandedBodies[d.id] || d.body.length <= 300 ? d.body : d.body.slice(0, 300) + "..."}
                  </p>
                  {d.body.length > 300 && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ fontSize: 12, width: "fit-content", marginTop: 4 }}
                      onClick={() =>
                        setExpandedBodies((prev) => ({
                          ...prev,
                          [d.id]: !prev[d.id],
                        }))
                      }
                    >
                      {expandedBodies[d.id] ? "Show less" : "Show full post"}
                    </button>
                  )}
                </>
              )}

              {d.cta && (
                <p style={{ margin: 0, fontSize: 13, color: "#1877f2", fontWeight: 600 }}>
                  {d.cta}
                </p>
              )}

              {d.hashtags.length > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                  {d.hashtags.join(" ")}
                </p>
              )}

              {d.scheduled_for && (
                <p style={{ margin: 0, fontSize: 12, color: "#004085" }}>
                  Scheduled: {new Date(d.scheduled_for).toLocaleString()}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                Media linked: image {d.image_media_path ? "yes" : "no"} | video {d.video_media_path ? "yes" : "no"}
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ fontSize: 13, color: "#721c24" }}
                  disabled={deletingId === d.id}
                  onClick={() => void deleteDraft(d.id)}
                >
                  {deletingId === d.id ? "Deleting…" : "Delete"}
                </button>
                {d.status === "draft" && (
                  <>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 13 }}
                      onClick={() => void sendReview(d.id)}
                    >
                      Send for Review
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: 13 }}
                      onClick={() => void setDraftStatus(d.id, "approved")}
                    >
                      Approve
                    </button>
                  </>
                )}
                {d.status === "pending_review" && (
                  <>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: 13 }}
                      onClick={() => void setDraftStatus(d.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ fontSize: 13 }}
                      onClick={() => void setDraftStatus(d.id, "rejected")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {(d.status === "approved" || d.status === "failed") && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                      marginTop: 4,
                    }}
                  >
                    <ScheduleDraftControl
                      draftId={d.id}
                      scheduledFor={d.scheduled_for}
                      onSave={(when) => scheduleDraft(d.id, when)}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 13 }}
                        disabled={publishingId === d.id}
                        onClick={() => void publishDraft(d.id, d.platform)}
                      >
                        {publishingId === d.id ? "Publishing…" : d.status === "failed" ? "Retry Publish" : "Publish Now"}
                      </button>
                      {d.status === "failed" && (
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ fontSize: 13 }}
                          onClick={() => void setDraftStatus(d.id, "approved")}
                        >
                          Mark Approved
                        </button>
                      )}
                      <span className="muted" style={{ fontSize: 12 }}>
                        Pick a time above to schedule, or use {d.status === "failed" ? "Retry Publish" : "Publish Now"} to post immediately.
                      </span>
                    </div>
                  </div>
                )}
                {d.status === "rejected" && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => void setDraftStatus(d.id, "draft")}
                  >
                    Move back to Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleDraftControl({
  draftId,
  scheduledFor,
  onSave,
}: {
  draftId: string;
  scheduledFor: string | null;
  onSave: (iso: string) => Promise<void>;
}) {
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [value, setValue] = useState(() => toLocalInput(scheduledFor));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedLocal = toLocalInput(scheduledFor);

  useEffect(() => {
    setValue(toLocalInput(scheduledFor));
    if (scheduledFor) {
      setHint(`Saved for ${new Date(scheduledFor).toLocaleString()}`);
    }
  }, [draftId, scheduledFor]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function queueSave(nextValue: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!nextValue || nextValue.length < 16) return;
    if (nextValue === savedLocal) {
      setHint(scheduledFor ? `Saved for ${new Date(scheduledFor).toLocaleString()}` : null);
      return;
    }

    setHint("Saving…");
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setBusy(true);
        try {
          await onSave(new Date(nextValue).toISOString());
        } catch {
          setHint("Could not save schedule — try again.");
        } finally {
          setBusy(false);
        }
      })();
    }, 400);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 13,
        padding: "8px 10px",
        background: "#f8f9fa",
        borderRadius: 8,
        border: "1px solid #e9ecef",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor={`schedule-${draftId}`} style={{ fontWeight: 600 }}>
          Schedule:
        </label>
        <input
          id={`schedule-${draftId}`}
          type="datetime-local"
          style={{ fontSize: 12, minWidth: 180 }}
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            queueSave(e.target.value);
          }}
        />
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        {busy ? "Saving…" : hint || "Choose a date and time — saves automatically."}
      </span>
    </div>
  );
}
