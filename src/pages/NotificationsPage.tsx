import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiFetch } from "../api";

export function NotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [weeklyLivePostAutomation, setWeeklyLivePostAutomation] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await apiFetch<{
          email_enabled: boolean;
          telegram_enabled: boolean;
          weekly_live_post_automation?: boolean;
          notification_email: string | null;
          telegram_chat_id: string | null;
        }>("/notifications/settings");
        setEmailEnabled(r.email_enabled);
        setTelegramEnabled(r.telegram_enabled);
        setWeeklyLivePostAutomation(Boolean(r.weekly_live_post_automation));
        setNotificationEmail(r.notification_email || "");
        setTelegramChatId(r.telegram_chat_id || "");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/notifications/settings", {
        method: "PUT",
        body: JSON.stringify({
          email_enabled: emailEnabled,
          telegram_enabled: telegramEnabled,
          weekly_live_post_automation: weeklyLivePostAutomation,
          notification_email: notificationEmail || null,
          telegram_chat_id: telegramChatId || null,
        }),
      });
      setMsg("Settings saved.");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  return (
    <div>
      <h1>Notifications</h1>
      <p className="muted">
        When background jobs complete, we can email you and/or message Telegram. The server must have{" "}
        <code>TELEGRAM_BOT_TOKEN</code> and/or SMTP configured in environment variables.
      </p>
      <p className="muted">
        Weekly posting automation is a preference for when your ad campaigns are live: we record it so a future scheduler can
        generate a week of organic posts on your chosen rhythm (not wired to live APIs in this build).
      </p>
      {err ? <div className="error">{err}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      <form className="card stack" onSubmit={onSubmit}>
        <label className="checkbox-row">
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          Email notifications
        </label>
        <label>
          Notification email (optional override)
          <input type="email" value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} />
          Telegram notifications
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={weeklyLivePostAutomation}
            onChange={(e) => setWeeklyLivePostAutomation(e.target.checked)}
          />
          Automate weekly posts while campaigns are live (default for new campaign flows)
        </label>
        <label>
          Telegram chat ID
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="After /start with your bot"
          />
        </label>
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}
