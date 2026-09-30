"use client";
/**
 * The seven-part page pattern:
 *  1 Question → 2 Your guess → 3 Intuition → 4 The maths → 5 Experiment → 6 Finding → 7 Check
 */
import { useState } from "react";
import { useGuess, useSettings, type Guess } from "@/components/providers";
import { Eq } from "./Tex";

const LABELS = {
  question: "The question",
  guess: "Your guess",
  intuition: "Intuition",
  maths: "The maths",
  experiment: "Experiment",
  finding: "Finding",
  check: "Check",
} as const;
const ORDER = Object.keys(LABELS) as (keyof typeof LABELS)[];
type Kind = keyof typeof LABELS;

export function Stage({ kind, title, children }: { kind: Kind; title?: string; children: React.ReactNode }) {
  return (
    <section className={`stage ${kind}`} aria-label={title ?? LABELS[kind]}>
      <div className="stage-label">
        <span className="dot" aria-hidden>{ORDER.indexOf(kind) + 1}</span>
        {title ?? LABELS[kind]}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ n, title, lead }: { n: number | string; title: string; lead?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-kicker">Page {n}</div>
      <h1>{title}</h1>
      {lead && <p className="note" style={{ fontSize: "1rem" }}>{lead}</p>}
    </header>
  );
}

export function Question({ children }: { children: React.ReactNode }) {
  return (
    <Stage kind="question">
      <p className="q">{children}</p>
    </Stage>
  );
}

/** Multiple-choice prediction. The answer is only shown in the Finding. */
export function GuessChoice({ id, prompt, options }: { id: string; prompt: React.ReactNode; options: string[] }) {
  const [guess, setGuess] = useGuess(id);
  return (
    <Stage kind="guess">
      <p>{prompt}</p>
      <div className="choices" role="group" aria-label="Your prediction">
        {options.map((o, i) => (
          <button key={o} className="choice" aria-pressed={guess?.value === i} onClick={() => setGuess({ value: i, label: o })}>
            {o}
          </button>
        ))}
      </div>
      {guess && <p className="note" style={{ marginTop: 8 }}>Locked in. Scroll on to test it; the Finding will compare.</p>}
    </Stage>
  );
}

/** Numeric prediction on a slider. */
export function GuessSlider({
  id, prompt, min, max, step, format, initial,
}: { id: string; prompt: React.ReactNode; min: number; max: number; step: number; format: (v: number) => string; initial?: number }) {
  const [guess, setGuess] = useGuess(id);
  const [v, setV] = useState<number>(typeof guess?.value === "number" ? guess.value : initial ?? (min + max) / 2);
  return (
    <Stage kind="guess">
      <p>{prompt}</p>
      <div className="slider">
        <label htmlFor={`g-${id}`}>My guess</label>
        <input id={`g-${id}`} type="range" min={min} max={max} step={step} value={v} onChange={(e) => setV(Number(e.target.value))} aria-valuetext={format(v)} />
        <output htmlFor={`g-${id}`}>{format(v)}</output>
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={() => setGuess({ value: v, label: format(v) })}>
          {guess ? "Update guess" : "Lock in guess"}
        </button>
        {guess && <span className="note" style={{ alignSelf: "center" }}>Locked in: {guess.label}</span>}
      </div>
    </Stage>
  );
}

export function Intuition({ children }: { children: React.ReactNode }) {
  return <Stage kind="intuition">{children}</Stage>;
}

export interface MathStep {
  /** The line of maths in LaTeX. */
  tex: string;
  /** Why this step is allowed / what it does. */
  why: React.ReactNode;
  /** Classmate-mode version in plain words (optional). */
  words?: React.ReactNode;
}

/** A derivation revealed one line at a time, with a "why this step?" note beside each. */
export function MathSteps({ steps, intro, title, stacked }: { steps: MathStep[]; intro?: React.ReactNode; title?: string; /** put each "why" under its equation (for wide matrices) */ stacked?: boolean }) {
  const [shown, setShown] = useState(1);
  const { classmate } = useSettings();
  return (
    <Stage kind="maths" title={title}>
      {intro && <div>{intro}</div>}
      <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className={stacked ? "step stacked" : "step"}>
            <div>
              {classmate && s.words ? <p className="words" style={{ margin: 0 }}>{s.words}</p> : <Eq>{s.tex}</Eq>}
            </div>
            <div className="why">
              <strong>Why this step? </strong>
              {s.why}
            </div>
          </li>
        ))}
      </ol>
      <div className="btn-row">
        {shown < steps.length && (
          <>
            <button className="btn primary" onClick={() => setShown(shown + 1)}>Next step ({shown}/{steps.length})</button>
            <button className="btn" onClick={() => setShown(steps.length)}>Show all</button>
          </>
        )}
        {shown === steps.length && steps.length > 1 && <button className="btn" onClick={() => setShown(1)}>Start again</button>}
      </div>
    </Stage>
  );
}

export function Experiment({ children, title }: { children: React.ReactNode; title?: string }) {
  return <Stage kind="experiment" title={title}>{children}</Stage>;
}

/**
 * The result in one highlighted sentence, then detail, then a comparison with the guess.
 * `compare` receives the reader's guess (or null if they skipped it).
 */
export function Finding({
  headline, children, guessId, compare,
}: { headline: React.ReactNode; children?: React.ReactNode; guessId?: string; compare?: (g: Guess) => React.ReactNode }) {
  const [guess] = useGuess(guessId ?? "__none");
  return (
    <Stage kind="finding">
      <p className="finding-headline">{headline}</p>
      {children}
      {guessId && (
        <p className="note" style={{ marginBottom: 0 }}>
          {guess ? <>You guessed <strong>{guess.label}</strong>. {compare?.(guess)}</> : "You didn't make a guess. Try one above before reading this!"}
        </p>
      )}
    </Stage>
  );
}

export function Check({ children, title }: { children: React.ReactNode; title?: string }) {
  return <Stage kind="check" title={title}>{children}</Stage>;
}

export function Investigation({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="investigation" id={`investigation-${n}`}>
      <div className="page-kicker">Investigation {n}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
