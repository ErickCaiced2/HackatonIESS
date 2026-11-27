"use client";

import { ShieldCheck } from "lucide-react";

export function IessLogo({
  compact = false,
}: {
  variant?: "light" | "dark";
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#004B87] text-white shadow-xs">
        <ShieldCheck className="size-4.5 text-white" strokeWidth={2.2} />
      </div>

      {!compact && (
        <span className="font-heading text-base font-bold tracking-tight text-slate-900">
          TASS
        </span>
      )}
    </div>
  );
}

export function TricolorBar() {
  return (
    <div
      className="iess-tricolor-bar h-[3px] w-full shrink-0"
      aria-hidden="true"
    />
  );
}
