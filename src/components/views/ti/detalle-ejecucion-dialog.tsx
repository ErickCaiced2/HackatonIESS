"use client";

import { num } from "@/motor/entregables.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import { fechaHora } from "@/lib/servicios";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface DetalleEjecucionDialogProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entrada: any | null;
  onClose: () => void;
}

export function DetalleEjecucionDialog({
  entrada,
  onClose,
}: DetalleEjecucionDialogProps) {
  if (!entrada) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cols: any[] = entrada.columnas ?? [];
  const anonimizadas = cols.filter((c) => c.tecnica !== "Conservar");
  const conservadas = cols.filter((c) => c.tecnica === "Conservar");
  const porClase: Record<string, string[]> = {};
  for (const c of cols) {
    (porClase[c.clasificacion] ??= []).push(c.columna);
  }

  return (
    <Dialog
      open={!!entrada}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[88vh] flex-col p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2.5 pr-6">
            <DialogTitle className="font-heading text-lg font-bold text-slate-900">
              Detalle de la ejecución
            </DialogTitle>
            <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#004B87] ring-1 ring-slate-200">
              {entrada.id}
            </span>
            <StatusBadge tono={entrada.apto ? "ok" : "mal"} dot>
              {entrada.apto ? "Apto" : "No apto"}
            </StatusBadge>
          </div>
          <DialogDescription>
            Resumen técnico auditable · Solo metadatos, técnicas y conteos (nunca
            valores de personas).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          <div className="space-y-6 pb-4">
            {/* Resumen general */}
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Dirigida a", etiquetaDestinatario(entrada.destinatario)],
                ["Archivo de origen", entrada.archivo || "—"],
                ["Configuración", entrada.configuracion],
                ["Petición de anonimización", fechaHora(entrada.solicitadoEn)],
                ["Elaboración del dataset", fechaHora(entrada.elaboradoEn)],
                ["Periodo de atención", entrada.periodo || "—"],
                [
                  "Medición de riesgo (k)",
                  `Antes: ${entrada.kAntes} · Después: ${entrada.kDespues} · Meta ≥ ${entrada.kMeta}`,
                ],
                [
                  "Personas",
                  `Antes: ${num(entrada.personasAntes)} · Después: ${num(
                    entrada.personasDespues
                  )}`,
                ],
                [
                  "Verificaciones",
                  `${entrada.verificacionesCorrectas} de ${entrada.verificacionesTotal} correctas`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {k}
                  </p>
                  <p className="text-xs font-semibold text-slate-900">{v}</p>
                </div>
              ))}
            </div>

            {!cols.length ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                Esta ejecución se registró antes de que el sistema guardara el
                detalle por columna.
              </div>
            ) : (
              <>
                {/* Anonimizadas */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Datos anonimizados (
                    {anonimizadas.filter((c) => c.estado === "Aplicada").length}{" "}
                    con cambios de {anonimizadas.length})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Columna</TableHead>
                          <TableHead className="text-xs">Clasificación</TableHead>
                          <TableHead className="text-xs">Técnica</TableHead>
                          <TableHead className="text-xs">Cómo</TableHead>
                          <TableHead className="text-xs">Sale como</TableHead>
                          <TableHead className="text-right text-xs">
                            Celdas mod.
                          </TableHead>
                          <TableHead className="text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anonimizadas.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {c.columna}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {c.clasificacion}
                            </TableCell>
                            <TableCell className="text-xs">{c.tecnica}</TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {c.parametro || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {c.salida}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {num(c.modificadas)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tono={c.estado === "Aplicada" ? "ok" : "neutro"}
                              >
                                {c.estado}
                              </StatusBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Conservadas */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Datos conservados sin cambios ({conservadas.length} columnas)
                  </h4>
                  {conservadas.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">Columna</TableHead>
                            <TableHead className="text-xs">Clasificación</TableHead>
                            <TableHead className="text-xs">Cat. especial</TableHead>
                            <TableHead className="text-xs">
                              ¿La pide el estudio?
                            </TableHead>
                            <TableHead className="text-xs">Sale como</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conservadas.map((c, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {c.columna}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {c.clasificacion}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {c.categoria}
                              </TableCell>
                              <TableCell className="text-xs">
                                {c.solicitada}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {c.salida}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Ninguna columna se conservó sin cambios.
                    </p>
                  )}
                </div>

                {/* Clasificación */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Clasificación de columnas ({entrada.columnasClasificadas} de{" "}
                    {entrada.totalColumnas})
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Clasificación</TableHead>
                          <TableHead className="text-xs">Columnas</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(porClase).map(([clase, nombres]) => (
                          <TableRow key={clase}>
                            <TableCell className="text-xs font-semibold">
                              {clase}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-600">
                              {nombres.join(", ")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              {nombres.length}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Descargas */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Descargas</h4>
              {entrada.descargas?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Archivo</TableHead>
                        <TableHead className="text-xs">Fecha de entrega</TableHead>
                        <TableHead className="text-xs">Entregado a</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {entrada.descargas.map((x: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">
                            {x.archivo}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-slate-600">
                            {fechaHora(x.fecha)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {etiquetaDestinatario(x.entregadoA)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Este dataset no se ha descargado todavía.
                </p>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="size-3.5 text-[#007A53]" />
              Solo se muestran nombres de columnas, técnicas y conteos; nunca
              valores de las personas.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
