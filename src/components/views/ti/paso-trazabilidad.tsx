"use client";

import { useState } from "react";
import { num } from "@/motor/entregables.js";
import { useApp } from "@/context/app-context";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";

export function PasoTrazabilidad() {
  const { proceso, setPasoActivo } = useApp();
  const [busquedaCol, setBusquedaCol] = useState("");

  if (!proceso.r) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
          <Lock className="size-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          El recorrido aparece después de proteger los datos
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPasoActivo("proteccion")}
          className="mt-4 gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Ir al paso 2 (Protección)
        </Button>
      </div>
    );
  }

  const r = proceso.r;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctas = r.verificaciones.filter((v: any) => v.ok).length;
  const todasOk = correctas === r.verificaciones.length;

  const par = (antes: unknown, despues: unknown): [string, string] => {
    if (despues === undefined) return ["—", "—"];
    const fmt = (x: unknown) =>
      typeof x === "number" ? num(x) : String(x ?? "—");
    return [fmt(antes), fmt(despues)];
  };

  const q = busquedaCol.trim().toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trazaFiltrada = (r.traza as any[]).filter(
    (t) =>
      !q ||
      [
        t.columna_entrada,
        t.tecnica,
        t.parametro,
        t.columna_salida,
        t.justificacion,
        t.estado,
      ].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
  );

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm ${
          todasOk
            ? "border-emerald-200 bg-[#E6F4EF] text-[#005C3E]"
            : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {todasOk ? (
            <ShieldCheck className="size-5 shrink-0 text-[#007A53]" />
          ) : (
            <AlertCircle className="size-5 shrink-0 text-red-600" />
          )}
          <span className="font-semibold">
            {correctas} de {r.verificaciones.length} verificaciones automáticas
            (V-01 a V-08) correctas.
          </span>
        </div>

        <Button
          type="button"
          onClick={() => setPasoActivo("publicar")}
          className="gap-1.5 bg-[#004B87] text-xs text-white hover:bg-[#003366]"
        >
          Ir a Publicar
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <Tabs defaultValue="recorrido" className="space-y-4">
        <TabsList className="h-10 bg-slate-100 p-1">
          <TabsTrigger value="recorrido" className="px-4 text-xs font-semibold">
            Paso a paso ({r.recorrido.length})
          </TabsTrigger>
          <TabsTrigger value="columnas" className="px-4 text-xs font-semibold">
            Por columna ({r.traza.length})
          </TabsTrigger>
          <TabsTrigger
            value="verificaciones"
            className="px-4 text-xs font-semibold"
          >
            Verificaciones ({correctas}/{r.verificaciones.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Paso a paso */}
        <TabsContent value="recorrido">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead rowSpan={2} className="text-xs">
                    #
                  </TableHead>
                  <TableHead rowSpan={2} className="text-xs">
                    Operación
                  </TableHead>
                  <TableHead rowSpan={2} className="text-xs">
                    Regla
                  </TableHead>
                  <TableHead rowSpan={2} className="text-xs">
                    Vuelta
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-l border-slate-200 text-center text-xs"
                  >
                    Personas
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-l border-slate-200 text-center text-xs"
                  >
                    Atenciones
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-l border-slate-200 text-center text-xs"
                  >
                    k
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-l border-slate-200 text-center text-xs"
                  >
                    Grupos 1 diag.
                  </TableHead>
                </TableRow>
                <TableRow className="bg-slate-50/70">
                  <TableHead className="border-l border-slate-200 text-right text-[11px]">
                    Antes
                  </TableHead>
                  <TableHead className="text-right text-[11px]">
                    Después
                  </TableHead>
                  <TableHead className="border-l border-slate-200 text-right text-[11px]">
                    Antes
                  </TableHead>
                  <TableHead className="text-right text-[11px]">
                    Después
                  </TableHead>
                  <TableHead className="border-l border-slate-200 text-right text-[11px]">
                    Antes
                  </TableHead>
                  <TableHead className="text-right text-[11px]">
                    Después
                  </TableHead>
                  <TableHead className="border-l border-slate-200 text-right text-[11px]">
                    Antes
                  </TableHead>
                  <TableHead className="text-right text-[11px]">
                    Después
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {r.recorrido.map((o: any, i: number) => {
                  const [pA, pD] = par(o.personasAntes, o.personasDespues);
                  const [aA, aD] = par(o.atencionesAntes, o.atencionesDespues);
                  const [kA, kD] = par(o.kAntes, o.kDespues);
                  const [hA, hD] = par(o.homogeneosAntes, o.homogeneosDespues);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900">
                        {o.operacion}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-slate-600">
                        {o.regla}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {o.vuelta ?? "—"}
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right font-mono text-xs">
                        {pA}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {pD}
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right font-mono text-xs">
                        {aA}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {aD}
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right font-mono text-xs">
                        {kA}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-[#004B87]">
                        {kD}
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right font-mono text-xs">
                        {hA}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {hD}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Por columna */}
        <TabsContent value="columnas" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={busquedaCol}
              onChange={(e) => setBusquedaCol(e.target.value)}
              placeholder="Buscar columna, técnica o estado..."
              className="h-9 bg-white pl-9 text-xs"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Columna</TableHead>
                  <TableHead className="text-xs">Qué se hizo</TableHead>
                  <TableHead className="text-xs">Cómo</TableHead>
                  <TableHead className="text-xs">Sale como</TableHead>
                  <TableHead className="text-right text-xs">
                    Celdas cambiadas
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Distintos (Antes / Desp.)
                  </TableHead>
                  <TableHead className="text-xs">Por qué</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trazaFiltrada.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {t.columna_entrada}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-[#004B87]">
                      {t.tecnica}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {t.parametro || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">
                      {t.columna_salida}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {num(t.valores_modificados)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {num(t.distintos_antes)} / {num(t.distintos_despues)}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-slate-600">
                      {t.justificacion}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tono={t.estado === "Aplicada" ? "ok" : "neutro"}
                      >
                        {t.estado}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 3: Verificaciones V-01..V-08 */}
        <TabsContent value="verificaciones">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {r.verificaciones.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {v.ok ? (
                    <CheckCircle2 className="size-4.5 shrink-0 text-[#007A53]" />
                  ) : (
                    <AlertCircle className="size-4.5 shrink-0 text-red-600" />
                  )}
                  <div>
                    <span className="mr-2 font-mono text-xs font-bold text-[#004B87]">
                      {v.id}
                    </span>
                    <span className="text-sm text-slate-800">{v.texto}</span>
                  </div>
                </div>
                <StatusBadge tono={v.ok ? "ok" : "mal"} dot>
                  {v.ok ? "Correcta" : "Falló"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <p className="font-mono text-xs text-slate-500">
        Código de esta ejecución: {r.id}
      </p>
    </div>
  );
}
