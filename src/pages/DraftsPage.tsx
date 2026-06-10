import { useCallback, useEffect, useState } from "react";
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
  const [bulkBusy, setBulkBusy] = useState(false);

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
      await load();
    } catch (ex) {
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
    setErr(null);
    setMsg(null);
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
      setErr(ex instanceof ApiError ? ex.message : "Publish failed");
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
            No drafts match your filters. Drafts are generated automatically when themes are approved
            and the weekly plan runs.
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
                <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  {d.body.length > 300 ? d.body.slice(0, 300) + "..." : d.body}
                </p>
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
                {d.status === "approved" && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                      Schedule:
                      <input
                        type="datetime-local"
                        style={{ fontSize: 12 }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val) void scheduleDraft(d.id, new Date(val).toISOString());
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 13 }}
                      onClick={() => void publishDraft(d.id, d.platform)}
                    >
                      Publish Now
                    </button>
                  </>
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
