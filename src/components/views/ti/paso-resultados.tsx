"use client";

import { num, pct, ident } from "@/motor/entregables.js";
import { nombreCIE10 } from "@/motor/cie10.js";
import { useApp } from "@/context/app-context";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  XCircle,
} from "lucide-react";

export function PasoResultados() {
  const { proceso, setPasoActivo } = useApp();

  if (!proceso.r) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
          <Lock className="size-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          {proceso.desactualizado
            ? "Los resultados anteriores quedaron desactualizados tras modificar la configuración."
            : "Todavía no se han protegido los datos."}
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
  const a = r.antes;
  const d = r.despues;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallas = r.verificaciones.filter((v: any) => !v.ok);
  const sinIdent =
    d.identificadores.columnas + d.identificadores.texto === 0;
  const { referencia, propia } = proceso.historial;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resumenConfig = (x: any) => [
    num(x.despues.personas),
    x.despues.kMin,
    pct(x.conservadas),
    `${pct(x.consulta.maximo)} / ${pct(x.consulta.promedio)}`,
    x.despues.homogeneos.length,
  ];

  const personas80Mas = new Set(
    r.salida
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => f.grupo_edad === "80+")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => f.id_paciente_estudio)
  ).size;

  return (
    <div className="space-y-6">
      {!r.cohorte.esEstudio && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          Exploración con {r.cohorte.etiquetaFiltro}: no se puede entregar.
        </div>
      )}

      {/* Veredicto prominente */}
      <div
        className={`flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-5 ${
          r.apto
            ? "border-emerald-200 bg-gradient-to-r from-[#E6F4EF] to-emerald-50/40"
            : "border-red-200 bg-gradient-to-r from-red-50 to-rose-50/40"
        }`}
      >
        <div className="flex items-start gap-3.5">
          {r.apto ? (
            <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-[#007A53]" />
          ) : (
            <XCircle className="mt-0.5 size-7 shrink-0 text-red-600" />
          )}
          <div>
            <p
              className={`font-heading text-xl font-bold ${
                r.apto ? "text-[#006343]" : "text-red-700"
              }`}
            >
              {r.apto ? "APTO para continuar" : "NO APTO para entrega"}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {r.apto
                ? `Pasó todos los controles medidos con la configuración ${r.config.tipo}. Recuerde: anonimizar reduce el riesgo, no implica riesgo cero.`
                : `Falló: ${fallas
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((v: any) => `${v.id} ${v.texto}`)
                    .join("; ")}. Ajuste la configuración y vuelva a medir.`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {!r.apto ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasoActivo("proteccion")}
              className="gap-1.5 border-red-300 bg-white text-red-700 hover:bg-red-50"
            >
              <ArrowLeft className="size-4" />
              Ajustar protección
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setPasoActivo("trazabilidad")}
              className="gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
            >
              Revisar trazabilidad
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 4 Indicadores principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Grupo más pequeño (k)",
            val: String(d.kMin),
            sub: `Antes: ${a.kMin}. Meta: 5 o más`,
            ok: d.kMin >= 5,
          },
          {
            label: "Personas únicas",
            val: pct(d.pctUnicas),
            sub: `Antes: ${pct(a.pctUnicas)}. Meta: 0 %`,
            ok: d.pctUnicas === 0 && d.personas > 0,
          },
          {
            label: "Identificadores detectados",
            val: String(d.identificadores.columnas + d.identificadores.texto),
            sub: `Antes: ${ident(a.identificadores)}`,
            ok: sinIdent,
          },
          {
            label: "Personas conservadas",
            val: pct(r.conservadas),
            sub: `${num(d.personas)} de ${num(a.personas)} · Utilidad`,
            ok: undefined as boolean | undefined,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
          >
            {kpi.ok !== undefined && (
              <span
                className={`absolute top-4 right-4 size-2.5 rounded-full ${
                  kpi.ok ? "bg-[#007A53]" : "bg-red-500"
                }`}
              />
            )}
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900 tabular-nums">
              {kpi.val}
            </p>
            <p
              className={`mt-1 text-xs ${
                kpi.ok === true
                  ? "text-[#007A53]"
                  : kpi.ok === false
                  ? "text-red-600"
                  : "text-slate-500"
              }`}
            >
              {kpi.ok === undefined
                ? kpi.sub
                : `${kpi.ok ? "Cumple" : "No cumple"} · ${kpi.sub}`}
            </p>
          </div>
        ))}
      </div>

      {d.homogeneos.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            <strong>
              {d.homogeneos.length} grupo(s) comparten un solo diagnóstico:
            </strong>{" "}
            se podría deducir la condición médica. Puede activar l-diversidad en
            la configuración «Propia».
          </span>
        </div>
      )}

      {/* Tabla Antes y Después */}
      <div className="space-y-2.5">
        <h3 className="font-heading text-sm font-bold text-slate-900">
          Comparativa Antes y Después (tabla para el jurado)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Indicador</TableHead>
                <TableHead className="text-xs">Antes</TableHead>
                <TableHead className="text-xs font-bold text-[#004B87]">
                  Después
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Personas", num(a.personas), num(d.personas)],
                ["Atenciones", num(a.atenciones), num(d.atenciones)],
                ["Grupo más pequeño, k (meta: 5 o más)", a.kMin, d.kMin],
                [
                  "Personas únicas (meta: 0 %)",
                  pct(a.pctUnicas),
                  pct(d.pctUnicas),
                ],
                [
                  "Identificadores que quedan (meta: 0)",
                  ident(a.identificadores),
                  ident(d.identificadores),
                ],
                ["Personas conservadas", "100 %", pct(r.conservadas)],
                [
                  "Cambio en la consulta del estudio: máximo / promedio",
                  "—",
                  `${pct(r.consulta.maximo)} / ${pct(r.consulta.promedio)}`,
                ],
              ].map(([ind, antesVal, despVal]) => (
                <TableRow key={String(ind)}>
                  <TableCell className="text-xs font-medium text-slate-800">
                    {ind}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 tabular-nums">
                    {antesVal}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {despVal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Comparación Referencia vs Propia si ambas se ejecutaron */}
      {referencia && propia && (
        <div className="space-y-2.5">
          <h3 className="font-heading text-sm font-bold text-slate-900">
            Comparación de configuraciones (Referencia vs. Propia)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Configuración</TableHead>
                  <TableHead className="text-xs">Personas</TableHead>
                  <TableHead className="text-xs">k</TableHead>
                  <TableHead className="text-xs">Conservadas</TableHead>
                  <TableHead className="text-xs">Cambio máx. / prom.</TableHead>
                  <TableHead className="text-xs">
                    Grupos con 1 diagnóstico
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Referencia", ...resumenConfig(referencia)],
                  ["Propia", ...resumenConfig(propia)],
                ].map((fila) => (
                  <TableRow key={String(fila[0])}>
                    {fila.map((celda, idx) => (
                      <TableCell
                        key={idx}
                        className={
                          idx === 0
                            ? "text-xs font-bold text-[#004B87]"
                            : "font-mono text-xs tabular-nums"
                        }
                      >
                        {celda}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Desplegables técnicos */}
      <Accordion className="space-y-2">
        <AccordionItem
          value="consulta"
          className="rounded-xl border border-slate-200 bg-white px-4"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver personas por región y sexo (consulta del estudio)
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Región · sexo</TableHead>
                    <TableHead className="text-right text-xs">Antes</TableHead>
                    <TableHead className="text-right text-xs">Después</TableHead>
                    <TableHead className="text-right text-xs">
                      Diferencia
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {r.consulta.celdas.map((c: any) => (
                    <TableRow key={c.celda}>
                      <TableCell className="text-xs font-medium">
                        {c.celda}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {num(c.antes)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {num(c.despues)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {pct(c.cambio)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="homogeneos"
          className="rounded-xl border border-slate-200 bg-white px-4"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver grupos con un solo diagnóstico ({d.homogeneos.length})
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5 pb-4">
            <p className="text-xs text-slate-500">
              Información exclusiva para el operador de TI. Nunca se envía al
              investigador.
            </p>
            {d.homogeneos.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Grupo</TableHead>
                      <TableHead className="text-right text-xs">
                        Personas
                      </TableHead>
                      <TableHead className="text-xs">Diagnóstico</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {d.homogeneos.map((g: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {g.combinacion}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {g.personas}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono font-semibold">
                            {g.diagnostico}
                          </span>{" "}
                          · {nombreCIE10(g.diagnostico)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                No se detectaron grupos homogéneos.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="controles"
          className="rounded-xl border border-slate-200 bg-white px-4"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver controles para casos especiales
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Control</TableHead>
                    <TableHead className="text-right text-xs">
                      Cantidad
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    [
                      "Atenciones excluidas por menor de 18 (dentro del filtro de diagnóstico)",
                      num(r.cohorte.excluidas.menor),
                    ],
                    [
                      "Personas en el grupo 80+ en la salida",
                      num(personas80Mas),
                    ],
                    ...r.recorrido
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .filter((o: any) => o.operacion.startsWith("Supresión"))
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .map((o: any) => [
                        `Personas retiradas: ${o.operacion.toLowerCase()} (vuelta ${
                          o.vuelta
                        })`,
                        num(o.personasAntes - o.personasDespues),
                      ]),
                    [
                      "Celdas de texto con identificador antes",
                      num(a.identificadores.texto),
                    ],
                  ].map(([lbl, cant]) => (
                    <TableRow key={String(lbl)}>
                      <TableCell className="text-xs">{lbl}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {cant}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-xs text-slate-500">
        Nota técnica: k no incluye año-mes, tipo de atención, diagnóstico ni
        estancia. Quien conozca esos atributos externos podría distinguir a una
        persona.
      </p>
    </div>
  );
}
