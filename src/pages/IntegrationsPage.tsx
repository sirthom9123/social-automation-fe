import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api";

type EncryptionInfo = {
  scheme: string;
  algorithm: string;
  key_source_env: string;
  key_source_fallback: string;
};

type IntegrationResponse<K extends string, V extends Record<string, string>> = {
  configured: boolean;
  scope: string;
  project_id: string | null;
  updated_at: string | null;
  encryption?: EncryptionInfo;
} & { [P in K]: V };

type ProjectBrief = { id: string; slug: string; root_url: string };

type MetaView = { access_token: string; ad_account_id: string; page_id: string };
type TiktokView = { access_token: string; advertiser_id: string };
type LinkedinView = { access_token: string; organization_urn: string };

type IntegrationsOverview = {
  integrations: Record<
    "meta" | "tiktok" | "linkedin" | "notion" | "google_sheets",
    Array<{
      scope: "user" | "project";
      project_id: string | null;
      project_slug: string | null;
      updated_at: string | null;
      view: Record<string, string>;
    }>
  >;
  encryption?: EncryptionInfo;
};

const PROJECT_QS = (pid: string | null) => (pid ? `?project_id=${encodeURIComponent(pid)}` : "");

export function IntegrationsPage() {
  const [projects, setProjects] = useState<ProjectBrief[]>([]);
  const [scope, setScope] = useState<string | null>(null); // null = user default
  const [meta, setMeta] = useState<MetaView>({ access_token: "", ad_account_id: "", page_id: "" });
  const [tiktok, setTiktok] = useState<TiktokView>({ access_token: "", advertiser_id: "" });
  const [linkedin, setLinkedin] = useState<LinkedinView>({
    access_token: "",
    organization_urn: "",
  });
  const [metaState, setMetaState] = useState<{ configured: boolean; scope: string }>({
    configured: false,
    scope: "none",
  });
  const [tiktokState, setTiktokState] = useState<{ configured: boolean; scope: string }>({
    configured: false,
    scope: "none",
  });
  const [linkedinState, setLinkedinState] = useState<{ configured: boolean; scope: string }>({
    configured: false,
    scope: "none",
  });
  const [encryption, setEncryption] = useState<EncryptionInfo | null>(null);
  const [overview, setOverview] = useState<IntegrationsOverview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const qs = useMemo(() => PROJECT_QS(scope), [scope]);

  const loadProjects = useCallback(async () => {
    try {
      const r = await apiFetch<{ projects: ProjectBrief[] }>("/projects?limit=200");
      setProjects(r.projects);
    } catch {
      /* ignore */
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const o = await apiFetch<IntegrationsOverview>("/integrations");
      setOverview(o);
      if (o.encryption) setEncryption(o.encryption);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPlatforms = useCallback(async () => {
    try {
      const m = await apiFetch<IntegrationResponse<"meta", MetaView>>(`/integrations/meta${qs}`);
      setMetaState({ configured: m.configured, scope: m.scope });
      if (m.configured) {
        setMeta((prev) => ({
          ...prev,
          ad_account_id: m.meta.ad_account_id || "",
          page_id: m.meta.page_id || "",
        }));
      } else {
        setMeta({ access_token: "", ad_account_id: "", page_id: "" });
      }
      if (m.encryption) setEncryption(m.encryption);

      const t = await apiFetch<IntegrationResponse<"tiktok", TiktokView>>(`/integrations/tiktok${qs}`);
      setTiktokState({ configured: t.configured, scope: t.scope });
      if (t.configured) {
        setTiktok((prev) => ({ ...prev, advertiser_id: t.tiktok.advertiser_id || "" }));
      } else {
        setTiktok({ access_token: "", advertiser_id: "" });
      }

      const li = await apiFetch<IntegrationResponse<"linkedin", LinkedinView>>(
        `/integrations/linkedin${qs}`,
      );
      setLinkedinState({ configured: li.configured, scope: li.scope });
      if (li.configured) {
        setLinkedin((prev) => ({
          ...prev,
          organization_urn: li.linkedin.organization_urn || "",
        }));
      } else {
        setLinkedin({ access_token: "", organization_urn: "" });
      }
    } catch {
      /* ignore */
    }
  }, [qs]);

  useEffect(() => {
    void loadProjects();
    void loadOverview();
  }, [loadProjects, loadOverview]);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  async function save(
    platform: "meta" | "tiktok" | "linkedin",
    body: Record<string, string>,
  ): Promise<void> {
    setErr(null);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = { ...body };
      if (scope) payload.project_id = scope;
      await apiFetch(`/integrations/${platform}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMsg(
        `${platform} credentials saved at ${scope ? "project" : "user"} scope (encrypted at rest).`,
      );
      await Promise.all([loadPlatforms(), loadOverview()]);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  async function remove(platform: "meta" | "tiktok" | "linkedin") {
    setErr(null);
    setMsg(null);
    if (!confirm(`Remove ${scope ? "project" : "user"}-scoped ${platform} credentials?`)) return;
    try {
      await apiFetch(`/integrations/${platform}${qs}`, { method: "DELETE" });
      setMsg(`${platform} credentials removed.`);
      await Promise.all([loadPlatforms(), loadOverview()]);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Delete failed");
    }
  }

  return (
    <div>
      <h1>Integrations</h1>
      <p className="muted">
        Store Meta, TikTok and LinkedIn API credentials. Values are stored encrypted at rest and only masked
        tokens are ever returned by the API. Each site you analyze can have its own page/account — pick the
        project from the scope selector to override the user default.
      </p>
      {encryption ? (
        <div className="card" style={{ borderLeft: "4px solid #22c55e" }}>
          <strong>Encryption:</strong> {encryption.scheme} ({encryption.algorithm}). Key source:{" "}
          <code>{encryption.key_source_env}</code> env or derived from{" "}
          <code>{encryption.key_source_fallback}</code>.
        </div>
      ) : null}
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <section className="card stack">
        <h2>Credential scope</h2>
        <label>
          Edit credentials for:
          <select value={scope ?? ""} onChange={(e) => setScope(e.target.value || null)}>
            <option value="">User default (applies to every project without an override)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.slug} — {p.root_url}
              </option>
            ))}
          </select>
        </label>
      </section>

      <IntegrationCard
        title="Meta (Facebook + Instagram)"
        state={metaState}
        onRemove={() => void remove("meta")}
        onSubmit={(e) => {
          e.preventDefault();
          void save("meta", meta);
        }}
      >
        <Input
          label="Access token"
          type="password"
          value={meta.access_token}
          onChange={(v) => setMeta({ ...meta, access_token: v })}
          placeholder="Paste new token to replace"
        />
        <Input
          label="Ad account ID"
          value={meta.ad_account_id}
          onChange={(v) => setMeta({ ...meta, ad_account_id: v })}
          placeholder="act_..."
        />
        <Input
          label="Page ID"
          value={meta.page_id}
          onChange={(v) => setMeta({ ...meta, page_id: v })}
        />
      </IntegrationCard>

      <IntegrationCard
        title="TikTok"
        state={tiktokState}
        onRemove={() => void remove("tiktok")}
        onSubmit={(e) => {
          e.preventDefault();
          void save("tiktok", tiktok);
        }}
      >
        <Input
          label="Access token"
          type="password"
          value={tiktok.access_token}
          onChange={(v) => setTiktok({ ...tiktok, access_token: v })}
          placeholder="Paste new token to replace"
        />
        <Input
          label="Advertiser ID"
          value={tiktok.advertiser_id}
          onChange={(v) => setTiktok({ ...tiktok, advertiser_id: v })}
        />
      </IntegrationCard>

      <IntegrationCard
        title="LinkedIn (organic only)"
        state={linkedinState}
        onRemove={() => void remove("linkedin")}
        onSubmit={(e) => {
          e.preventDefault();
          void save("linkedin", linkedin);
        }}
        description="Used for organic UGC posts. Create a LinkedIn developer app with Marketing / UGC permissions."
      >
        <Input
          label="Access token"
          type="password"
          value={linkedin.access_token}
          onChange={(v) => setLinkedin({ ...linkedin, access_token: v })}
          placeholder="Paste new token to replace"
        />
        <Input
          label="Organization URN (optional)"
          value={linkedin.organization_urn}
          onChange={(v) => setLinkedin({ ...linkedin, organization_urn: v })}
          placeholder="urn:li:organization:123"
        />
      </IntegrationCard>

      {overview ? <Overview overview={overview} /> : null}
    </div>
  );
}

function IntegrationCard(props: {
  title: string;
  description?: string;
  state: { configured: boolean; scope: string };
  onRemove: () => void;
  onSubmit: (e: FormEvent) => void;
  children: React.ReactNode;
}) {
  const badge =
    props.state.scope === "project"
      ? { text: "project-scoped", color: "#22c55e" }
      : props.state.scope === "user"
        ? { text: "user default (fallback)", color: "#3b82f6" }
        : { text: "not configured", color: "#6b7280" };
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{props.title}</h2>
        <span
          style={{
            background: badge.color,
            color: "white",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
          }}
        >
          {badge.text}
        </span>
      </div>
      {props.description ? <p className="muted">{props.description}</p> : null}
      <form className="stack" onSubmit={props.onSubmit}>
        {props.children}
        <div className="row">
          <button className="btn" type="submit">
            Save
          </button>
          {props.state.configured ? (
            <button className="btn ghost" type="button" onClick={props.onRemove}>
              Remove this scope
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {props.label}
      <input
        type={props.type || "text"}
        autoComplete={props.type === "password" ? "off" : undefined}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </label>
  );
}

function Overview({ overview }: { overview: IntegrationsOverview }) {
  const platforms = Object.keys(overview.integrations) as Array<keyof typeof overview.integrations>;
  return (
    <section className="card stack">
      <h2>Configured credentials (all scopes)</h2>
      {platforms.every((p) => overview.integrations[p].length === 0) ? (
        <p className="muted">No credentials stored yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #2a3544" }}>
              <th>Platform</th>
              <th>Scope</th>
              <th>Project</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {platforms.flatMap((platform) =>
              overview.integrations[platform].map((row, i) => (
                <tr
                  key={`${platform}-${row.project_id ?? "default"}-${i}`}
                  style={{ borderBottom: "1px solid #1e2733" }}
                >
                  <td>{platform}</td>
                  <td>{row.scope}</td>
                  <td>{row.project_slug || (row.project_id ? row.project_id : "default")}</td>
                  <td>{row.updated_at?.slice(0, 19).replace("T", " ") || "—"}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
