"use client";

import { useState } from "react";
import { TIPOS_LOG } from "@/motor/logs.js";
import { paginar, TAMANOS_PAGINA } from "@/motor/registro.js";
import { useApp } from "@/context/app-context";
import { getLogs, fechaHora } from "@/lib/servicios";
import { StatusBadge } from "@/components/shared/status-badge";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  ScrollText,
  Search,
} from "lucide-react";

const ROL_CORTO: Record<string, string> = {
  ti: "TI",
  ce: "Comité de ética",
  receptor: "Destinatario",
};

export function TiLogs() {
  const { tick } = useApp();
  const [tipoLog, setTipoLog] = useState("sesion");
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(TAMANOS_PAGINA[0]);

  void tick;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todos: any[] = getLogs().lista();
  const q = texto.trim().toLowerCase();

  const filtrados = todos.filter(
    (l) =>
      l.tipo === tipoLog &&
      (!q ||
        [l.usuario, l.accion, l.detalle, l.referencia].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q)
        ))
  );

  const pag = paginar(filtrados, pagina, porPagina);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">
            Logs del sistema
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Bitácora inmutable de accesos, peticiones, descargas y errores. Los
            registros solo se agregan: no se pueden borrar ni editar.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F1F8] px-3 py-1 text-xs font-semibold text-[#004B87]">
          <Lock className="size-3.5" />
          Auditoría inmutable (No repudio)
        </span>
      </div>

      {/* Categorías */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPOS_LOG as Record<string, string>).map(([k, label]) => {
          const count = todos.filter((l) => l.tipo === k).length;
          const active = tipoLog === k;
          return (
            <button
              key={k}
              type="button"
              id={`log-${k}`}
              aria-pressed={active}
              onClick={() => {
                setTipoLog(k);
                setPagina(1);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "bg-[#004B87] text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {(TIPOS_LOG as Record<string, string>)[tipoLog]}
            </CardTitle>
            <CardDescription>
              {pag.total
                ? `Mostrando ${pag.desde}–${pag.hasta} de ${pag.total} eventos.`
                : "Sin registros coincidentes."}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="log-buscar"
              type="search"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar usuario, acción, detalle o ref..."
              className="h-9 bg-white pl-9 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-0">
          {pag.total === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ScrollText className="size-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                No hay registros en esta sección
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Usuario</TableHead>
                    <TableHead className="text-xs">Rol</TableHead>
                    <TableHead className="text-xs">Acción</TableHead>
                    <TableHead className="text-xs">Detalle</TableHead>
                    <TableHead className="text-xs">Referencia</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {pag.filas.map((l: any, i: number) => (
                    <TableRow key={l.id ?? i} className="hover:bg-slate-50/70">
                      <TableCell className="text-xs tabular-nums text-slate-600">
                        {fechaHora(l.fecha)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium text-slate-800">
                        {l.usuario || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {ROL_CORTO[l.rol] ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900">
                        {l.accion}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-slate-600">
                        {l.detalle || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#004B87]">
                        {l.referencia || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tono={l.resultado === "fallo" ? "mal" : "ok"}
                          dot
                        >
                          {l.resultado === "fallo" ? "Fallo" : "Correcto"}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Filas por página</span>
              <NativeSelect
                id="log-por-pagina"
                value={String(porPagina)}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value));
                  setPagina(1);
                }}
                className="h-8 w-20 text-xs"
              >
                {(TAMANOS_PAGINA as number[]).map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pag.pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </Button>
              <span className="text-xs text-slate-600 tabular-nums">
                Página {pag.pagina} de {pag.paginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pag.pagina >= pag.paginas}
                onClick={() => setPagina((p) => p + 1)}
                className="h-8 gap-1 text-xs"
              >
                Siguiente
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
