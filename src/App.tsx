import { Link, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./auth";
import { ProjectWorkspaceLayout } from "./layouts/ProjectWorkspaceLayout";
import { AutomationPage } from "./pages/AutomationPage";
import { CampaignFlowPage } from "./pages/CampaignFlowPage";
import { DraftsPage } from "./pages/DraftsPage";
import { HomePage } from "./pages/HomePage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewsletterPage } from "./pages/NewsletterPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ProjectBrandPage } from "./pages/ProjectBrandPage";
import { ProjectOverviewPage } from "./pages/ProjectOverviewPage";
import { PublishPage } from "./pages/PublishPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RunPage } from "./pages/RunPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ThemesPage } from "./pages/ThemesPage";
import "./index.css";

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <header className="header">
        <div className="brand">Marketing automation</div>
        <nav className="nav">
          <Link to="/">Websites</Link>
          <Link to="/onboarding">Onboarding</Link>
          <Link to="/integrations">Integrations</Link>
          <Link to="/notifications">Notifications</Link>
          <Link to="/publish">Publish</Link>
        </nav>
        <div className="user">
          <span className="email">{user?.email}</span>
          <button type="button" className="btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);
  if (loading) {
    return (
      <div className="center muted" style={{ padding: "3rem" }}>
        Loading…
      </div>
    );
  }
  if (!user) return null;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/project/:projectId" element={<ProjectWorkspaceLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ProjectOverviewPage />} />
            <Route path="brand" element={<ProjectBrandPage />} />
            <Route path="drafts" element={<DraftsPage />} />
            <Route path="themes" element={<ThemesPage />} />
            <Route path="newsletters" element={<NewsletterPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="automation" element={<AutomationPage />} />
            <Route path="flow" element={<CampaignFlowPage />} />
          </Route>
          <Route path="/run/:runId" element={<RunPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/flow" element={<CampaignFlowPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/newsletters" element={<NewsletterPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
