import { AnalysisResults } from "./AnalysisResults";
import { GeneratedPackView } from "./GeneratedPackView";

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function PublishStubCard({ stub }: { stub: Record<string, unknown> }) {
  const status = typeof stub.status === "string" ? stub.status : "";
  const platform = typeof stub.platform === "string" ? stub.platform : "publish";
  const nextSteps = Array.isArray(stub.next_steps) ? (stub.next_steps as string[]) : [];
  return (
    <section className="run-section">
      <h3 className="run-section-title">Publish (preview)</h3>
      <p className="muted run-section-lead">This step does not create live ads yet—it records what would be sent later.</p>
      <div className="analysis-card tip" style={{ marginTop: "0.5rem" }}>
        <span className="analysis-card-icon" aria-hidden>
          ↗
        </span>
        <div>
          <p>
            <strong>{platform}</strong>
            {status ? (
              <>
                {" "}
                · <span className="analysis-label">Status</span> {status}
              </>
            ) : null}
          </p>
          {nextSteps.length > 0 ? (
            <ol className="analysis-list" style={{ marginTop: "0.5rem" }}>
              {nextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type Props = {
  jobType: string;
  resultJson: Record<string, unknown> | null | undefined;
};

/**
 * Renders analyze / generate / stub publish from a completed background job (`result_json`).
 */
export function PipelineJobResult({ jobType, resultJson }: Props) {
  if (!resultJson || typeof resultJson !== "object") {
    return <p className="analysis-muted">No result payload yet.</p>;
  }

  const r = resultJson;

  if (jobType === "analyze_only") {
    const res = asObj(r);
    return (
      <AnalysisResults
        result={{
          brand_snapshot: asObj(res.brand_snapshot),
          qa: asObj(res.qa),
          analysis_meta: asObj(res.analysis_meta),
        }}
      />
    );
  }

  if (jobType === "generate_only") {
    const res = asObj(r);
    return (
      <GeneratedPackView
        adContent={asObj(res.ad_content)}
        imagePrompts={pickOptArray(res.image_prompts)}
        videoScripts={pickOptArray(res.video_scripts)}
      />
    );
  }

  if (jobType === "full_pipeline" || jobType === "url_analyze_generate") {
    const analyze = asObj(r.analyze);
    const gen = asObj(r.generate);
    const stub = r.publish_stub !== undefined ? asObj(r.publish_stub) : null;
    const showPublish = jobType === "full_pipeline";

    return (
      <div className="pipeline-job-stack">
        {Object.keys(analyze).length > 0 ? (
          <section className="run-section">
            <h3 className="run-section-title">Step 1 — Analysis</h3>
            <AnalysisResults
              result={{
                brand_snapshot: asObj(analyze.brand_snapshot),
                qa: asObj(analyze.qa),
                analysis_meta: asObj(analyze.analysis_meta),
              }}
            />
          </section>
        ) : null}

        {Object.keys(gen).length > 0 ? (
          <section className="run-section">
            <h3 className="run-section-title">Step 2 — Generated assets</h3>
            <p className="muted run-section-lead">Copy, briefs, prompts, and video stubs—same view as on a run page.</p>
            <div className="card">
              <GeneratedPackView
                adContent={asObj(gen.ad_content)}
                imagePrompts={pickOptArray(gen.image_prompts)}
                videoScripts={pickOptArray(gen.video_scripts)}
              />
            </div>
          </section>
        ) : null}

        {showPublish && stub && Object.keys(stub).length > 0 ? <PublishStubCard stub={stub} /> : null}
      </div>
    );
  }

  if (jobType === "create_media") {
    const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
    return (
      <section className="run-section">
        <h3 className="run-section-title">Generated images</h3>
        <p className="muted">{items.length} file(s) processed.</p>
        <ul className="analysis-list">
          {items.map((it) => (
            <li key={String(it.prompt_id)}>
              <strong>{String(it.prompt_id)}</strong>
              {it.error ? <span className="error"> — {String(it.error)}</span> : <span className="success"> — saved</span>}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return <p className="analysis-muted">Unsupported job type for rich view.</p>;
}

function pickOptArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}
