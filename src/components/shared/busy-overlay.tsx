"use client";

import { Loader2 } from "lucide-react";
import { useApp } from "@/context/app-context";

export function BusyOverlay() {
  const { ocupado } = useApp();
  if (!ocupado) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-xl border border-[#004B87]/20 bg-[#003366] px-4 py-3 text-sm font-medium text-white shadow-xl shadow-slate-900/20"
    >
      <Loader2 className="size-4 animate-spin text-emerald-300" />
      <span>{ocupado}</span>
    </div>
  );
}
