import type { ReactNode } from "react";

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function RiskBadge({ risk }: { risk: unknown }) {
  const r = typeof risk === "string" ? risk.toLowerCase() : "";
  const ok = r === "ok" || r === "";
  return (
    <span className={`gen-risk ${ok ? "ok" : "verify"}`} title="Risk level">
      {ok ? "Looks grounded" : "Verify on live site"}
    </span>
  );
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="analysis-details gen-collapsible">
      <summary>{title}</summary>
      <div className="analysis-details-body">{children}</div>
    </details>
  );
}

type AdContent = Record<string, unknown>;

function resolveImageList(
  imagePrompts: unknown[] | undefined,
  imagePromptsBlock: Record<string, unknown> | null | undefined
): unknown[] {
  if (Array.isArray(imagePrompts) && imagePrompts.length > 0) return imagePrompts;
  const raw = imagePromptsBlock?.image_prompts;
  return Array.isArray(raw) ? raw : [];
}

function resolveVideoList(
  videoScripts: unknown[] | undefined,
  videoScriptsBlock: Record<string, unknown> | null | undefined
): unknown[] {
  if (Array.isArray(videoScripts) && videoScripts.length > 0) return videoScripts;
  const raw = videoScriptsBlock?.video_scripts;
  return Array.isArray(raw) ? raw : [];
}

export type GeneratedPackViewProps = {
  /** `ad_content` object from generate API or artifact. */
  adContent: AdContent | null | undefined;
  /** Artifact shape `{ image_prompts: [...] }` */
  imagePromptsBlock?: Record<string, unknown> | null;
  /** Artifact shape `{ video_scripts: [...] }` */
  videoScriptsBlock?: Record<string, unknown> | null;
  /** Direct arrays (same as `/generate-assets` JSON top-level `image_prompts` / `video_scripts`). */
  imagePrompts?: unknown[] | null;
  videoScripts?: unknown[] | null;
};

/**
 * Human-readable generated pack: copy, briefs, image prompts, video script stubs.
 * Shows whichever parts exist (e.g. prompts-only after partial load).
 */
