import { useState } from "react";
import type { ReactNode } from "react";

type Tab = "snapshot" | "qa" | "meta";

const INNOVATION_LABELS: Record<string, string> = {
  contrarian_angle: "A different angle to try",
  story_arcs_for_short_video: "Story ideas for short video",
  pattern_interrupt_hooks: "Pattern-interrupt hooks",
  landing_page_experiments: "Landing page experiments to try",
  psychology_friction_map: "Psychology & friction",
  blind_spots: "Blind spots",
  note: "Note",
};

function titleCaseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function asObj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Same shape as `POST /analyze` response, built from `GET /runs/:id` artifact `content`.
 * `landing_page_qa` stores nested `analysis_meta` — we lift it for the "How this report was made" tab.
 */
export function analysisResultFromRunArtifacts(content: Record<string, unknown>): Record<string, unknown> | null {
  const rawBs = content.brand_snapshot;
  const rawLp = content.landing_page_qa;
  if (rawBs === undefined && rawLp === undefined) return null;

  const landing = asObj(rawLp);
  const metaNested = landing.analysis_meta;
  const qa: Record<string, unknown> = { ...landing };
  delete qa.analysis_meta;

  return {
    brand_snapshot: rawBs !== undefined ? asObj(rawBs) : {},
    qa,
    analysis_meta: metaNested !== undefined ? asObj(metaNested) : {},
  };
}

