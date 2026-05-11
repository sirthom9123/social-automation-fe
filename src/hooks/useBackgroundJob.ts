import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";

type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobRow = {
  id: string;
  status: JobStatus;
  job_type: string;
  result_json: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type UseBackgroundJobOptions = {
  storageKey: string;
  pollIntervalMs?: number;
  onComplete?: (job: JobRow) => void;
  onError?: (job: JobRow) => void;
};

const TERMINAL_STATUSES: JobStatus[] = ["completed", "failed"];

function readStoredJobId(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredJobId(key: string, jobId: string): void {
  try {
    localStorage.setItem(key, jobId);
  } catch {
    /* storage full or unavailable */
  }
}

function removeStoredJobId(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function useBackgroundJob(opts: UseBackgroundJobOptions) {
  const { storageKey, pollIntervalMs = 3000, onComplete, onError } = opts;

  const [jobId, setJobId] = useState<string | null>(() =>
    readStoredJobId(storageKey),
  );
  const [job, setJob] = useState<JobRow | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef({ onComplete, onError });
  callbacksRef.current = { onComplete, onError };

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(
    async (id: string) => {
      try {
        const data = await apiFetch<JobRow>(`/jobs/${id}`);
        setJob(data);

        if (TERMINAL_STATUSES.includes(data.status)) {
          stopPolling();
          removeStoredJobId(storageKey);

          if (data.status === "completed") {
            callbacksRef.current.onComplete?.(data);
          } else {
            callbacksRef.current.onError?.(data);
          }
        }
      } catch {
        /* network blip — keep polling, next tick will retry */
      }
    },
    [storageKey, stopPolling],
  );

  const beginPolling = useCallback(
    (id: string) => {
      stopPolling();
      setIsPolling(true);
      poll(id);
      intervalRef.current = setInterval(() => poll(id), pollIntervalMs);
    },
    [poll, pollIntervalMs, stopPolling],
  );

  const startJob = useCallback(
    (id: string) => {
      writeStoredJobId(storageKey, id);
      setJobId(id);
      setJob(null);
      beginPolling(id);
    },
    [storageKey, beginPolling],
  );

  const clearJob = useCallback(() => {
    stopPolling();
    removeStoredJobId(storageKey);
    setJobId(null);
    setJob(null);
  }, [storageKey, stopPolling]);

  useEffect(() => {
    const stored = readStoredJobId(storageKey);
    if (stored) {
      setJobId(stored);
      beginPolling(stored);
    }
    return stopPolling;
  }, [storageKey, beginPolling, stopPolling]);

  return { jobId, job, startJob, isPolling, clearJob } as const;
}
