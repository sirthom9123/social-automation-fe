import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api";

export function PublishPage() {
  const [platform, setPlatform] = useState<"facebook" | "tiktok">("facebook");
  const [campaignName, setCampaignName] = useState("Test campaign");
  const [objective, setObjective] = useState("TRAFFIC");
  const [out, setOut] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    setOut(null);
    const path = platform === "facebook" ? "/publish/facebook" : "/publish/tiktok";
    const body =
      platform === "facebook"
        ? { campaign_name: campaignName, objective }
        : { campaign_name: campaignName };
    try {
      const r = await apiFetch<Record<string, unknown>>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOut(r);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Publish request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Publish (stub)</h1>
      <p className="muted">Calls the API with your draft intent. Real Meta/TikTok publishing is not implemented yet.</p>
      {err ? <div className="error">{err}</div> : null}

      <form className="card stack" onSubmit={onSubmit}>
        <label>
          Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value as "facebook" | "tiktok")}>
            <option value="facebook">Facebook / Meta</option>
            <option value="tiktok">TikTok</option>
          </select>
        </label>
        <label>
          Campaign name
          <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
        </label>
        {platform === "facebook" ? (
          <label>
            Objective (placeholder)
            <input type="text" value={objective} onChange={(e) => setObjective(e.target.value)} />
          </label>
        ) : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send to publish endpoint"}
        </button>
      </form>

      {out ? (
        <div className="card">
          <h2>Response</h2>
          <div className="json-view">{JSON.stringify(out, null, 2)}</div>
        </div>
      ) : null}
    </div>
  );
}
