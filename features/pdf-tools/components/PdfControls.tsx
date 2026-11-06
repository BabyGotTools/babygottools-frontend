"use client";

import type { ReactNode } from "react";
import Icon from "@/components/common/Icon";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/* Settings primitives shared by all PDF workspaces. They mirror the    */
/* stitch control styling: surface tiles, ring-2 selection, mono meta.  */
/* ------------------------------------------------------------------ */

export interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  right?: ReactNode;
  disabled?: boolean;
}

export function ToggleRow({ checked, onChange, label, hint, right, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="flex items-center gap-2 cursor-pointer min-w-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="w-4 h-4 text-primary rounded focus:ring-primary accent-primary shrink-0"
        />
        <span className="font-body-md text-body-md text-on-surface font-medium min-w-0" title={hint}>
          {label}
        </span>
      </label>
      {right && (
        <span className="font-label-mono-xs text-label-sm text-on-surface-variant shrink-0">{right}</span>
      )}
    </div>
  );
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="bg-surface-container-lowest rounded-md px-2.5 py-1.5 text-label-sm font-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-sm disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  min = 0,
  max = 1_000_000,
  step = 1,
  suffix,
  onChange,
  disabled,
}: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className="flex items-center bg-surface-container-lowest rounded-md px-2.5 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-primary">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-full bg-transparent text-label-sm font-label-sm text-on-surface focus:outline-none disabled:opacity-50"
        />
        {suffix && (
          <span className="text-label-sm font-label-sm text-outline shrink-0">{suffix}</span>
        )}
      </span>
    </label>
  );
}

export interface SegmentedControlProps<T extends string | number> {
  label?: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: 2 | 3 | 4;
}

/** Stitch "profile tiles": ring-2 ring-primary + floating Recommended badge. */
export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  columns = 3,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {label && (
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
          {label}
        </span>
      )}
      <div
        className={`grid gap-2.5 ${columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`cursor-pointer rounded-lg p-3 text-left transition-all flex flex-col justify-between disabled:opacity-50 ${
                selected
                  ? "bg-primary/10 shadow-sm ring-2 ring-primary"
                  : "bg-surface-container-low hover:bg-surface-container"
              }`}
            >
              <span
                className={`font-headline-sm text-headline-sm font-semibold text-[0.95rem] ${
                  selected ? "text-primary font-bold" : "text-on-surface"
                }`}
              >
                {option.label}
              </span>
              {option.hint && (
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-snug mt-1">
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface AccordionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Stitch "Fine-Tuning Engine Parameters" drawer. */
export function Accordion({ title, icon = "tune", children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg bg-surface-container-low p-space-sm flex flex-col gap-space-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center justify-between cursor-pointer w-full bg-transparent"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Icon name={icon} size={18} className="text-primary" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-medium">{title}</span>
        </span>
        <Icon
          name="expand_more"
          size={20}
          className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 pt-2 border-t border-outline-variant/40">{children}</div>
      )}
    </div>
  );
}

/** Stitch "Recommended" floating badge for tiles. */
export function RecommendedBadge() {
  return (
    <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-mono-xs text-[10px] uppercase font-bold tracking-wider">
      Recommended
    </span>
  );
}
