"use client";
import { useId } from "react";

/** Accessible range slider: arrow keys, Page Up/Down and Home/End all work (native input). */
export function Slider({
  label, value, onChange, min, max, step, format, disabled,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
      />
      <output htmlFor={id}>{format(value)}</output>
    </div>
  );
}

export function Segmented<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
