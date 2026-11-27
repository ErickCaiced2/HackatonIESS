"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowBigUp,
  Delete,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldAlert,
  Shuffle,
} from "lucide-react";

function barajarDigitos(): string[] {
  const digitos = [..."0123456789"];
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    for (let i = digitos.length - 1; i > 0; i--) {
      const b = new Uint32Array(1);
      window.crypto.getRandomValues(b);
      const j = b[0] % (i + 1);
      [digitos[i], digitos[j]] = [digitos[j], digitos[i]];
    }
  }
  return digitos;
}

const FILAS_LETRAS = [
  [..."qwertyuiop"],
  [..."asdfghjklñ"],
  [..."zxcvbnm"],
];

interface TecladoVirtualProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}

export function TecladoVirtual({
  id,
  label,
  value,
  onChange,
}: TecladoVirtualProps) {
  const [digitos] = useState<string[]>(() => barajarDigitos());
  const [mayusculas, setMayusculas] = useState(false);
  const [visible, setVisible] = useState(false);

  const pulsar = (c: string) => {
    const char = mayusculas ? c.toUpperCase() : c;
    onChange(value + char);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-slate-700">
          {label}
        </Label>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F1F8] px-2.5 py-0.5 text-[11px] font-medium text-[#004B87]">
          <Shuffle className="size-3" />
          Números aleatorios
        </span>
      </div>

      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          readOnly
          value={value}
          autoComplete="off"
          placeholder="Use el teclado seguro en pantalla"
          aria-describedby={`${id}-ayuda`}
          className="h-11 bg-slate-50 pr-24 font-mono text-base tracking-[0.22em] text-slate-900 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400"
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
          >
            {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {visible ? "Ocultar" : "Ver"}
          </button>
        </div>
      </div>

      <p id={`${id}-ayuda`} className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldAlert className="size-3.5 shrink-0 text-[#004B87]" />
        Por seguridad la contraseña solo se ingresa con este teclado en pantalla.
      </p>

      <div
        role="group"
        aria-label="Teclado en pantalla"
        className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-2.5 shadow-inner"
      >
        {/* Fila numérica barajada */}
        <div className="grid grid-cols-10 gap-1">
          {digitos.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pulsar(d)}
              aria-label={`Tecla ${d}`}
              className="flex h-9 items-center justify-center rounded-lg border border-slate-300/80 bg-white font-mono text-sm font-semibold text-[#003366] shadow-[0_1px_0_rgba(15,23,42,0.08)] transition-all hover:border-[#004B87] hover:bg-[#E8F1F8] active:translate-y-px"
            >
              {d}
            </button>
          ))}
        </div>

        {/* Filas de letras */}
        {FILAS_LETRAS.map((fila, idx) => (
          <div
            key={idx}
            className="flex flex-wrap justify-center gap-1"
          >
            {fila.map((c) => {
              const display = mayusculas ? c.toUpperCase() : c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pulsar(c)}
                  aria-label={`Tecla ${display}`}
                  className="flex h-9 min-w-[30px] flex-1 max-w-[44px] items-center justify-center rounded-lg border border-slate-300/80 bg-white text-sm font-semibold text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.08)] transition-all hover:border-[#004B87] hover:bg-[#E8F1F8] hover:text-[#003366] active:translate-y-px"
                >
                  {display}
                </button>
              );
            })}
          </div>
        ))}

        {/* Acciones del teclado */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            aria-pressed={mayusculas}
            onClick={() => setMayusculas((m) => !m)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all ${
              mayusculas
                ? "border-[#004B87] bg-[#004B87] text-white shadow-xs"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <ArrowBigUp className="size-4" />
            Mayús
          </button>

          <button
            type="button"
            onClick={() => onChange(value.slice(0, -1))}
            aria-label="Borrar el último carácter"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
          >
            <Delete className="size-4" />
            Borrar
          </button>

          <button
            type="button"
            onClick={() => onChange("")}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            <RotateCcw className="size-3.5" />
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
