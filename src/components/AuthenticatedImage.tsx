import { useEffect, useState } from "react";
import { API_BASE, getToken } from "../api";

type Props = {
  urlPath: string;
  alt: string;
  className?: string;
};

/**
 * Loads a protected /media/... URL with Bearer auth via blob URL (img cannot send headers).
 */
export function AuthenticatedImage({ urlPath, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    setSrc(null);
    setErr(null);
    const path = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
    const token = getToken();
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          setErr(res.status === 404 ? "Image not found" : "Could not load image");
          return;
        }
        const blob = await res.blob();
        const u = URL.createObjectURL(blob);
        revoked = u;
        setSrc(u);
      } catch {
        setErr("Could not load image");
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [urlPath]);

  if (err) {
    return <div className="media-thumb-err">{err}</div>;
  }
  if (!src) {
    return <div className="media-thumb-loading muted">Loading…</div>;
  }
  return <img className={className ?? "media-thumb-img"} src={src} alt={alt} />;
}
