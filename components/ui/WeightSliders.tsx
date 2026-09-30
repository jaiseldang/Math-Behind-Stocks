"use client";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, usd } from "@/lib/format";
import { Slider } from "./Slider";

/**
 * Three weight sliders that always add up to 1 (100%).
 * Moving one slider shares the change among the others in proportion to
 * their current sizes, so the relative mix of the others is kept.
 */
export function rebalance(w: number[], i: number, v: number, min = 0): number[] {
  const others = w.map((_, j) => j).filter((j) => j !== i);
  const rest = 1 - v;
  const otherSum = others.reduce((s, j) => s + (w[j] - min), 0);
  const next = w.slice();
  next[i] = v;
  for (const j of others) {
    const share = otherSum > 1e-12 ? (w[j] - min) / otherSum : 1 / others.length;
    next[j] = min + share * (rest - min * others.length);
  }
  // tidy rounding so the display adds to exactly 100%
  const r = next.map((x) => Math.round(x * 1000) / 1000);
  const drift = 1 - r.reduce((s, x) => s + x, 0);
  r[others[others.length - 1]] = Math.round((r[others[others.length - 1]] + drift) * 1000) / 1000;
  return r;
}

export function WeightSliders({
  weights, onChange, amount, min = 0, max = 1,
}: { weights: number[]; onChange: (w: number[]) => void; amount?: number; min?: number; max?: number }) {
  return (
    <div role="group" aria-label="Portfolio weights (always sum to 100%)">
      {DEFAULT_ASSETS.map((a, i) => (
        <Slider
          key={a}
          label={<><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}</>}
          value={weights[i]}
          min={min}
          max={max}
          step={0.01}
          onChange={(v) => onChange(rebalance(weights, i, v, min))}
          format={(v) => (amount ? `${pct(v, 0)} · ${usd(v * amount, 0)}` : pct(v, 0))}
        />
      ))}
      <p className="note" style={{ margin: 0 }}>Total: {pct(weights.reduce((s, x) => s + x, 0), 0)} (moving one slider rescales the others)</p>
    </div>
  );
}
