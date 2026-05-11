import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";
import type { JobRow } from "../hooks/useBackgroundJob";

const POLL_MS = 4000;
const KEY_PREFIX = "bg-job-";

function discoverActiveKeys(): { key: string; jobId: string }[] {
  const entries: { key: string; jobId: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        const jobId = localStorage.getItem(key);
        if (jobId) entries.push({ key, jobId });
      }
    }
  } catch {
    /* storage unavailable */
  }
  return entries;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "#6b7280",
  running: "#2563eb",
  completed: "#16a34a",
  failed: "#dc2626",
};

const bannerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
  padding: "8px 16px",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: "13px",
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
};

const chipStyle = (_status?: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "3px 10px",
  borderRadius: "6px",
  background: "rgba(255,255,255,0.08)",
});

const dotStyle = (status: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  backgroundColor: STATUS_COLORS[status] ?? "#6b7280",
  animation: status === "running" ? "bgJobPulse 1.2s ease-in-out infinite" : undefined,
});

type TrackedJob = {
  key: string;
  jobId: string;
  data: JobRow | null;
};

export function ActiveJobsBanner() {
  const [tracked, setTracked] = useState<TrackedJob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const entries = discoverActiveKeys();
    if (entries.length === 0) {
      setTracked([]);
      return;
    }

    const results = await Promise.all(
      entries.map(async ({ key, jobId }) => {
        try {
          const data = await apiFetch<JobRow>(`/jobs/${jobId}`);
          if (data.status === "completed" || data.status === "failed") {
            try { localStorage.removeItem(key); } catch { /* noop */ }
          }
          return { key, jobId, data };
        } catch {
          return { key, jobId, data: null };
        }
      }),
    );

    const active = results.filter(
      (r) => r.data === null || r.data.status === "queued" || r.data.status === "running",
    );
    setTracked(active);
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  if (tracked.length === 0) return null;

  return (
    <>
      <style>{`@keyframes bgJobPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }`}</style>
      <div style={bannerStyle}>
        <span style={{ fontWeight: 600, marginRight: 4 }}>Background jobs:</span>
        {tracked.map((t) => (
          <span key={t.jobId} style={chipStyle(t.data?.status ?? "queued")}>
            <span style={dotStyle(t.data?.status ?? "queued")} />
            <span>{t.data?.job_type ?? t.jobId.slice(0, 8)}</span>
            <span style={{ opacity: 0.6 }}>{t.data?.status ?? "polling\u2026"}</span>
          </span>
        ))}
      </div>
    </>
  );
}
