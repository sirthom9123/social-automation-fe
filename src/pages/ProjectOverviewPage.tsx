import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";

type AutomationRow = {
  project: { id: string; slug: string; root_url: string };
  automation: {
    auto_weekly_plan: boolean;
    auto_send_for_review: boolean;
    auto_publish_approved: boolean;
    posts_per_week: number;
    platforms: string[];
    updated_at: string | null;
  };
};

export function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [rootUrl, setRootUrl] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [themeCount, setThemeCount] = useState(0);
  const [newsletterCount, setNewsletterCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [notionReady, setNotionReady] = useState(false);
  const [autoRow, setAutoRow] = useState<AutomationRow["automation"] | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoadErr(null);
    try {
      const proj = await apiFetch<{ project: { root_url: string }; runs: unknown[] }>(
        `/projects/${projectId}`,
      );
      setRootUrl(proj.project.root_url);
      setRunCount(proj.runs?.length ?? 0);

      const [drafts, themes, newsletters, leads, notion, auto] = await Promise.all([
        apiFetch<{ drafts: unknown[] }>(`/post-drafts?project_id=${encodeURIComponent(projectId)}`),
        apiFetch<{ themes: unknown[] }>(`/themes?project_id=${encodeURIComponent(projectId)}`),
        apiFetch<{ newsletters: unknown[] }>(`/newsletters?project_id=${encodeURIComponent(projectId)}`),
        apiFetch<{ leads: unknown[] }>(`/leads?project_id=${encodeURIComponent(projectId)}`),
        apiFetch<{ configured: boolean }>(
          `/integrations/notion?project_id=${encodeURIComponent(projectId)}`,
        ).catch(() => ({ configured: false })),
        apiFetch<{ projects: AutomationRow[] }>("/automation/projects"),
      ]);

      setDraftCount(drafts.drafts.length);
      setThemeCount(themes.themes.length);
      setNewsletterCount(newsletters.newsletters.length);
      setLeadCount(leads.leads.length);
      setNotionReady(Boolean(notion.configured));
      const row = auto.projects.find((p) => p.project.id === projectId);
      setAutoRow(row?.automation ?? null);
    } catch (ex) {
      setLoadErr(ex instanceof ApiError ? ex.message : "Failed to load workspace");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reanalyze() {
    if (!rootUrl?.trim()) return;
    setAnalyzeBusy(true);
    setAnalyzeMsg(null);
    setAnalyzeErr(null);
    try {
      await apiFetch<Record<string, unknown>>("/analyze", {
        method: "POST",
        body: JSON.stringify({ url: rootUrl.trim() }),
      });
      setAnalyzeMsg(
        "Analysis finished. Brand snapshot, QA, and AI themes were refreshed from the latest crawl.",
      );
      await load();
    } catch (ex) {
      setAnalyzeErr(ex instanceof ApiError ? ex.message : "Analyze failed");
    } finally {
      setAnalyzeBusy(false);
    }
  }

  const base = projectId ? `/project/${projectId}` : "";

  if (!projectId) return null;
  if (loadErr) return <div className="error">{loadErr}</div>;

  const checklist = [
    {
      label: "Website analyzed",
      done: runCount > 0,
      hint: "Use Re-analyze below after site changes, or Analyze from Websites.",
      to: "/",
      linkLabel: "Websites",
    },
    {
      label: "Brand Bible",
      done: runCount > 0,
      hint: "Structured brand snapshot from your latest crawl.",
      to: `${base}/brand`,
      linkLabel: "Open Brand Bible",
    },
    {
      label: "Social & Facebook drafts",
      done: draftCount > 0,
      hint: "Organic slots and campaign drafts tied to this site’s runs.",
      to: `${base}/drafts`,
      linkLabel: "Social drafts",
    },
    {
      label: "Themes & Notion",
      done: notionReady || themeCount > 0,
      hint: "Sync ideas from Notion or manage themes for this project.",
      to: `${base}/themes`,
      linkLabel: "Themes & Notion",
    },
    {
      label: "Automation",
      done: Boolean(autoRow?.auto_weekly_plan || autoRow?.posts_per_week),
      hint: "Weekly planner and auto-review for this website.",
      to: `${base}/automation`,
      linkLabel: "Automation",
    },
    {
      label: "Newsletters",
      done: newsletterCount > 0,
      hint: "Email drafts generated from this project’s brand snapshot.",
      to: `${base}/newsletters`,
      linkLabel: "Newsletters",
    },
    {
      label: "Leads for this site",
      done: leadCount > 0,
      hint: "Leads captured with this project id.",
      to: `${base}/leads`,
      linkLabel: "Leads",
    },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Workspace overview</h2>
      <p className="muted">
        Everything below is scoped to <strong>{rootUrl ?? "this website"}</strong> via the URL — no mixed lists from
        other sites.
      </p>

      <section className="card stack">
        <h3 style={{ marginTop: 0 }}>Refresh crawl &amp; analysis</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          When you change the live site (copy, pricing, layout), run a new crawl so the Brand Bible, QA, and AI themes
          match what visitors see. Uses this project&apos;s saved URL (
          <code style={{ wordBreak: "break-all" }}>{rootUrl ?? "…"}</code>
          ).
        </p>
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="button" className="btn" disabled={analyzeBusy || !rootUrl} onClick={() => void reanalyze()}>
            {analyzeBusy ? "Analyzing…" : "Re-analyze website"}
          </button>
          <Link to={`${base}/brand`} className="btn secondary">
            View Brand Bible
          </Link>
        </div>
        {analyzeErr ? <div className="error">{analyzeErr}</div> : null}
        {analyzeMsg ? <div className="success">{analyzeMsg}</div> : null}
      </section>

      <section className="card stack">
        <h3 style={{ marginTop: 0 }}>Checklist</h3>
        <ul className="checklist-overview">
          {checklist.map((item) => (
            <li key={item.label}>
              <span className={item.done ? "check-done" : "check-todo"} aria-hidden>
                {item.done ? "✓" : "○"}
              </span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted" style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  {item.hint}
                </p>
                <Link to={item.to}>{item.linkLabel}</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
