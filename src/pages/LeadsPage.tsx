import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch, API_BASE, getToken } from "../api";

type Lead = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  source_ref: string | null;
  project_id: string | null;
  tags: string[];
  extra: Record<string, unknown>;
  created_at: string | null;
};

type LeadFormInfo = {
  capture_url: string;
  capture_token: string;
  html_snippet: string;
};

type GoogleConfig = {
  configured: boolean;
  google_sheets: { access_token: string; default_sheet_id: string };
};

export function LeadsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");

  const [formInfo, setFormInfo] = useState<LeadFormInfo | null>(null);

  const [googleSheet, setGoogleSheet] = useState("");
  const [googleAccessToken, setGoogleAccessToken] = useState("");
  const [googleConfigured, setGoogleConfigured] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    if (filterTag) params.set("tag", filterTag);
    const qs = params.toString();
    const r = await apiFetch<{ leads: Lead[]; total: number }>(`/leads${qs ? `?${qs}` : ""}`);
    setLeads(r.leads);
  }, [projectId, filterTag]);

  useEffect(() => {
    void load().catch(() => undefined);
    void (async () => {
      try {
        const r = await apiFetch<LeadFormInfo>("/integrations/lead-form");
        setFormInfo(r);
      } catch {
        /* ignore */
      }
      try {
        const g = await apiFetch<GoogleConfig>("/integrations/google-sheets");
        setGoogleConfigured(g.configured);
        setGoogleSheet(g.google_sheets.default_sheet_id || "");
      } catch {
        /* ignore */
      }
    })();
  }, [load]);

  async function addLead(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/leads", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
          tags: newTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      setNewEmail("");
      setNewName("");
      setNewTags("");
      setMsg("Lead added.");
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Create failed");
    }
  }

  async function importCsv() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setErr("Choose a CSV file first.");
      return;
    }
    setErr(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", f);
    const token = getToken();
    const res = await fetch(`${API_BASE}/leads/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    if (!res.ok) {
      setErr(`Import failed: HTTP ${res.status}`);
      return;
    }
    const r = (await res.json()) as { created: number; skipped: number };
    setMsg(`Imported ${r.created} leads (skipped ${r.skipped}).`);
    await load();
  }

  function exportCsv() {
    const token = getToken();
    void fetch(`${API_BASE}/leads/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (res) => {
        if (!res.ok) {
          setErr(`Export failed: HTTP ${res.status}`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "leads.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setErr("Export failed"));
  }

  async function saveGoogle() {
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/integrations/google-sheets", {
        method: "PUT",
        body: JSON.stringify({
          access_token: googleAccessToken || undefined,
          default_sheet_id: googleSheet || undefined,
        }),
      });
      setMsg("Google Sheets settings saved.");
      setGoogleConfigured(true);
      setGoogleAccessToken("");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function pullFromGoogle() {
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ created: number; skipped: number }>("/leads/import/google-sheets", {
        method: "POST",
        body: JSON.stringify({ sheet_id: googleSheet || undefined }),
      });
      setMsg(`Pulled ${r.created} leads (skipped ${r.skipped}).`);
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Pull failed");
    }
  }

  async function deleteLead(id: string) {
    setErr(null);
    try {
      await apiFetch(`/leads/${id}`, { method: "DELETE" });
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Delete failed");
    }
  }

  return (
    <div>
      <h1>{projectId ? "Leads (this website)" : "Leads"}</h1>
      <p className="muted">
        {projectId
          ? "Only leads linked to this project are listed. Manual adds attach this project automatically."
          : "Account-wide lead list — open a website workspace for a filtered view."}{" "}
        Capture emails from owned forms, Google Sheets, or Meta Lead Ads, then send newsletters to tagged segments.
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <section className="card stack">
        <h2>Add lead</h2>
        <form className="stack" onSubmit={addLead}>
          <label>
            Email
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          </label>
          <label>
            Name
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label>
            Tags (comma-separated)
            <input type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="newsletter, beta" />
          </label>
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>Import / Export</h2>
        <div className="row">
          <input ref={fileRef} type="file" accept=".csv,text/csv" />
          <button type="button" className="btn secondary" onClick={() => void importCsv()}>
            Import CSV
          </button>
          <button type="button" className="btn ghost" onClick={() => exportCsv()}>
            Export CSV
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Google Sheets</h2>
        <p className="muted">
          Paste a valid OAuth access token (scope <code>https://www.googleapis.com/auth/spreadsheets.readonly</code>)
          and a sheet id. The sheet's first row must include an <code>email</code> column.
        </p>
        <label>
          Default sheet id
          <input type="text" value={googleSheet} onChange={(e) => setGoogleSheet(e.target.value)} />
        </label>
        <label>
          Access token {googleConfigured ? "(saved; leave blank to keep)" : ""}
          <input
            type="password"
            value={googleAccessToken}
            autoComplete="off"
            onChange={(e) => setGoogleAccessToken(e.target.value)}
          />
        </label>
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => void saveGoogle()}>
            Save
          </button>
          <button type="button" className="btn" onClick={() => void pullFromGoogle()} disabled={!googleConfigured}>
            Pull now
          </button>
        </div>
      </section>

      {formInfo ? (
        <section className="card stack">
          <h2>Owned capture form</h2>
          <p className="muted">
            Drop this snippet on your landing pages. The <code>capture_token</code> is a long-lived token scoped to
            your account; regenerate by logging out and back in if needed.
          </p>
          <p>
            Capture URL: <code>{formInfo.capture_url}</code>
          </p>
          <pre className="json-view" style={{ whiteSpace: "pre-wrap" }}>
            {formInfo.html_snippet}
          </pre>
        </section>
      ) : null}

      <section className="card stack">
        <h2>Leads ({leads.length})</h2>
        <div className="row">
          <label>
            Filter by tag
            <input
              type="text"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="newsletter"
            />
          </label>
          <button type="button" className="btn secondary" onClick={() => void load()}>
            Apply
          </button>
        </div>
        {leads.length === 0 ? (
          <p className="muted">No leads yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #2a3544" }}>
                <th>Email</th>
                <th>Name</th>
                <th>Source</th>
                <th>Tags</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #1e2733" }}>
                  <td>{l.email}</td>
                  <td>{l.name || "—"}</td>
                  <td>{l.source}</td>
                  <td>{l.tags.join(", ") || "—"}</td>
                  <td>{l.created_at?.slice(0, 10)}</td>
                  <td>
                    <button type="button" className="btn ghost small" onClick={() => void deleteLead(l.id)}>
                      Delete
                    </button>
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
