import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

type RunBrief = { id: string; status: string; created_at: string | null };

type Newsletter = {
  id: string;
  run_id: string;
  subject: string | null;
  preheader: string | null;
  cta_url: string | null;
  cta_text: string | null;
  text_body: string | null;
  html_body: string | null;
  theme_id: string | null;
  status: string;
  last_send_result: { sent: number; failed: number; errors: string[] } | null;
  created_at: string | null;
};

export function NewsletterPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [runId, setRunId] = useState("");
  const [projectRuns, setProjectRuns] = useState<RunBrief[]>([]);
  const [extra, setExtra] = useState("");
  const [themeId, setThemeId] = useState("");
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [testTo, setTestTo] = useState("");
  const [leadTags, setLeadTags] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const r = await apiFetch<{ newsletters: Newsletter[] }>(`/newsletters${q}`);
    setNewsletters(r.newsletters);
  }, [projectId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!projectId) {
      setProjectRuns([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiFetch<{ runs: RunBrief[] }>(`/projects/${projectId}`);
        if (cancelled) return;
        const runs = r.runs || [];
        setProjectRuns(runs);
        setRunId((prev) => {
          if (prev && runs.some((x) => x.id === prev)) return prev;
          return runs[0]?.id ?? "";
        });
      } catch {
        if (!cancelled) setProjectRuns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (extra) body.extra_instructions = extra;
      if (themeId) body.theme_id = themeId;
      const r = await apiFetch<{ newsletter: Newsletter }>(`/runs/${runId}/newsletter`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg("Draft generated.");
      setSelected(r.newsletter);
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Generate failed");
    }
  }

  async function save() {
    if (!selected) return;
    setErr(null);
    try {
      const r = await apiFetch<{ newsletter: Newsletter }>(`/newsletters/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: selected.subject || "",
          preheader: selected.preheader || "",
          text_body: selected.text_body || "",
          html_body: selected.html_body || "",
          cta_url: selected.cta_url || "",
          cta_text: selected.cta_text || "",
        }),
      });
      setSelected(r.newsletter);
      setMsg("Saved.");
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function send(testOnly: boolean) {
    if (!selected) return;
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (testOnly) {
        if (!testTo.trim()) {
          setErr("Enter a test email first.");
          return;
        }
        body.test_to = testTo.trim();
      } else {
        body.lead_tags = leadTags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const r = await apiFetch<{ sent: number; failed: number; recipients: number }>(
        `/newsletters/${selected.id}/send`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setMsg(`Sent to ${r.sent}/${r.recipients} recipients (failed ${r.failed}).`);
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Send failed");
    }
  }

  return (
    <div>
      <h1>{projectId ? "Newsletters (this website)" : "Newsletters"}</h1>
      <p className="muted">
        {projectId
          ? "Drafts listed here belong to this project only. Pick a run from this site to generate."
          : "Generate a lead-gen newsletter from any project run (uses the run's brand snapshot)."} Preview HTML + plain text,
        send a test, then send to lead tags.
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <form className="card stack" onSubmit={generate}>
        <h2>Generate draft</h2>
        {projectId && projectRuns.length === 0 ? (
          <p className="muted">No runs for this project yet. Analyze this website from the home page first.</p>
        ) : null}
        {projectId && projectRuns.length > 0 ? (
          <label>
            Run (this project)
            <select value={runId} onChange={(e) => setRunId(e.target.value)} required>
              {projectRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)}… · {r.status}
                  {r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!projectId ? (
          <label>
            Run ID (any run with a brand_snapshot)
            <input type="text" value={runId} onChange={(e) => setRunId(e.target.value)} required />
          </label>
        ) : null}
        <label>
          Theme ID (optional)
          <input type="text" value={themeId} onChange={(e) => setThemeId(e.target.value)} />
        </label>
        <label>
          Extra instructions
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={Boolean(projectId && projectRuns.length === 0)}>
          Generate
        </button>
      </form>

      <section className="card stack">
        <h2>Your drafts</h2>
        {newsletters.length === 0 ? (
          <p className="muted">No newsletters yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {newsletters.map((n) => (
              <li key={n.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #1e2733" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setSelected(n)}
                  style={{ textAlign: "left", width: "100%" }}
                >
                  <strong>{n.subject || "(no subject)"}</strong>
                  <span className="muted"> · {n.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <section className="card stack">
          <h2>Edit draft</h2>
          <label>
            Subject
            <input
              type="text"
              value={selected.subject || ""}
              onChange={(e) => setSelected({ ...selected, subject: e.target.value })}
            />
          </label>
          <label>
            Preheader
            <input
              type="text"
              value={selected.preheader || ""}
              onChange={(e) => setSelected({ ...selected, preheader: e.target.value })}
            />
          </label>
          <label>
            CTA text
            <input
              type="text"
              value={selected.cta_text || ""}
              onChange={(e) => setSelected({ ...selected, cta_text: e.target.value })}
            />
          </label>
          <label>
            CTA URL
            <input
              type="text"
              value={selected.cta_url || ""}
              onChange={(e) => setSelected({ ...selected, cta_url: e.target.value })}
            />
          </label>
          <label>
            Plain text
            <textarea
              value={selected.text_body || ""}
              onChange={(e) => setSelected({ ...selected, text_body: e.target.value })}
              rows={8}
            />
          </label>
          <label>
            HTML
            <textarea
              value={selected.html_body || ""}
              onChange={(e) => setSelected({ ...selected, html_body: e.target.value })}
              rows={10}
            />
          </label>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => void save()}>
              Save
            </button>
          </div>
          <h3>Preview</h3>
          <div
            style={{ background: "#fff", color: "#000", padding: "1rem", borderRadius: "4px" }}
            dangerouslySetInnerHTML={{ __html: selected.html_body || "" }}
          />
          <h3>Send</h3>
          <div className="row">
            <label style={{ flex: 1 }}>
              Test to
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button type="button" className="btn ghost" onClick={() => void send(true)}>
              Send test
            </button>
          </div>
          <div className="row">
            <label style={{ flex: 1 }}>
              Lead tags (comma-separated; blank = all leads)
              <input
                type="text"
                value={leadTags}
                onChange={(e) => setLeadTags(e.target.value)}
                placeholder="newsletter, beta"
              />
            </label>
            <button type="button" className="btn" onClick={() => void send(false)}>
              Send to lead list
            </button>
          </div>
          {selected.last_send_result ? (
            <p className="muted">
              Last send: sent {selected.last_send_result.sent}, failed {selected.last_send_result.failed}.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
