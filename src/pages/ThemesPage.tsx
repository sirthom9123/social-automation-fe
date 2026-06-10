import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

type Theme = {
  id: string;
  name: string;
  platforms: string[];
  month: string | null;
  status: string;
  notes: string | null;
  notion_page_id: string | null;
  project_id: string | null;
  source?: string;
  created_at: string | null;
  updated_at: string | null;
};

const ALL_PLATFORMS = ["facebook", "tiktok", "linkedin", "email"] as const;
const STATUSES = ["draft", "approved", "scheduled", "posted"] as const;
const NOTION_ENABLED = String(import.meta.env.VITE_NOTION_ENABLED || "false").toLowerCase() === "true";

export function ThemesPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [notionConfigured, setNotionConfigured] = useState(false);
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [notionApiKey, setNotionApiKey] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [newPlatforms, setNewPlatforms] = useState<string[]>(["facebook"]);
  const [newMonth, setNewMonth] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadThemes = useCallback(async () => {
    const query = new URLSearchParams();
    if (projectId) query.set("project_id", projectId);
    if (filterMonth) query.set("month", filterMonth);
    if (filterStatus) query.set("status", filterStatus);
    const qs = query.toString();
    const r = await apiFetch<{ themes: Theme[] }>(`/themes${qs ? `?${qs}` : ""}`);
    setThemes(r.themes);
  }, [projectId, filterMonth, filterStatus]);

  useEffect(() => {
    void (async () => {
      try {
        const nq = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
        const r = await apiFetch<{ configured: boolean; notion: { database_id: string; api_key: string } }>(
          `/integrations/notion${nq}`,
        );
        setNotionConfigured(r.configured);
        if (r.configured) setNotionDatabaseId(r.notion.database_id);
      } catch {
        /* ignore */
      }
      try {
        await loadThemes();
      } catch {
        /* ignore */
      }
    })();
  }, [projectId, loadThemes]);

  async function saveNotion(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/integrations/notion", {
        method: "PUT",
        body: JSON.stringify({
          database_id: notionDatabaseId,
          api_key: notionApiKey,
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      setMsg("Notion settings saved.");
      setNotionConfigured(true);
      setNotionApiKey("");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function syncNotion() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const sq = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const r = await apiFetch<{ created: number; updated: number }>(`/themes/sync${sq}`, {
        method: "POST",
      });
      setMsg(`Notion synced: ${r.created} created, ${r.updated} updated.`);
      await loadThemes();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function createTheme(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/themes", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          platforms: newPlatforms,
          month: newMonth || null,
          notes: newNotes || null,
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      setNewName("");
      setNewNotes("");
      setMsg("Theme created.");
      await loadThemes();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Create failed");
    }
  }

  async function setStatus(id: string, status: string) {
    setErr(null);
    try {
      await apiFetch(`/themes/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadThemes();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Update failed");
    }
  }

  async function regenerateFromAnalysis(cadence: "weekly" | "monthly") {
    if (!projectId) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; themes_created?: number; cadence?: string }>(
        "/themes/regenerate-from-analysis",
        {
          method: "POST",
          body: JSON.stringify({ project_id: projectId, cadence }),
        },
      );
      setMsg(
        `Regenerated ${r.themes_created ?? "?"} theme(s) (${r.cadence || cadence} plan from latest brand snapshot).`,
      );
      await loadThemes();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Regenerate failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendDigest() {
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ pending_count: number; delivery: Record<string, unknown> }>(
        "/themes/digest",
        { method: "POST" },
      );
      setMsg(`Digest sent (${r.pending_count} pending).`);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Digest failed");
    }
  }

  function togglePlatform(p: string) {
    setNewPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <div>
      <h1>{projectId ? "Themes & Notion (this website)" : "Themes"}</h1>
      <p className="muted">
        {projectId ? (
          <>
            Running <strong>Analyze</strong> on this site auto-generates a <strong>weekly</strong> set of draft themes
            from the brand snapshot (source: <code>analysis</code>). Approve themes you like, then generate post
            drafts from the Drafts page. Only <strong>approved</strong> themes are used; after drafts are built they
            move to <strong>scheduled</strong>, and to <strong>posted</strong> once published.
          </>
        ) : (
          "Running Analyze auto-generates draft themes per project. Open a website workspace for project-scoped backlog and re-generation."
        )}{" "}
        {NOTION_ENABLED
          ? "Connect a Notion database to sync extra ideas; optional alongside auto themes."
          : "Notion sync is currently disabled for this environment."}
      </p>

      {projectId ? (
        <section className="card stack">
          <h2>AI theme plan (from brand analysis)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Re-run replaces only <strong>analysis</strong>-sourced themes for this project (Notion/manual rows are left
            alone). Weekly ≈ ~7 day-by-day hooks; monthly ≈ broader pillars for the month.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void regenerateFromAnalysis("weekly")}
            >
              {busy ? "Working…" : "Regenerate weekly plan"}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void regenerateFromAnalysis("monthly")}
            >
              {busy ? "Working…" : "Regenerate monthly pillars"}
            </button>
          </div>
        </section>
      ) : null}
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <section className="card stack">
        <h2>Notion integration</h2>
        <p className="muted">
          Share a Notion database with your integration, then paste its ID below. Expected columns: <code>Name</code>,
          <code> Platform</code> (multi-select), <code>Month</code>, <code>Status</code>, <code>Notes</code>,
          <code> ProjectId</code>.
        </p>
        <form className="stack" onSubmit={saveNotion}>
          <label>
            Database ID
            <input
              type="text"
              value={notionDatabaseId}
              onChange={(e) => setNotionDatabaseId(e.target.value)}
              placeholder="abcd1234…"
            />
          </label>
          <label>
            API key (leave empty to use server default)
            <input
              type="password"
              value={notionApiKey}
              onChange={(e) => setNotionApiKey(e.target.value)}
              placeholder={notionConfigured ? "(saved)" : "secret_..."}
              autoComplete="off"
            />
          </label>
          <div className="row">
            <button type="submit" className="btn">
              Save Notion settings
            </button>
            {NOTION_ENABLED ? (
              <button
                type="button"
                className="btn secondary"
                onClick={() => void syncNotion()}
                disabled={busy || !notionConfigured}
              >
                {busy ? "Syncing…" : "Sync from Notion"}
              </button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => void sendDigest()}>
              Send Monday digest
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <h2>New theme</h2>
        <form className="stack" onSubmit={createTheme}>
          <label>
            Name
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </label>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {ALL_PLATFORMS.map((p) => (
              <label key={p} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={newPlatforms.includes(p)}
                  onChange={() => togglePlatform(p)}
                />
                {p}
              </label>
            ))}
          </div>
          <label>
            Month (YYYY-MM)
            <input type="text" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} placeholder="2026-05" />
          </label>
          <label>
            Notes
            <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </label>
          <button type="submit" className="btn">
            Create theme
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>Backlog</h2>
        <div className="row">
          <label>
            Month
            <input type="text" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} placeholder="2026-05" />
          </label>
          <label>
            Status
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">(any)</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn secondary" onClick={() => void loadThemes()}>
            Apply
          </button>
        </div>
        {themes.length === 0 ? (
          <p className="muted">No themes yet — create one above or sync from Notion.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #2a3544" }}>
                <th>Name</th>
                <th>Source</th>
                <th>Platforms</th>
                <th>Month</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #1e2733" }}>
                  <td>{t.name}</td>
                  <td>
                    <span className="muted">{t.source || "manual"}</span>
                  </td>
                  <td>{t.platforms.join(", ") || "—"}</td>
                  <td>{t.month || "—"}</td>
                  <td>
                    <span className={`job-status-badge job-status-${t.status}`}>{t.status}</span>
                  </td>
                  <td className="row">
                    {t.status !== "approved" ? (
                      <button type="button" className="btn small" onClick={() => void setStatus(t.id, "approved")}>
                        Approve
                      </button>
                    ) : null}
                    {t.status !== "draft" ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => void setStatus(t.id, "draft")}
                      >
                        Back to draft
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
