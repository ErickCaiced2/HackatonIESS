"use client";

import {
  estandarizar,
  necesitaRevision,
  MINIMOS,
  CAMPOS,
  UMBRAL_ALTO,
} from "@/ia/estandarizar.js";
import { num } from "@/motor/entregables.js";
import { StatusBadge } from "@/components/shared/status-badge";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { RevisionIA } from "@/lib/types";

interface RevisionIAPanelProps {
  revision: RevisionIA;
  onUpdate: (next: RevisionIA) => void;
  onConfirmar: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BadgeConfianza({ col }: { col: any }) {
  if (col.origen === "nombre oficial") {
    return <StatusBadge tono="ok">Nombre oficial</StatusBadge>;
  }
  const p = Math.round(col.modelo.confianza * 100) + " %";
  if (col.propuesta === "desconocida") {
    return (
      <StatusBadge tono="neutro">
        {col.conflicto ? "Repetida" : "Sin correspondencia"}
      </StatusBadge>
    );
  }
  if (col.sugerida) {
    return <StatusBadge tono="aviso">Sugerencia: compruébela</StatusBadge>;
  }
  return col.confianza >= UMBRAL_ALTO ? (
    <StatusBadge tono="ok">Segura {p}</StatusBadge>
  ) : (
    <StatusBadge tono="aviso">Dudosa {p}</StatusBadge>
  );
}

export function RevisionIAPanel({
  revision,
  onUpdate,
  onConfirmar,
}: RevisionIAPanelProps) {
  const { analisis: a, decisiones: d, codificacion } = revision;
  const res = estandarizar(a, d);

  const clonarDecisiones = () => ({
    asignacion: [...d.asignacion],
    revisadas: new Set(d.revisadas),
    sexo: { ...d.sexo },
    tipo: { ...d.tipo },
    ordenFecha: { ...d.ordenFecha },
  });

  const cambiarAsignacion = (indice: number, valor: string) => {
    const next = clonarDecisiones();
    next.asignacion[indice] = valor;
    next.revisadas.add(indice);
    next.sexo = {};
    next.tipo = {};
    next.ordenFecha = {};
    onUpdate({ ...revision, decisiones: next });
  };

  const toggleRevisada = (indice: number, checked: boolean) => {
    const next = clonarDecisiones();
    if (checked) next.revisadas.add(indice);
    else next.revisadas.delete(indice);
    onUpdate({ ...revision, decisiones: next });
  };

  const cambiarOrdenFecha = (campo: string, valor: string) => {
    const next = clonarDecisiones();
    next.ordenFecha[campo] = valor;
    onUpdate({ ...revision, decisiones: next });
  };

  const cambiarMapa = (tipo: "sexo" | "tipo", clave: string, valor: string) => {
    const next = clonarDecisiones();
    if (tipo === "sexo") next.sexo[clave] = valor;
    else next.tipo[clave] = valor;
    onUpdate({ ...revision, decisiones: next });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnas: any[] = a.columnas;
  const dudosas = columnas.filter(necesitaRevision);
  const usadas = columnas.filter(
    (c) => !necesitaRevision(c) && d.asignacion[c.indice] !== "desconocida"
  );
  const sobrantes = columnas.filter(
    (c) => !necesitaRevision(c) && d.asignacion[c.indice] === "desconocida"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minimosCumplidos = (MINIMOS as any[]).filter((m) =>
    m.opciones.some((o: string) => d.asignacion.includes(o))
  ).length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTablaColumnas = (lista: any[]) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="text-xs">Columna del archivo</TableHead>
            <TableHead className="text-xs">La IA la toma como</TableHead>
            <TableHead className="text-xs">Confianza</TableHead>
            <TableHead className="text-xs">¿Por qué?</TableHead>
            <TableHead className="text-xs">Revisión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((c) => (
            <TableRow key={c.indice}>
              <TableCell className="font-mono text-xs font-bold text-slate-900">
                {c.nombre}
              </TableCell>
              <TableCell className="min-w-[210px]">
                <NativeSelect
                  id={`col-${c.indice}`}
                  aria-label={`Campo para la columna ${c.nombre}`}
                  value={d.asignacion[c.indice]}
                  onChange={(e) => cambiarAsignacion(c.indice, e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="desconocida">— no usar (se elimina) —</option>
                  {(CAMPOS as string[]).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </NativeSelect>
              </TableCell>
              <TableCell>
                <BadgeConfianza col={c} />
              </TableCell>
              <TableCell className="max-w-xs text-xs text-slate-600">
                {c.senales.join(" · ") || "—"}
                {c.conflicto ? ` · otra columna ya es «${c.conflicto}»` : ""}
                {c.origen === "modelo" && c.modelo.confianza < UMBRAL_ALTO
                  ? ` · segunda opción: ${c.modelo.segunda}`
                  : ""}
              </TableCell>
              <TableCell>
                {necesitaRevision(c) ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                    <Checkbox
                      id={`rev-${c.indice}`}
                      checked={d.revisadas.has(c.indice)}
                      onCheckedChange={(v) =>
                        toggleRevisada(c.indice, Boolean(v))
                      }
                    />
                    Revisada
                  </label>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-5 rounded-2xl border border-[#004B87]/25 bg-gradient-to-b from-[#E8F1F8]/40 to-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#004B87] text-white shadow-xs">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-slate-900">
              Revisión asistida por IA
            </h3>
            <p className="text-xs text-slate-600">
              {num(a.filas)} filas · {columnas.length} columnas · separador:{" "}
              <strong>{a.nombreSeparador}</strong> · codificación:{" "}
              <strong>{codificacion}</strong>
            </p>
          </div>
        </div>
        <StatusBadge tono="info">La IA propone · TI confirma</StatusBadge>
      </div>

      {/* 4 métricas de IA */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Reconocidas", value: usadas.length, tone: "text-[#007A53]" },
          {
            label: "Dudosas por revisar",
            value: dudosas.length,
            tone: dudosas.length > 0 ? "text-amber-700" : "text-slate-900",
          },
          { label: "Se eliminan", value: sobrantes.length, tone: "text-slate-700" },
          {
            label: "Datos mínimos",
            value: `${minimosCumplidos} de ${MINIMOS.length}`,
            tone:
              minimosCumplidos === MINIMOS.length
                ? "text-[#007A53]"
                : "text-red-600",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-3.5"
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p
              className={`mt-1 font-heading text-2xl font-bold tabular-nums ${item.tone}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Columnas dudosas */}
      {dudosas.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="size-4 text-amber-600" />
            Revise estas columnas una por una ({dudosas.length})
          </h4>
          {renderTablaColumnas(dudosas)}
        </div>
      )}

      {/* Preguntas de desambiguación */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {res.preguntas.map((p: any, idx: number) => {
        if (p.tipo === "fecha") {
          return (
            <div
              key={idx}
              className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4"
            >
              <p className="text-sm font-bold text-amber-950">
                ¿Cómo están escritas las fechas de «{p.columna}»?
              </p>
              <div className="max-w-xs space-y-1">
                <Label htmlFor={`orden-${p.campo}`} className="text-xs">
                  Orden de fecha
                </Label>
                <NativeSelect
                  id={`orden-${p.campo}`}
                  value={d.ordenFecha[p.campo] ?? ""}
                  onChange={(e) => cambiarOrdenFecha(p.campo, e.target.value)}
                >
                  <option value="">Elija una opción</option>
                  <option value="dmy">Día / mes / año</option>
                  <option value="mdy">Mes / día / año</option>
                </NativeSelect>
              </div>
            </div>
          );
        }

        const esSexo = p.tipo === "sexo";
        const destinos: [string, string][] = esSexo
          ? [
              ["H", "Hombre"],
              ["M", "Mujer"],
            ]
          : ["Consulta externa", "Emergencia", "Hospitalización"].map((x) => [
              x,
              x,
            ]);

        return (
          <div
            key={idx}
            className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4"
          >
            <p className="text-sm font-bold text-amber-950">
              {esSexo
                ? `Confirme el sexo en «${p.columna}»`
                : `¿Qué tipo de atención es cada valor de «${p.columna}»?`}
            </p>
            {esSexo && p.explicacion && (
              <p className="text-xs text-amber-900">{p.explicacion}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(p.valores as string[]).map((v) => (
                <div key={v} className="space-y-1">
                  <Label htmlFor={`${p.tipo}-${v}`} className="text-xs">
                    «{esSexo ? v.toUpperCase() : v}» significa
                  </Label>
                  <NativeSelect
                    id={`${p.tipo}-${v}`}
                    value={p.mapa[v] ?? ""}
                    onChange={(e) =>
                      cambiarMapa(
                        esSexo ? "sexo" : "tipo",
                        v,
                        e.target.value
                      )
                    }
                  >
                    <option value="">Elija una opción</option>
                    {destinos.map(([val, txt]) => (
                      <option key={val} value={val}>
                        {txt}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Acordeones: mínimos, reconocidas, sobrantes */}
      <Accordion className="space-y-2">
        <AccordionItem
          value="minimos"
          className="rounded-xl border border-slate-200 bg-white px-4"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver los {MINIMOS.length} datos mínimos requeridos ({minimosCumplidos}/
            {MINIMOS.length})
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Dato mínimo</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(MINIMOS as any[]).map((m, i) => {
                    const hallado = m.opciones.find((o: string) =>
                      d.asignacion.includes(o)
                    );
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {m.dato}
                        </TableCell>
                        <TableCell>
                          {hallado ? (
                            <StatusBadge tono="ok">
                              Viene como {hallado}
                            </StatusBadge>
                          ) : (
                            <StatusBadge tono="mal">Falta</StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="reconocidas"
          className="rounded-xl border border-slate-200 bg-white px-4"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver o corregir las columnas reconocidas ({usadas.length})
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {renderTablaColumnas(usadas)}
          </AccordionContent>
        </AccordionItem>

        {sobrantes.length > 0 && (
          <AccordionItem
            value="sobrantes"
            className="rounded-xl border border-slate-200 bg-white px-4"
          >
            <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
              Ver o recuperar las columnas que se eliminan ({sobrantes.length})
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              {renderTablaColumnas(sobrantes)}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Problemas / Confirmación */}
      {res.problemas.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p className="flex items-center gap-2 font-bold">
            <AlertCircle className="size-4 text-red-600" />
            Todavía no se puede continuar:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {(res.problemas as string[]).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-[#E6F4EF] px-4 py-3 text-sm font-medium text-[#005C3E]">
          <CheckCircle2 className="size-4.5 shrink-0 text-[#007A53]" />
          Todo se puede estandarizar. Revise las asignaciones y confirme.
        </div>
      )}

      {(res.notas as string[]).map((n, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <span>{n}</span>
        </div>
      ))}

      <div className="flex justify-end">
        <Button
          type="button"
          id="confirmar-ia"
          disabled={res.problemas.length > 0}
          onClick={onConfirmar}
          className="h-10 gap-2 bg-[#004B87] px-5 text-sm font-semibold text-white hover:bg-[#003366]"
        >
          <Sparkles className="size-4" />
          Confirmar y estandarizar
        </Button>
      </div>
    </div>
  );
}
