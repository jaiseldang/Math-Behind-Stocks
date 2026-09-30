"use client";
import katex from "katex";
import { useMemo, useState } from "react";
import { useSettings } from "@/components/providers";

/** Inline maths: <M>{"\\sigma^2"}</M> */
export function M({ children }: { children: string }) {
  const html = useMemo(() => katex.renderToString(children, { throwOnError: false, displayMode: false }), [children]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Display maths with a "copy LaTeX" button (for the IA write-up). */
export function Eq({ children, label }: { children: string; label?: string }) {
  const html = useMemo(() => katex.renderToString(children, { throwOnError: false, displayMode: true }), [children]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="eq">
      <div role="math" aria-label={label ?? children} dangerouslySetInnerHTML={{ __html: html }} />
      <button className="btn copy-tex" onClick={copy} aria-label="Copy this equation as LaTeX">
        {copied ? "Copied" : "Copy LaTeX"}
      </button>
    </div>
  );
}

/**
 * A symbol that classmate mode swaps for words.
 * <S tex="\\sigma" words="risk" />
 */
export function S({ tex, words }: { tex: string; words: string }) {
  const { classmate } = useSettings();
  return classmate ? <span className="words">{words}</span> : <M>{tex}</M>;
}
