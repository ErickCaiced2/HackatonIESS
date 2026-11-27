"use client";

import { useState } from "react";
import {
  TIPOS_DESTINATARIO,
  validarDestinatario,
  ejemploDestinatario,
  normalizarId,
  formatearId,
  excedeLongitud,
} from "@/motor/destinatario.js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/shared/native-select";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { Destinatario } from "@/lib/types";

interface CampoPersonaProps {
  prefijo: string;
  valor: Destinatario;
  onChange: (next: Destinatario) => void;
  extraError?: (val: Destinatario) => string;
}

export function CampoPersona({
  prefijo,
  valor,
  onChange,
  extraError,
}: CampoPersonaProps) {
  const [completo, setCompleto] = useState(false);

  let nivel: "" | "aviso" | "mal" = "";
  let mensaje = "";

  if (valor.id) {
    if (excedeLongitud(valor)) {
      nivel = "aviso";
      mensaje = validarDestinatario(valor);
    } else if (completo) {
      const err = validarDestinatario(valor) || (extraError ? extraError(valor) : "");
      if (err) {
        nivel = "mal";
        mensaje = err;
      }
    }
  }

  const labelId =
    valor.tipo === "msp"
      ? "Número de licencia del MSP"
      : "Identificador institucional del IESS";

  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-tipo`} className="text-slate-700">
            Tipo de personal
          </Label>
          <NativeSelect
            id={`${prefijo}-tipo`}
            value={valor.tipo}
            onChange={(e) => {
              const tipo = e.target.value as "msp" | "iess";
              const nextId = formatearId(tipo, valor.id, {
                separadorFinal: false,
              });
              setCompleto(true);
              onChange({ tipo, id: nextId });
            }}
          >
            {Object.entries(TIPOS_DESTINATARIO as Record<string, string>).map(
              ([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              )
            )}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-id`} className="text-slate-700">
            {labelId}
          </Label>
          <Input
            id={`${prefijo}-id`}
            value={valor.id}
            placeholder={`Ej.: ${ejemploDestinatario(valor.tipo)}`}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={nivel === "mal" || undefined}
            aria-describedby={`${prefijo}-error`}
            className={`h-10 font-mono text-sm tracking-wide ${
              nivel === "mal"
                ? "border-red-500 focus-visible:border-red-600 focus-visible:ring-red-500/20"
                : nivel === "aviso"
                ? "border-amber-500 focus-visible:border-amber-600 focus-visible:ring-amber-500/20"
                : "border-slate-300 bg-white"
            }`}
            onChange={(e) => {
              const nativeEvt = e.nativeEvent as InputEvent;
              const borrando = nativeEvt?.inputType?.startsWith("delete") ?? false;
              const formatted = formatearId(valor.tipo, e.target.value, {
                separadorFinal: !borrando,
              });
              setCompleto(false);
              onChange({ ...valor, id: formatted });
            }}
            onBlur={() => {
              setCompleto(true);
              onChange({ ...valor, id: normalizarId(valor.id) });
            }}
          />
        </div>
      </div>

      {mensaje && (
        <p
          id={`${prefijo}-error`}
          role="status"
          className={`flex items-center gap-1.5 text-xs font-medium ${
            nivel === "mal" ? "text-red-600" : "text-amber-700"
          }`}
        >
          {nivel === "mal" ? (
            <AlertCircle className="size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0" />
          )}
          {mensaje}
        </p>
      )}
    </div>
  );
}