function TagPills({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="analysis-muted">{empty}</p>;
  return (
    <ul className="tag-pills" aria-label="Tags">
      {items.map((t) => (
        <li key={t} className="tag-pill">
          {t}
        </li>
      ))}
    </ul>
  );
}

function Collapsible({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="analysis-details" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="analysis-details-body">{children}</div>
    </details>
  );
}

function BrandSnapshotPanel({ data }: { data: Record<string, unknown> }) {
  const pos = asObj(data.positioning);
  const offers = asObj(data.offers_and_plans);
  const voice = asObj(data.voice_and_tone);
  const proof = asObj(data.proof_and_trust);
  const oneLiner = typeof pos.one_liner === "string" ? pos.one_liner : null;
  const audience = asStrArray(pos.audience_signals);
  const geo = typeof pos.geography_or_currency === "string" ? pos.geography_or_currency : null;
  const themes = asStrArray(data.messaging_themes);
  const ctas = asStrArray(data.ctas_in_use);
  const gaps = asStrArray(data.gaps_and_risks_for_ads);
  const voiceNotes = asStrArray(voice.notes);
  const proofItems = asStrArray(proof.items);
  const offerNotes = asStrArray(offers.notes);
  const trial = typeof offers.trial === "string" ? offers.trial : null;
  const tiers = Array.isArray(offers.tiers) ? offers.tiers : [];

  const sourceUrl = typeof data.source_url === "string" ? data.source_url : null;
  const when = formatWhen(data.generated_at);

  return (
    <div className="analysis-flow">
      {(sourceUrl || when) && (
        <div className="analysis-hero">
          {sourceUrl ? (
            <p className="analysis-hero-url">
              <span className="analysis-label">Site analyzed</span>
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                {sourceUrl}
              </a>
            </p>
          ) : null}
          {when ? (
            <p className="analysis-hero-meta">
              <span className="analysis-label">Report generated</span> {when}
            </p>
          ) : null}
        </div>
      )}

      <section className="analysis-highlight" aria-labelledby="headline-positioning">
        <h2 id="headline-positioning">What this site is saying</h2>
        {oneLiner ? (
          <p className="analysis-one-liner">{oneLiner}</p>
        ) : (
          <p className="analysis-muted">No single headline summary was detected—see sections below.</p>
        )}
      </section>

      <Collapsible title="Who it seems to be for" defaultOpen>
        {audience.length > 0 ? (
          <ul className="analysis-list">
            {audience.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No audience signals were extracted. You can add context when you generate ads.</p>
        )}
        {geo ? (
          <p className="analysis-sub">
            <span className="analysis-label">Region / currency hints:</span> {geo}
          </p>
        ) : null}
      </Collapsible>

      <Collapsible title="Offers & pricing" defaultOpen>
        {trial ? (
          <p>
            <span className="analysis-label">Trial or intro offer:</span> {trial}
          </p>
        ) : null}
        {tiers.length > 0 ? (
          <ul className="analysis-tier-list">
            {tiers.map((tier, i) => {
              const t = asObj(tier);
              const name = typeof t.name === "string" ? t.name : `Option ${i + 1}`;
              const price = typeof t.price_signal === "string" ? t.price_signal : null;
              const notes = typeof t.notes === "string" ? t.notes : null;
              return (
                <li key={i} className="analysis-tier-card">
                  <strong>{name}</strong>
                  {price ? <span className="analysis-tier-price">{price}</span> : null}
                  {notes ? <p className="analysis-tier-notes">{notes}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : !trial ? (
          <p className="analysis-muted">No structured pricing tiers were found in the crawl. Verify live before advertising prices.</p>
        ) : null}
        {offerNotes.length > 0 ? (
          <ul className="analysis-list compact">
            {offerNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Collapsible>

      <Collapsible title="Key messages & themes">
        <TagPills items={themes} empty="No themes were listed—try running analysis again after the site has more copy." />
      </Collapsible>

      <Collapsible title="Buttons & calls-to-action we saw">
        <TagPills items={ctas} empty="No CTAs were detected on crawled pages (the site may use images or JavaScript for buttons)." />
      </Collapsible>

      <Collapsible title="Voice & tone">
        {voiceNotes.length > 0 ? (
          <ul className="analysis-list">
            {voiceNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No voice notes—often improved when AI analysis is enabled.</p>
        )}
      </Collapsible>

      <Collapsible title="Trust & proof">
        {proofItems.length > 0 ? (
          <ul className="analysis-list">
            {proofItems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No trust signals listed from this crawl.</p>
        )}
      </Collapsible>

      <Collapsible title="Watch-outs for ads">
        {gaps.length > 0 ? (
          <ul className="analysis-list analysis-watchouts">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No specific gaps listed.</p>
        )}
      </Collapsible>
    </div>
  );
}

function QAPanel({ data }: { data: Record<string, unknown> }) {
  const issues = asStrArray(data.issues);
  const suggestions = asStrArray(data.suggestions);
  const crawler = asStrArray(data.crawler_issues);
  const innovation = data.innovation;
  const source = typeof data.analysis_source === "string" ? data.analysis_source : null;

  const inn = innovation !== null && typeof innovation === "object" && !Array.isArray(innovation) ? (innovation as Record<string, unknown>) : null;

  return (
    <div className="analysis-flow">
      {source ? (
        <p className="analysis-source-badge">
          <span className="analysis-label">How this was produced:</span>{" "}
          {source === "openrouter_ai"
            ? "AI-assisted review of your crawled pages"
            : source === "structural_only_no_api_key"
              ? "Structural checks only (add an API key for full AI insights)"
              : source === "fallback_after_ai_error"
                ? "Fallback after an AI error—see technical tab for details"
                : source === "empty_crawl"
                  ? "Limited data—the crawler could not read pages"
                  : titleCaseKey(source)}
        </p>
      ) : null}

      <section className="analysis-section" aria-labelledby="qa-issues">
        <h2 id="qa-issues">Things that may hurt conversions</h2>
        <p className="analysis-section-lead">Honest checks from the crawl—fixing these often lifts results.</p>
        {issues.length > 0 ? (
          <ul className="analysis-cards">
            {issues.map((issue, i) => (
              <li key={i} className="analysis-card issue">
                <span className="analysis-card-icon" aria-hidden>
                  !
                </span>
                <p>{issue}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No issues were flagged—nice.</p>
        )}
      </section>

      <section className="analysis-section" aria-labelledby="qa-suggestions">
        <h2 id="qa-suggestions">Practical next steps</h2>
        {suggestions.length > 0 ? (
          <ul className="analysis-cards">
            {suggestions.map((s, i) => (
              <li key={i} className="analysis-card tip">
                <span className="analysis-card-icon" aria-hidden>
                  ✓
                </span>
                <p>{s}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="analysis-muted">No suggestions this round.</p>
        )}
      </section>

      {inn && Object.keys(inn).length > 0 ? (
        <section className="analysis-section" aria-labelledby="qa-innovation">
          <h2 id="qa-innovation">Creative angles to explore</h2>
          <p className="analysis-section-lead">Ideas for hooks, stories, and tests—ground any claims on your live site.</p>
          <div className="analysis-innovation">
            {Object.entries(inn).map(([key, val]) => {
              const label = INNOVATION_LABELS[key] || titleCaseKey(key);
              if (val === null || val === undefined) return null;
              if (typeof val === "string" && val.trim()) {
                return (
                  <Collapsible key={key} title={label} defaultOpen={key === "contrarian_angle"}>
                    <p className="analysis-prose">{val}</p>
                  </Collapsible>
                );
              }
              if (Array.isArray(val) && val.every((x) => typeof x === "string")) {
                const arr = val as string[];
                if (arr.length === 0) return null;
                return (
                  <Collapsible key={key} title={label} defaultOpen>
                    <ul className="analysis-list">
                      {arr.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </Collapsible>
                );
              }
              return (
                <Collapsible key={key} title={label}>
                  <pre className="analysis-prose technical">{JSON.stringify(val, null, 2)}</pre>
                </Collapsible>
              );
            })}
          </div>
        </section>
      ) : null}

      {crawler.length > 0 ? (
        <section className="analysis-section">
          <h2>Crawler notes</h2>
          <p className="analysis-section-lead">Technical details from fetching pages—not about your brand quality.</p>
          <ul className="analysis-list muted-list">
            {crawler.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MetaPanel({ data }: { data: Record<string, unknown> }) {
  const ai = data.ai_used === true;
  const model = typeof data.model === "string" ? data.model : null;
  const err = typeof data.ai_error === "string" ? data.ai_error : null;

  return (
    <div className="analysis-flow analysis-meta-panel">
      <div className={`analysis-status-pill ${ai ? "on" : "off"}`}>{ai ? "AI analysis ran" : "AI not used or unavailable"}</div>
      {model ? (
        <p>
          <span className="analysis-label">Model</span> {model}
        </p>
      ) : null}
      {err ? (
        <div className="analysis-card issue" style={{ marginTop: "1rem" }}>
          <span className="analysis-card-icon" aria-hidden>
            i
          </span>
          <div>
            <strong>Technical note</strong>
            <p className="analysis-prose">{err}</p>
          </div>
        </div>
      ) : (
        !ai && <p className="analysis-muted">No error recorded. For richer brand insights, set your API key and try again.</p>
      )}
    </div>
  );
}

type Props = {
  result: Record<string, unknown>;
  /** Hide the "Show technical data (JSON)" block (e.g. when nested). */
  hideRawToggle?: boolean;
};

export function AnalysisResults({ result, hideRawToggle }: Props) {
  const [tab, setTab] = useState<Tab>("snapshot");
  const [showRaw, setShowRaw] = useState(false);

  const snapshot = asObj(result.brand_snapshot);
  const qa = asObj(result.qa);
  const meta = asObj(result.analysis_meta);

  return (
    <div className="analysis-results card">
      <div className="tabs analysis-tabs" role="tablist" aria-label="Analysis sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "snapshot"}
          className={`tab ${tab === "snapshot" ? "active" : ""}`}
          onClick={() => setTab("snapshot")}
        >
          Your brand snapshot
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "qa"}
          className={`tab ${tab === "qa" ? "active" : ""}`}
          onClick={() => setTab("qa")}
        >
          Page &amp; conversion tips
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "meta"}
          className={`tab ${tab === "meta" ? "active" : ""}`}
          onClick={() => setTab("meta")}
        >
          How this report was made
        </button>
      </div>

      <div className="analysis-tab-panel" role="tabpanel">
        {tab === "snapshot" ? <BrandSnapshotPanel data={snapshot} /> : null}
        {tab === "qa" ? <QAPanel data={qa} /> : null}
        {tab === "meta" ? <MetaPanel data={meta} /> : null}
      </div>

      {!hideRawToggle ? (
        <div className="analysis-raw-toggle">
          <button type="button" className="btn ghost small" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "Hide" : "Show"} technical data (JSON)
          </button>
          {showRaw ? (
            <pre className="json-view analysis-raw-json">
              {JSON.stringify(tab === "snapshot" ? snapshot : tab === "qa" ? qa : meta, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
