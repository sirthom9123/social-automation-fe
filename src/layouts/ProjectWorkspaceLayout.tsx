import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { apiFetch } from "../api";

export function ProjectWorkspaceLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const [rootUrl, setRootUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await apiFetch<{ project: { root_url: string } }>(`/projects/${projectId}`);
        if (!cancelled) setRootUrl(r.project.root_url);
      } catch {
        if (!cancelled) setRootUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return null;

  const base = `/project/${projectId}`;

  return (
    <div className="project-workspace">
      <div className="project-workspace-head">
        <h1 style={{ marginBottom: "0.25rem" }}>{rootUrl ?? "Website workspace"}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          <Link to="/">← All websites</Link>
        </p>
      </div>
      <nav className="project-subnav" aria-label="Website sections">
        <NavLink end className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/overview`}>
          Overview
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/brand`}>
          Brand Bible
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/drafts`}>
          Social drafts
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/themes`}>
          Themes &amp; Notion
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/newsletters`}>
          Newsletters
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/leads`}>
          Leads
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/schedule`}>
          Schedule
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/automation`}>
          Automation
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "active" : "")} to={`${base}/flow`}>
          Campaign flow
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