export function GeneratedPackView({
  adContent,
  imagePromptsBlock,
  videoScriptsBlock,
  imagePrompts: imagePromptsDirect,
  videoScripts: videoScriptsDirect,
}: GeneratedPackViewProps) {
  const hasAdObject = adContent !== null && adContent !== undefined && typeof adContent === "object";
  const primary = hasAdObject ? asArr(adContent!.meta_primary_text) : [];
  const headlines = hasAdObject ? asArr(adContent!.headlines_and_ctas) : [];
  const briefs = hasAdObject ? asArr(adContent!.creative_briefs) : [];

  const imgList = resolveImageList(
    imagePromptsDirect === null || imagePromptsDirect === undefined ? undefined : (imagePromptsDirect as unknown[]),
    imagePromptsBlock
  );
  const vidList = resolveVideoList(
    videoScriptsDirect === null || videoScriptsDirect === undefined ? undefined : (videoScriptsDirect as unknown[]),
    videoScriptsBlock
  );

  const hasCopy =
    hasAdObject && (primary.length > 0 || headlines.length > 0 || briefs.length > 0);
  const hasAnything = hasCopy || imgList.length > 0 || vidList.length > 0;

  if (!hasAnything) {
    return <p className="analysis-muted">No generated assets to show yet.</p>;
  }

  return (
    <div className="gen-pack analysis-flow">
      {hasAdObject && hasCopy ? (
        <>
          <section className="analysis-section">
            <h3 className="gen-pack-heading">Primary text options</h3>
            <p className="analysis-section-lead">Short lines you might use as post body or ad text.</p>
            <ul className="gen-copy-list">
              {primary.map((row, i) => {
                  const o = asObj(row);
                  const id = typeof o.id === "string" ? o.id : `pt-${i}`;
                  const text = typeof o.text === "string" ? o.text : String(row);
                  const pillar = typeof o.pillar === "string" ? o.pillar : null;
                  return (
                    <li key={id} className="gen-copy-card">
                      <div className="gen-copy-meta">
                        <span className="gen-id">{id}</span>
                        {pillar ? <span className="gen-pillar">{pillar}</span> : null}
                        <RiskBadge risk={o.risk} />
                      </div>
                      <p className="gen-copy-text">{text}</p>
                    </li>
                  );
                })}
            </ul>
          </section>

          <section className="analysis-section">
            <h3 className="gen-pack-heading">Headlines &amp; CTAs</h3>
            <ul className="gen-copy-list">
              {headlines.map((row, i) => {
                  const o = asObj(row);
                  const id = typeof o.id === "string" ? o.id : `h-${i}`;
                  const headline = typeof o.headline === "string" ? o.headline : "";
                  const cta = typeof o.cta === "string" ? o.cta : "";
                  return (
                    <li key={id} className="gen-copy-card">
                      <div className="gen-copy-meta">
                        <span className="gen-id">{id}</span>
                        <RiskBadge risk={o.risk} />
                      </div>
                      <p className="gen-headline">{headline}</p>
                      {cta ? (
                        <p className="gen-cta">
                          <span className="analysis-label">Suggested CTA</span> {cta}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </section>

          <section className="analysis-section">
            <h3 className="gen-pack-heading">Creative briefs</h3>
            {briefs.map((row, i) => {
                const o = asObj(row);
                const id = typeof o.id === "string" ? o.id : `cb-${i}`;
                const hook = typeof o.hook === "string" ? o.hook : "";
                const format = typeof o.format === "string" ? o.format : "";
                const visual = typeof o.visual_direction === "string" ? o.visual_direction : "";
                const landing = typeof o.landing === "string" ? o.landing : "";
                return (
                  <Collapsible key={id} title={`${id}${format ? ` · ${format}` : ""}`}>
                    {hook ? (
                      <p>
                        <span className="analysis-label">Hook</span> {hook}
                      </p>
                    ) : null}
                    {visual ? (
                      <p className="gen-brief-visual">
                        <span className="analysis-label">Visual direction</span> {visual}
                      </p>
                    ) : null}
                    {landing ? (
                      <p>
                        <span className="analysis-label">Landing</span> {landing}
                      </p>
                    ) : null}
                  </Collapsible>
                );
              })}
          </section>
        </>
      ) : hasAdObject && !hasCopy ? (
        <p className="analysis-muted">No primary text, headlines, or briefs in this response—see image or video sections if shown below.</p>
      ) : null}

      {imgList.length > 0 ? (
        <section className="analysis-section">
          <h3 className="gen-pack-heading">Image prompts</h3>
          <p className="analysis-section-lead">Prompts for designers or image tools—review before use.</p>
          {imgList.map((row, i) => {
            const o = asObj(row);
            const id = typeof o.id === "string" ? o.id : `img-${i}`;
            const prompt = typeof o.prompt === "string" ? o.prompt : "";
            return (
              <Collapsible key={id} title={id}>
                <pre className="analysis-prose gen-prompt-pre">{prompt}</pre>
              </Collapsible>
            );
          })}
        </section>
      ) : null}

      {vidList.length > 0 ? (
        <section className="analysis-section">
          <h3 className="gen-pack-heading">Video script stubs</h3>
          <p className="analysis-section-lead">Beat-by-beat outline for short vertical video—edit to match your brand.</p>
          {vidList.map((row, i) => {
            const o = asObj(row);
            const id = typeof o.id === "string" ? o.id : `vid-${i}`;
            const duration = o.duration_seconds;
            const aspect = typeof o.aspect_ratio === "string" ? o.aspect_ratio : "";
            const landing = typeof o.landing_page === "string" ? o.landing_page : "";
            const scenes = asArr(o.scenes);
            const durLabel = typeof duration === "number" ? `${duration}s` : "";
            const title = [id, durLabel, aspect].filter(Boolean).join(" · ");
            return (
              <Collapsible key={id} title={title || id}>
                {landing ? (
                  <p className="gen-video-landing">
                    <span className="analysis-label">Landing page</span> {landing}
                  </p>
                ) : null}
                {scenes.length === 0 ? (
                  <p className="analysis-muted">No scenes listed.</p>
                ) : (
                  <ol className="gen-scene-list">
                    {scenes.map((sc, j) => {
                      const s = asObj(sc);
                      const t = typeof s.t === "string" ? s.t : `Part ${j + 1}`;
                      const purpose = typeof s.purpose === "string" ? s.purpose : "";
                      const dialogue = typeof s.dialogue === "string" ? s.dialogue : "";
                      const onScreen = typeof s.on_screen_text === "string" ? s.on_screen_text : "";
                      return (
                        <li key={j} className="gen-scene-card">
                          <div className="gen-scene-time">{t}</div>
                          {purpose ? (
                            <div className="gen-scene-purpose">
                              <span className="analysis-label">{purpose}</span>
                            </div>
                          ) : null}
                          {dialogue ? <p className="gen-scene-dialogue">{dialogue}</p> : null}
                          {onScreen ? (
                            <p className="gen-scene-ost">
                              <span className="analysis-label">On screen</span> “{onScreen}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Collapsible>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
