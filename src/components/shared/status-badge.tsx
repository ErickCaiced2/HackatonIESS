"use client";

import { ESTADOS } from "@/motor/peticiones.js";
import { cn } from "cn";

export type Tono = "ok" | "mal" | "aviso" | "neutro" | "info";

const TONO_CLASES: Record<Tono, string> = {
  ok: "bg-[#E6F4EF] text-[#006644] ring-1 ring-inset ring-[#007A53]/20",
  mal: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  aviso: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25",
  info: "bg-[#E8F1F8] text-[#004B87] ring-1 ring-inset ring-[#004B87]/20",
  neutro: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300/80",
};

const PUNTO_CLASES: Record<Tono, string> = {
  ok: "bg-[#007A53]",
  mal: "bg-red-600",
  aviso: "bg-amber-500",
  info: "bg-[#004B87]",
  neutro: "bg-slate-400",
};

export function StatusBadge({
  tono = "neutro",
  dot = false,
  className,
  children,
}: {
  tono?: Tono;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONO_CLASES[tono],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", PUNTO_CLASES[tono])}
        />
      )}
      {children}
    </span>
  );
}

export const TONO_ESTADO: Record<string, Tono> = {
  enviada: "aviso",
  devuelta: "mal",
  en_proceso: "info",
  publicada: "neutro",
  firmada: "ok",
  descargada: "ok",
};

export function EstadoPeticionBadge({ estado }: { estado: string }) {
  const label = (ESTADOS as Record<string, string>)[estado] ?? estado;
  return (
    <StatusBadge tono={TONO_ESTADO[estado] ?? "neutro"} dot>
      {label}
    </StatusBadge>
  );
}
