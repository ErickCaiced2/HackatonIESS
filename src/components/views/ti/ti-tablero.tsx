"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from "recharts";
import { ESTADOS } from "@/motor/peticiones.js";
import { actividadPorDia, incidencias } from "@/motor/logs.js";
import {
  filtrarRegistro,
  paginar,
  TAMANOS_PAGINA,
  ejecucionCompleta,
  diaLocal,
} from "@/motor/registro.js";
import { num } from "@/motor/entregables.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import { useApp } from "@/context/app-context";
import { getLogs, getPeticiones, getRegistro, fechaCorta } from "@/lib/servicios";
import { StatusBadge } from "@/components/shared/status-badge";
import { NativeSelect } from "@/components/shared/native-select";
import { DetalleEjecucionDialog } from "@/components/views/ti/detalle-ejecucion-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TableIcon,
} from "lucide-react";
import type { Peticion } from "@/lib/types";

const COLORES_BARRAS = [
  "#004B87",
  "#007A53",
  "#0284C7",
  "#D97706",
  "#DC2626",
  "#64748B",
];

export function TiTablero() {
  const { irA, tick } = useApp();
  const [mostrarTablaActividad, setMostrarTablaActividad] = useState(false);
  const [filtros, setFiltros] = useState({
    peticionDesde: "",
    peticionHasta: "",
    entregaDesde: "",
    entregaHasta: "",
    texto: "",
  });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(TAMANOS_PAGINA[0]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detalleEntrada, setDetalleEntrada] = useState<any | null>(null);

  void tick;
  const todosLogs = getLogs().lista();
  const pets = getPeticiones().lista() as Peticion[];
  const inc = incidencias(todosLogs) as {
    errores: number;
    sesionesFallidas: number;
    devoluciones: number;
  };

  const completas = pets.filter((p) => p.estado === "descargada").length;
  const entregados = pets.reduce((a, p) => a + p.descargas.length, 0);
  const pendientes = pets.filter(
    (p) => p.estado === "enviada" || p.estado === "en_proceso"
  ).length;

  const actividadRaw = actividadPorDia(todosLogs, 14) as {
    dia: string;
    sesion: number;
    peticion: number;
    descarga: number;
    error: number;
  }[];
  const actividad = actividadRaw.map((d) => ({
    ...d,
    etiqueta: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`,
  }));

  const datosEstados = Object.entries(ESTADOS as Record<string, string>).map(
    ([k, nombre]) => ({
      nombre,
      valor: pets.filter((p) => p.estado === k).length,
    })
  );

  const datosIncidencias = [
    { nombre: "Errores", valor: inc.errores, color: "#DC2626" },
    {
      nombre: "Accesos fallidos",
      valor: inc.sesionesFallidas,
      color: "#D97706",
    },
    {
      nombre: "Devueltas",
      valor: inc.devoluciones,
      color: "#004B87",
    },
  ];

  // Registro de entregas completadas
  const entradasCompletas = getRegistro()
    .lista()
    .filter(ejecucionCompleta);

  const rangoMal =
    (filtros.peticionDesde &&
      filtros.peticionHasta &&
      filtros.peticionDesde > filtros.peticionHasta) ||
    (filtros.entregaDesde &&
      filtros.entregaHasta &&
      filtros.entregaDesde > filtros.entregaHasta);

  const filtradas = filtrarRegistro(entradasCompletas, filtros);
  const pag = paginar(filtradas, pagina, porPagina);
  const hoy = diaLocal(new Date().toISOString());

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">
            Resumen operativo y auditoría
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Monitoreo en tiempo real de peticiones completadas, datasets
            entregados, accesos e incidencias.
          </p>
        </div>
        <Button
          type="button"
          id="ir-peticiones"
          onClick={() => irA("ti-peticiones")}
          className="h-10 gap-2 bg-[#004B87] px-4 text-sm font-semibold text-white hover:bg-[#003366]"
        >
          Ir a peticiones
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {pendientes > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4.5 shrink-0 text-amber-600" />
            <span>
              <strong>{pendientes} petición(es) esperan atención de TI.</strong>
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => irA("ti-peticiones")}
            className="h-8 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
          >
            Revisar bandeja
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Peticiones completadas",
            value: completas,
            desc: "Llegaron hasta la descarga",
            icon: CheckCircle2,
            tone: "bg-[#E6F4EF] text-[#007A53]",
          },
          {
            label: "Datasets entregados",
            value: entregados,
            desc: "Archivos descargados por receptores",
            icon: Download,
            tone: "bg-[#E8F1F8] text-[#004B87]",
          },
          {
            label: "Errores registrados",
            value: inc.errores,
            desc: "Reportados en la bitácora",
            icon: AlertOctagon,
            tone:
              inc.errores > 0
                ? "bg-red-50 text-red-600"
                : "bg-slate-100 text-slate-500",
          },
          {
            label: "Incidencias totales",
            value: inc.errores + inc.sesionesFallidas + inc.devoluciones,
            desc: "Errores, accesos fallidos y devoluciones",
            icon: ShieldAlert,
            tone:
              inc.errores + inc.sesionesFallidas + inc.devoluciones > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-slate-200 shadow-2xs">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  {kpi.label}
                </p>
                <p className="mt-1.5 font-heading text-3xl font-bold text-slate-900 tabular-nums">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{kpi.desc}</p>
              </div>
              <div
                className={`flex size-10 items-center justify-center rounded-xl ${kpi.tone}`}
              >
                <kpi.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos Recharts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-2xs lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-base">
                Actividad de los últimos 14 días
              </CardTitle>
              <CardDescription>
                Eventos diarios registrados por categoría de auditoría
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMostrarTablaActividad((v) => !v)}
              className="h-8 gap-1.5 text-xs"
            >
              <TableIcon className="size-3.5" />
              {mostrarTablaActividad ? "Ocultar tabla" : "Ver tabla"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={actividad}
                  margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gSesion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004B87" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#004B87" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPeticion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007A53" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#007A53" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="etiqueta"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={{ stroke: "#CBD5E1" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={{ stroke: "#CBD5E1" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="sesion"
                    name="Inicios de sesión"
                    stroke="#004B87"
                    strokeWidth={2}
                    fill="url(#gSesion)"
                  />
                  <Area
                    type="monotone"
                    dataKey="peticion"
                    name="Peticiones"
                    stroke="#007A53"
                    strokeWidth={2}
                    fill="url(#gPeticion)"
                  />
                  <Area
                    type="monotone"
                    dataKey="descarga"
                    name="Descargas"
                    stroke="#0284C7"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="error"
                    name="Errores"
                    stroke="#DC2626"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {mostrarTablaActividad && (
              <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-right text-xs">
                        Sesiones
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Peticiones
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Descargas
                      </TableHead>
                      <TableHead className="text-right text-xs">
                        Errores
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actividad.map((d) => (
                      <TableRow key={d.dia}>
                        <TableCell className="font-mono text-xs">
                          {d.etiqueta}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.sesion}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.peticion}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.descarga}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peticiones por estado */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Peticiones por estado</CardTitle>
            <CardDescription>{pets.length} peticiones en total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={datosEstados}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={96}
                    tick={{ fontSize: 11, fill: "#334155" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="valor" name="Cantidad" radius={[0, 6, 6, 0]}>
                    {datosEstados.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORES_BARRAS[i % COLORES_BARRAS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Incidencias por tipo */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Incidencias por tipo</CardTitle>
            <CardDescription>Acumulado desde el inicio del registro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={datosIncidencias}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={108}
                    tick={{ fontSize: 11, fill: "#334155" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="valor" name="Eventos" radius={[0, 6, 6, 0]}>
                    {datosIncidencias.map((item, i) => (
                      <Cell key={i} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registro de entregas completadas */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Entregas completadas</CardTitle>
              <CardDescription>
                Ejecuciones APTAS publicadas y descargadas por su destinatario
                autorizado.
              </CardDescription>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EF] px-2.5 py-1 text-[11px] font-semibold text-[#007A53]">
              <ShieldCheck className="size-3.5" />
              No repudio (solo lectura)
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5">
          {entradasCompletas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                Todavía no hay entregas completas
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Aquí aparecerán automáticamente las peticiones que hayan sido
                publicadas y descargadas por el destinatario.
              </p>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="f-peticionDesde" className="text-xs">
                      Petición desde
                    </Label>
                    <Input
                      id="f-peticionDesde"
                      type="date"
                      max={filtros.peticionHasta || hoy}
                      value={filtros.peticionDesde}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, peticionDesde: e.target.value }));
                        setPagina(1);
                      }}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="f-peticionHasta" className="text-xs">
                      Petición hasta
                    </Label>
                    <Input
                      id="f-peticionHasta"
                      type="date"
                      min={filtros.peticionDesde || undefined}
                      max={hoy}
                      value={filtros.peticionHasta}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, peticionHasta: e.target.value }));
                        setPagina(1);
                      }}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="f-entregaDesde" className="text-xs">
                      Entrega desde
                    </Label>
                    <Input
                      id="f-entregaDesde"
                      type="date"
                      max={filtros.entregaHasta || hoy}
                      value={filtros.entregaDesde}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, entregaDesde: e.target.value }));
                        setPagina(1);
                      }}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="f-entregaHasta" className="text-xs">
                      Entrega hasta
                    </Label>
                    <Input
                      id="f-entregaHasta"
                      type="date"
                      min={filtros.entregaDesde || undefined}
                      max={hoy}
                      value={filtros.entregaHasta}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, entregaHasta: e.target.value }));
                        setPagina(1);
                      }}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="f-texto" className="text-xs">
                      Destinatario, archivo o código
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="f-texto"
                        type="search"
                        placeholder="Ej.: IESS-0002"
                        value={filtros.texto}
                        onChange={(e) => {
                          setFiltros((f) => ({ ...f, texto: e.target.value }));
                          setPagina(1);
                        }}
                        className="h-9 bg-white pl-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {pag.total > 0
                      ? `Mostrando ${num(pag.desde)}–${num(pag.hasta)} de ${num(
                          pag.total
                        )} ejecuciones`
                      : "Ninguna ejecución coincide con los filtros."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFiltros({
                        peticionDesde: "",
                        peticionHasta: "",
                        entregaDesde: "",
                        entregaHasta: "",
                        texto: "",
                      });
                      setPagina(1);
                    }}
                    className="h-7 gap-1 bg-white text-xs"
                  >
                    <RotateCcw className="size-3" />
                    Limpiar filtros
                  </Button>
                </div>
              </div>

              {rangoMal && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  La fecha inicial no puede ser posterior a la fecha final.
                </div>
              )}

              {pag.total > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Petición</TableHead>
                        <TableHead className="text-xs">Elaboración</TableHead>
                        <TableHead className="text-xs">Dirigida a</TableHead>
                        <TableHead className="text-xs">Archivo</TableHead>
                        <TableHead className="text-xs">Riesgo k</TableHead>
                        <TableHead className="text-xs">Anonimización</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Entrega</TableHead>
                        <TableHead className="text-right text-xs">
                          Detalle
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {pag.filas.map((e: any) => {
                        const ultima = e.descargas[e.descargas.length - 1];
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs tabular-nums text-slate-600">
                              {fechaCorta(e.solicitadoEn)}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-slate-600">
                              {fechaCorta(e.elaboradoEn)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">
                              {etiquetaDestinatario(e.destinatario)}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate font-mono text-xs text-slate-700">
                              {e.archivo || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <StatusBadge
                                  tono={e.kDespues >= e.kMeta ? "ok" : "mal"}
                                >
                                  k = {e.kDespues}
                                </StatusBadge>
                                <p className="text-[11px] text-slate-500">
                                  Antes {e.kAntes} · meta ≥ {e.kMeta}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-semibold text-slate-800">
                                {e.anonimizaciones} cols.
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {e.columnasClasificadas}/{e.totalColumnas} clasif.
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusBadge tono={e.apto ? "ok" : "mal"} dot>
                                {e.apto ? "Apto" : "No apto"}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>
                              {ultima ? (
                                <div>
                                  <p className="text-xs tabular-nums text-slate-800">
                                    {fechaCorta(ultima.fecha)}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {e.descargas.length} archivo(s)
                                  </p>
                                </div>
                              ) : (
                                <StatusBadge tono="neutro">
                                  Sin entrega
                                </StatusBadge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDetalleEntrada(e)}
                                className="h-8 gap-1 text-xs"
                              >
                                <Eye className="size-3.5" />
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Paginación */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Filas por página</span>
                  <NativeSelect
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
            </>
          )}

          <p className="text-xs text-slate-500">
            El registro no contiene datos de personas atendidas: solo fechas,
            identificadores de destinatarios, conteos, nombres de columnas y
            resultados. Por no repudio no se puede borrar ni modificar.
          </p>
        </CardContent>
      </Card>

      <DetalleEjecucionDialog
        entrada={detalleEntrada}
        onClose={() => setDetalleEntrada(null)}
      />
    </div>
  );
}
