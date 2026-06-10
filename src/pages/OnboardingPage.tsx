import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

type ProjectAutomation = {
  project_id: string;
  auto_weekly_plan: boolean;
  auto_send_for_review: boolean;
  auto_publish_approved: boolean;
  posts_per_week: number;
  platforms: string[];
  updated_at: string | null;
};

type ProjectRow = {
  project: { id: string; slug: string; root_url: string };
  automation: ProjectAutomation;
};

type NotifSettings = {
  email_enabled: boolean;
  telegram_enabled: boolean;
  notification_email: string | null;
  telegram_chat_id: string | null;
};

type IntegrationsOverview = {
  integrations: Record<string, Array<{ scope: string; project_id: string | null }>>;
  encryption?: { scheme: string; algorithm: string };
};

type NotionStatus = { configured: boolean };
type LeadFormInfo = { capture_url: string; html_snippet: string };
type LeadsList = { leads: unknown[] };

/** Matches backend ``organic_specs.ORGANIC_SLOTS`` — weekly auto-drafts one line per theme per slot. */
const ORGANIC_FORMATS: { id: string; label: string }[] = [
  { id: "facebook_post", label: "FB feed 4:5" },
  { id: "facebook_reel", label: "FB Reel 9:16" },
  { id: "facebook_status", label: "FB status" },
  { id: "linkedin_post", label: "LinkedIn" },
];

