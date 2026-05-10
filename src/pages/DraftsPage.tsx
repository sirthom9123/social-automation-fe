import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  image_media_path: string | null;
  video_media_path: string | null;
  scheduled_for: string | null;
  status: string;
  created_at: string | null;
};

const PLATFORMS = ["", "facebook", "tiktok", "linkedin"];
const STATUSES = ["", "draft", "pending_review", "approved", "rejected", "posted", "failed"];

export function DraftsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [platform, setPlatform] = useState("");
  const [contentType, setContentType] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    if (platform) params.set("platform", platform);
    if (contentType) params.set("content_type", contentType);
    if (status) params.set("status", status);
    const qs = params.toString();
    const r = await apiFetch<{ drafts: Draft[] }>(`/post-drafts${qs ? `?${qs}` : ""}`);
    setDrafts(r.drafts);
  }, [projectId, platform, contentType, status]);

  useEffect(() => {
    void load().catch(() => undefined);
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

  async function registerWebhook() {
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; webhook_url: string; error?: string }>(
        "/telegram/set-webhook",
        { method: "POST" },
      );
      if (r.ok) setMsg(`Webhook set: ${r.webhook_url}`);
      else setErr(`Webhook error: ${r.error || "unknown"}`);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Webhook registration failed");
    }
  }

  return (
    <div>
      <h1>{projectId ? "Social drafts (this website)" : "Post drafts"}</h1>
      <p className="muted">
        {projectId
          ? "Only drafts whose runs belong to this project appear here (URL-scoped workspace)."
          : "Account-wide list — open a website workspace from Websites for a filtered view."}{" "}
        Organic formats are tracked per draft — <strong>Facebook</strong> feed (4:5), <strong>Reels</strong> (9:16),
        short <strong>status</strong> lines, <strong>TikTok</strong> video vs <strong>photo slides</strong> (9:16
        carousel). Generate packs via{" "}
        <code>POST /runs/&lt;id&gt;/post-drafts</code> with <code>organic_items</code> (see API docs). Approve
        and set <code>scheduled_for</code> for the hourly publish tick.
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <div className="card stack">
        <div className="row">
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
          <button type="button" className="btn ghost" onClick={() => void registerWebhook()}>
            Register Telegram webhook
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="muted">
          No drafts match. Generate drafts from a run with{" "}
          <code>POST /runs/&lt;run_id&gt;/post-drafts</code> — use <code>organic_items</code> for reels/slides.
        </p>
      ) : (
        <div className="stack">
          {drafts.map((d) => (
            <div key={d.id} className="card stack">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ margin: 0 }}>
                  {d.platform}
                  {d.content_type ? (
                    <span className="muted" style={{ fontWeight: "normal" }}>
                      {" "}
                      · {d.organic_label || d.content_type}
                    </span>
                  ) : null}{" "}
                  · <span className={`job-status-badge job-status-${d.status}`}>{d.status}</span>
                </h3>
                <span className="muted">run {d.run_id.slice(0, 8)}…</span>
              </div>
              {d.aspect_ratio || d.media_pixel_width ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  {d.aspect_ratio ? <>Aspect <strong>{d.aspect_ratio}</strong></> : null}
                  {d.media_pixel_width && d.media_pixel_height ? (
                    <>
                      {" "}
                      · target pixels {d.media_pixel_width}×{d.media_pixel_height}
                    </>
                  ) : null}
                  {d.media_kind ? <> · {d.media_kind.replace(/_/g, " ")}</> : null}
                </p>
              ) : null}
              {d.organic_notes ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  {d.organic_notes}
                </p>
              ) : null}
              {d.headline ? <strong>{d.headline}</strong> : null}
              {d.body ? <p style={{ whiteSpace: "pre-wrap" }}>{d.body}</p> : null}
              {d.cta ? <p className="muted">CTA: {d.cta}</p> : null}
              {d.hashtags.length ? <p className="muted">{d.hashtags.join(" ")}</p> : null}
              <label>
                Scheduled for (ISO timestamp, UTC)
                <input
                  type="text"
                  defaultValue={d.scheduled_for || ""}
                  placeholder="2026-05-01T09:00:00Z"
                  onBlur={(e) => void scheduleDraft(d.id, e.target.value.trim())}
                />
              </label>
              <div className="row">
                {d.status === "draft" ? (
                  <button type="button" className="btn" onClick={() => void sendReview(d.id)}>
                    Send to Telegram for review
                  </button>
                ) : null}
                {d.status !== "approved" ? (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void setDraftStatus(d.id, "approved")}
                  >
                    Approve
                  </button>
                ) : null}
                {d.status !== "rejected" ? (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => void setDraftStatus(d.id, "rejected")}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
