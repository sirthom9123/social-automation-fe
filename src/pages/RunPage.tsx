import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnalysisResults, analysisResultFromRunArtifacts } from "../components/AnalysisResults";
import { GeneratedPackView } from "../components/GeneratedPackView";
import { ApiError, apiFetch } from "../api";

const ARTIFACT_KIND_LABELS: Record<string, string> = {
  brand_snapshot: "Brand snapshot",
  landing_page_qa: "Landing page QA & conversion tips",
  ad_content: "Generated ad copy & briefs",
  ad_content_refined: "Refined ad copy",
  image_prompts: "Image prompts",
  image_prompts_refined: "Refined image prompts",
  video_scripts: "Video script stubs",
  video_scripts_refined: "Refined video scripts",
  user_selection: "Your saved selection",
};

function kindLabel(kind: string): string {
  return ARTIFACT_KIND_LABELS[kind] || kind.replace(/_/g, " ");
}

type ArtifactRow = { id: string; kind: string; created_at: string | null };

export function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [runData, setRunData] = useState<Record<string, unknown> | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineBusy, setRefineBusy] = useState(false);
  const [selPt, setSelPt] = useState<string[]>([]);
  const [selH, setSelH] = useState<string[]>([]);
  const [selB, setSelB] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (!runId) return;
    void loadRun();
  }, [runId]);

  async function loadRun() {
    if (!runId) return;
    setErr(null);
    try {
      const r = await apiFetch<Record<string, unknown>>(
        `/runs/${runId}?include=brand_snapshot,landing_page_qa,ad_content,image_prompts,video_scripts,ad_content_refined,image_prompts_refined,video_scripts_refined`
      );
      setRunData(r);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Failed to load run");
    }
  }

  const projectId =
    runData?.project && typeof runData.project === "object" && runData.project !== null && "id" in runData.project
      ? String((runData.project as { id: string }).id)
      : null;

  const content = (runData?.content as Record<string, unknown> | undefined) || {};
  const analysisBundle = analysisResultFromRunArtifacts(content);
  const hasSnapshot = "brand_snapshot" in content;
  const imagePromptsBlock =
    (content.image_prompts_refined as Record<string, unknown> | undefined) ||
    (content.image_prompts as Record<string, unknown> | undefined) ||
    undefined;
  const videoScriptsBlock =
    (content.video_scripts_refined as Record<string, unknown> | undefined) ||
    (content.video_scripts as Record<string, unknown> | undefined) ||
    undefined;

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!runId || !projectId) return;
    setGenErr(null);
    setGenBusy(true);
    try {
      const out = await apiFetch<Record<string, unknown>>("/generate-assets", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, analyze_run_id: runId }),
      });
      const newRid =
        out.run && typeof out.run === "object" && out.run !== null && "id" in out.run
          ? String((out.run as { id: string }).id)
          : null;
      if (newRid) navigate(`/run/${newRid}`, { replace: true });
    } catch (ex) {
      setGenErr(ex instanceof ApiError ? ex.message : "Generate failed");
    } finally {
      setGenBusy(false);
    }
  }

  async function onRefine(e: FormEvent) {
    e.preventDefault();
    if (!runId) return;
    setRefineBusy(true);
    try {
      await apiFetch(`/runs/${runId}/refine-assets`, {
        method: "POST",
        body: JSON.stringify({ instruction: refineInstruction }),
      });
      setRefineInstruction("");
      await loadRun();
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "Refine failed");
    } finally {
      setRefineBusy(false);
    }
  }

  async function onSaveSelection(e: FormEvent) {
    e.preventDefault();
    if (!runId) return;
    try {
      await apiFetch(`/runs/${runId}/selection`, {
        method: "POST",
        body: JSON.stringify({
          primary_text_ids: selPt,
          headline_ids: selH,
          brief_ids: selB,
          notes,
        }),
      });
      alert("Selection saved.");
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "Save failed");
    }
  }

  const adContentRaw =
    (content.ad_content_refined as Record<string, unknown> | undefined) ||
    (content.ad_content as Record<string, unknown> | undefined);

  const imgLen = (imagePromptsBlock as { image_prompts?: unknown[] } | undefined)?.image_prompts?.length ?? 0;
  const vidLen = (videoScriptsBlock as { video_scripts?: unknown[] } | undefined)?.video_scripts?.length ?? 0;
  const hasPackArtifacts = !!adContentRaw || imgLen > 0 || vidLen > 0;

  const artifacts = (runData?.artifacts as ArtifactRow[] | undefined) || [];

  if (err) return <div className="error">{err}</div>;
  if (!runData) return <div className="muted">Loading…</div>;

  return (
    <div>
      <p>
        <Link to={projectId ? `/project/${projectId}/overview` : "/"}>← Workspace</Link>
      </p>
      <h1>Run</h1>
      <p className="muted">Run ID: {runId}</p>

      {analysisBundle ? (
        <section className="run-section">
          <h2 className="run-section-title">Your analysis</h2>
          <p className="muted run-section-lead">Same readable report as on the Analyze page—review before generating ads.</p>
          <AnalysisResults result={analysisBundle} />
        </section>
      ) : null}

      {!hasSnapshot ? (
        <p className="muted card">This run has no saved analysis snapshot (open an analyze run, or generate from a project that was analyzed).</p>
      ) : (
        <div className="card stack">
          <p>Ready to create ads from this analysis? Generate copy, prompts, and script stubs:</p>
          <form onSubmit={onGenerate}>
            <button className="btn secondary" type="submit" disabled={genBusy}>
              {genBusy ? "Generating…" : "Generate assets"}
            </button>
            {genErr ? <div className="error">{genErr}</div> : null}
          </form>
        </div>
      )}

      {hasPackArtifacts ? (
        <section className="run-section">
          <h2 className="run-section-title">Generated pack</h2>
          <p className="muted run-section-lead">Copy, briefs, image prompts, and video script stubs—laid out for easy reading.</p>
          <div className="card">
            <GeneratedPackView
              adContent={adContentRaw || null}
              imagePromptsBlock={imagePromptsBlock}
              videoScriptsBlock={videoScriptsBlock}
            />
          </div>
        </section>
      ) : null}

      {adContentRaw ? (
        <div className="card stack">
          <h2>Review &amp; refine</h2>
          <p className="muted">Ask the AI to adjust tone or length. Refine runs on this run if it already has generated copy.</p>
          <form className="stack" onSubmit={onRefine}>
            <label>
              What would you like to change?
              <textarea value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} required />
            </label>
            <button className="btn secondary" type="submit" disabled={refineBusy}>
              {refineBusy ? "Refining…" : "Refine copy"}
            </button>
          </form>

          <form className="stack" onSubmit={onSaveSelection}>
            <h3>Save your picks</h3>
            <p className="muted">List the ids you want to keep (from the cards above), or only save notes.</p>
            <label>
              Primary text ids
              <input
                type="text"
                placeholder="pt1, pt2"
                value={selPt.join(", ")}
                onChange={(e) =>
                  setSelPt(
                    e.target.value
                      .split(/[,\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Headline ids
              <input
                type="text"
                value={selH.join(", ")}
                onChange={(e) =>
                  setSelH(
                    e.target.value
                      .split(/[,\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Brief ids
              <input
                type="text"
                value={selB.join(", ")}
                onChange={(e) =>
                  setSelB(
                    e.target.value
                      .split(/[,\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button className="btn" type="submit">
              Save selection
            </button>
          </form>
        </div>
      ) : null}

      <section className="run-section">
        <h2 className="run-section-title">What&apos;s stored on this run</h2>
        {artifacts.length === 0 ? (
          <p className="muted">No artifacts listed.</p>
        ) : (
          <ul className="artifact-summary">
            {artifacts.map((a) => (
              <li key={a.id}>
                <strong>{kindLabel(a.kind)}</strong>
                <span className="muted artifact-when">{a.created_at ? ` · ${a.created_at}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="analysis-raw-toggle">
        <button type="button" className="btn ghost small" onClick={() => setShowTechnical(!showTechnical)}>
          {showTechnical ? "Hide" : "Show"} technical payload (advanced)
        </button>
        {showTechnical ? (
          <pre className="json-view analysis-raw-json">{JSON.stringify(content, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}