export function OnboardingPage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [notif, setNotif] = useState<NotifSettings | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsOverview | null>(null);
  const [notion, setNotion] = useState<NotionStatus | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormInfo | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const r = await apiFetch<{ projects: ProjectRow[] }>("/automation/projects");
      setRows(r.projects);
    } catch {
      /* ignore */
    }
    try {
      setNotif(await apiFetch<NotifSettings>("/notifications/settings"));
    } catch {
      /* ignore */
    }
    try {
      setIntegrations(await apiFetch<IntegrationsOverview>("/integrations"));
    } catch {
      /* ignore */
    }
    try {
      setNotion(await apiFetch<NotionStatus>("/integrations/notion"));
    } catch {
      /* ignore */
    }
    try {
      setLeadForm(await apiFetch<LeadFormInfo>("/integrations/lead-form"));
    } catch {
      /* ignore */
    }
    try {
      const l = await apiFetch<LeadsList>("/leads?limit=1");
      setLeadCount(Array.isArray(l.leads) ? l.leads.length : 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function patchAutomation(projectId: string, body: Partial<ProjectAutomation>) {
    setErr(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ automation: ProjectAutomation }>(
        `/projects/${projectId}/automation`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
      setRows((prev) =>
        prev.map((row) =>
          row.project.id === projectId ? { ...row, automation: r.automation } : row,
        ),
      );
      setMsg("Automation settings saved.");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function runSchedulerNow() {
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/schedule/run-now", { method: "POST" });
      setMsg("Scheduler tasks enqueued. Check the Drafts page in a few seconds.");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Could not run scheduler");
    }
  }

  const integrationsConfigured = Object.values(integrations?.integrations || {}).some(
    (arr) => arr.length > 0,
  );

  const telegramReady = !!notif?.telegram_enabled && !!notif?.telegram_chat_id;
  const notionReady = !!notion?.configured;

  const steps = [
    {
      id: "register",
      title: "1. You are registered",
      done: true,
      body: <p>You're logged in. A per-user encryption key is derived from the server secret.</p>,
      cta: null,
    },
    {
      id: "analyze",
      title: "2. Analyze at least one site",
      done: rows.length > 0,
      body: (
        <p>
          Drop a URL on the Analyze page. Each site becomes a project and gets its own brand snapshot, runs,
          drafts and (optionally) its own per-platform credentials.
        </p>
      ),
      cta: <Link to="/">Go to Analyze</Link>,
    },
    {
      id: "telegram",
      title: "3. Connect Telegram for review",
      done: telegramReady,
      body: (
        <p>
          Without Telegram you'll have to check the Drafts page manually. Once connected, we DM you every new
          draft with inline Approve / Reject buttons.
        </p>
      ),
      cta: <Link to="/notifications">Enable Telegram</Link>,
    },
    {
      id: "notion",
      title: "4. (Optional) Connect Notion for themes",
      done: notionReady,
      body: (
        <p>
          Themes drive the weekly/monthly plan. You can manage them in-app, but most teams prefer Notion as
          the idea backlog. Paste a database id + API key to sync.
        </p>
      ),
      cta: <Link to="/themes">Open Themes</Link>,
    },
    {
      id: "integrations",
      title: "5. Add social credentials (per project if different)",
      done: integrationsConfigured,
      body: (
        <p>
          Paste Meta / LinkedIn tokens. TikTok is temporarily disabled pending verification. If every project posts to the same page, save them at the
          user default scope. If each site has its own page, use the scope selector on Integrations to save
          project-specific overrides — our resolver always prefers project then user.
        </p>
      ),
      cta: <Link to="/integrations">Open Integrations</Link>,
    },
    {
      id: "leads",
      title: "6. Start collecting leads",
      done: leadCount !== null && leadCount > 0,
      body: (
        <>
          <p>
            Either drop your hosted snippet on a landing page, connect a Google Sheet, import a CSV, or
            register the Meta Lead Ads webhook. Lead tags feed the newsletter sender.
          </p>
          {leadForm ? (
            <p className="muted">
              Capture URL: <code>{leadForm.capture_url}</code>
            </p>
          ) : null}
        </>
      ),
      cta: <Link to="/leads">Open Leads</Link>,
    },
    {
      id: "automation",
      title: "7. Flip on per-project auto-pilot",
      done: rows.some((r) => r.automation.auto_weekly_plan),
      body: (
        <p>
          Toggle <em>auto weekly plan</em> to have the scheduler draft next week's posts every Sunday at
          18:00 UTC. Toggle <em>auto-send for review</em> to skip the manual "Send for review" click, and
          keep <em>auto-publish approved</em> on if you want the hourly tick to publish the moment you
          approve from Telegram.
        </p>
      ),
      cta: null,
    },
  ];

  return (
    <div>
      <h1>Onboarding & automation overview</h1>
      <p className="muted">
        This page explains how the whole pipeline moves and what's left to set up. Everything downstream of
        Step 7 runs automatically — the daily publish tick runs every hour, the weekly plan build runs every
        Sunday, and approvals happen on Telegram so you never need to log into this UI once it's wired.
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <section className="card stack">
        <h2>How a post moves through the system</h2>
        <ol>
          <li>
            <strong>Analyze</strong> a URL → brand snapshot + ad ideas stored in the project's latest run.
          </li>
          <li>
            <strong>Themes</strong> (Notion or local) define the monthly schedule.
          </li>
          <li>
            Every Sunday 18:00 UTC the <strong>scheduler</strong> drafts <code>posts_per_week</code> per
            platform per approved theme, writes them as <code>post_draft</code> artifacts.
          </li>
          <li>
            If "auto-send for review" is on, drafts flip to <code>pending_review</code> and Telegram pings
            you with Approve / Reject buttons. Otherwise you open the Drafts page.
          </li>
          <li>
            On approve (Telegram or UI), status becomes <code>approved</code>. Set a{" "}
            <code>scheduled_for</code> and the <strong>hourly publish tick</strong> picks it up, calls the
            platform adapter using the project's (or user's fallback) credentials, and marks it{" "}
            <code>posted</code>.
          </li>
          <li>
            Lead capture + Newsletter run on their own tracks: leads flow in via form/sheets/webhook;
            newsletters are generated from the brand snapshot and can be sent to tagged lead segments.
          </li>
        </ol>
        <div className="row">
          <button className="btn secondary" onClick={() => void runSchedulerNow()}>
            Run scheduler tasks now
          </button>
          <Link to="/schedule" className="btn ghost">
            Open Schedule
          </Link>
        </div>
      </section>

      <section className="card stack">
        <h2>Setup checklist</h2>
        {steps.map((s) => (
          <div
            key={s.id}
            className="row"
            style={{
              borderLeft: `4px solid ${s.done ? "#22c55e" : "#f59e0b"}`,
              paddingLeft: 12,
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>
                {s.done ? "✓ " : "○ "}
                {s.title}
              </h3>
              {s.body}
            </div>
            {s.cta ? <div style={{ paddingTop: 8 }}>{s.cta}</div> : null}
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Per-project automation</h2>
        <p className="muted">
          Each project can run on auto-pilot independently. Use the user-level Telegram in Notifications so
          approvals reach you regardless of which project fired them.
        </p>
        {rows.length === 0 ? (
          <p className="muted">No projects yet — analyze a URL first.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #2a3544" }}>
                <th>Project</th>
                <th>Auto weekly plan</th>
                <th>Auto-send for review</th>
                <th>Auto-publish approved</th>
                <th>Posts / week</th>
                <th>Organic formats</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.project.id} style={{ borderBottom: "1px solid #1e2733" }}>
                  <td>
                    <strong>{row.project.slug}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {row.project.root_url}
                    </div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.automation.auto_weekly_plan}
                      onChange={(e) =>
                        void patchAutomation(row.project.id, {
                          auto_weekly_plan: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.automation.auto_send_for_review}
                      onChange={(e) =>
                        void patchAutomation(row.project.id, {
                          auto_send_for_review: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.automation.auto_publish_approved}
                      onChange={(e) =>
                        void patchAutomation(row.project.id, {
                          auto_publish_approved: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={21}
                      value={row.automation.posts_per_week}
                      style={{ width: 64 }}
                      onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(v) && v >= 1 && v <= 21) {
                          void patchAutomation(row.project.id, { posts_per_week: v });
                        }
                      }}
                    />
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px" }}>
                      {ORGANIC_FORMATS.map(({ id: p, label }) => {
                        const active = row.automation.platforms.includes(p);
                        return (
                          <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...row.automation.platforms, p]))
                                  : row.automation.platforms.filter((x) => x !== p);
                                void patchAutomation(row.project.id, { platforms: next });
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
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
