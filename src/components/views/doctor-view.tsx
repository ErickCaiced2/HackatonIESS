"use client";

import { useState } from "react";
import { ACUERDO, acuerdoTexto } from "@/motor/entregables.js";
import { zip } from "@/motor/zip.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import { useApp } from "@/context/app-context";
import {
  getPeticiones,
  getRegistro,
  registrarLog,
  mostrarError,
  notificarOk,
  notificarAviso,
  fechaCorta,
  fechaHora,
  descargar,
  describirFiltro,
} from "@/lib/servicios";
import { leerArchivo } from "@/lib/archivos";
import { EstadoPeticionBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Inbox,
  Lock,
  ShieldCheck,
  Signature,
} from "lucide-react";
import type { Peticion } from "@/lib/types";

const DISPONIBLES = ["publicada", "firmada", "descargada"];

interface EntregaGuardada {
  base: string;
  ejecucionId: string;
  csv: string;
  config: string;
  traza: string;
  pta: string;
}

const ARCHIVOS = [
  {
    tipo: "zip",
    titulo: "Descargar todo (ZIP)",
    desc: "Paquete completo con CSV, configuración, trazabilidad, PTA y acuerdo firmado",
    icon: Archive,
    principal: true,
  },
  {
    tipo: "csv",
    titulo: "Solo CSV",
    desc: "Dataset anonimizado",
    icon: FileSpreadsheet,
    principal: false,
  },
  {
    tipo: "config",
    titulo: "Solo configuración",
    desc: "Parámetros JSON",
    icon: FileCode2,
    principal: false,
  },
  {
    tipo: "traza",
    titulo: "Solo trazabilidad",
    desc: "Auditoría JSON",
    icon: FileCode2,
    principal: false,
  },
  {
    tipo: "pta",
    titulo: "Solo PTA",
    desc: "Informe técnico HTML",
    icon: FileText,
    principal: false,
  },
] as const;

export function DoctorView() {
  const { usuario, tick, refrescar } = useApp();
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [acepto, setAcepto] = useState(false);

  void tick;
  if (!usuario?.destinatario) return null;

  const mias = getPeticiones().paraDestinatario(
    usuario.destinatario
  ) as Peticion[];
  const abierta = abiertaId ? mias.find((x) => x.id === abiertaId) : null;

  const handleFirmar = (p: Peticion) => {
    if (!acepto) {
      notificarAviso(
        "Confirmación requerida",
        "Marque «He leído y acepto este acuerdo» para firmar."
      );
      return;
    }
    try {
      getPeticiones().firmar(p.id, usuario);
      registrarLog(
        "peticion",
        "Acuerdo firmado",
        `Versión ${ACUERDO.version}`,
        { referencia: p.id }
      );
      notificarOk(
        "Acuerdo firmado correctamente",
        "Las descargas están habilitadas."
      );
      refrescar();
    } catch (e) {
      mostrarError(
        e instanceof Error ? e.message : String(e),
        "Firmar acuerdo"
      );
    }
  };

  const handleDescargar = async (p: Peticion, tipo: string) => {
    try {
      const e = await leerArchivo<EntregaGuardada>("entrega:" + p.id);
      if (!e) {
        throw new Error(
          "No se encontraron los archivos publicados de esta petición en este navegador."
        );
      }
      const entregadoA = { ...p.destinatario };
      const traza = JSON.stringify(
        {
          ...JSON.parse(e.traza),
          entregado_a: entregadoA,
          acuerdo_confidencialidad: {
            version: ACUERDO.version,
            firmado_en: p.firmadoEn,
            firmado_por: usuario.usuario,
          },
        },
        null,
        2
      );

      const archivos: Record<string, [string, string, string]> = {
        csv: [e.base + "_salida.csv", e.csv, "text/csv;charset=utf-8"],
        config: [e.base + "_configuracion.json", e.config, "application/json"],
        traza: [e.base + "_trazabilidad.json", traza, "application/json"],
        pta: [e.base + "_PTA.html", e.pta, "text/html;charset=utf-8"],
      };

      const elegido: [string, BlobPart, string] =
        tipo === "zip"
          ? [
              e.base + "_paquete.zip",
              zip([
                ...Object.values(archivos).map(([n, c]) => [n, c]),
                [
                  e.base + "_acuerdo.txt",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (acuerdoTexto as any)(e.ejecucionId, p.firmadoEn, p.destinatario),
                ],
              ]),
              "application/zip",
            ]
          : archivos[tipo];

      getPeticiones().registrarDescarga(
        p.id,
        { archivo: elegido[0], tipo },
        usuario
      );
      getRegistro().descarga(
        e.ejecucionId,
        elegido[0],
        new Date().toISOString(),
        entregadoA
      );
      registrarLog("descarga", `Descarga ${tipo.toUpperCase()}`, elegido[0], {
        referencia: p.id,
      });
      descargar(...elegido);
      notificarOk("Descarga iniciada", elegido[0]);
      refrescar();
    } catch (err) {
      mostrarError(
        err instanceof Error ? err.message : String(err),
        "Descargar entregable"
      );
    }
  };

  // Vista de detalle de una petición
  if (abierta) {
    const firmada = !!abierta.firmadoEn;
    const fechaPublicada = abierta.historial.find(
      (x) => x.estado === "publicada"
    )?.fecha;

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              id="volver-lista"
              onClick={() => {
                setAbiertaId(null);
                setAcepto(false);
              }}
              className="-ml-2 mb-1 gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              Mis peticiones
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Petición <span className="font-mono text-[#004B87]">{abierta.id}</span>
              </h2>
              <EstadoPeticionBadge estado={abierta.estado} />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Dirigida a</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {etiquetaDestinatario(abierta.destinatario)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500">
                Datos solicitados
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {describirFiltro(abierta.filtro)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Publicada por TI
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700 tabular-nums">
                {fechaHora(fechaPublicada)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Acuerdo de confidencialidad */}
        <Card
          className={`overflow-hidden border ${
            firmada
              ? "border-emerald-200 bg-[#E6F4EF]/30"
              : "border-[#004B87]/25 bg-white shadow-sm"
          }`}
        >
          <CardHeader className="border-b border-slate-200/80 bg-[#E8F1F8]/50 pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#003366]">
                <Signature className="size-4.5 text-[#004B87]" />
                Acuerdo de confidencialidad y uso responsable
              </CardTitle>
              <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#004B87] ring-1 ring-[#004B87]/20">
                v{ACUERDO.version}
              </span>
            </div>
            <CardDescription className="text-slate-600">
              Los archivos derivan de datos de salud protegidos. Para descargar
              cualquiera de ellos, el destinatario asume los siguientes
              compromisos:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <ol className="space-y-2.5 text-sm text-slate-700">
              {(ACUERDO.condiciones as string[]).map((c, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E8F1F8] text-xs font-bold text-[#004B87]">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{c}</span>
                </li>
              ))}
            </ol>

            {firmada ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-[#E6F4EF] p-4 text-sm text-[#005C3E]">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#007A53]" />
                <div>
                  <p className="font-semibold">Acuerdo firmado y registrado</p>
                  <p className="mt-0.5 text-xs">
                    Firmado el {fechaHora(abierta.firmadoEn)} por{" "}
                    {etiquetaDestinatario(abierta.destinatario)}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    id="acepto"
                    checked={acepto}
                    onCheckedChange={(v) => setAcepto(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    He leído y acepto este acuerdo de confidencialidad y uso
                  </span>
                </label>

                <Button
                  type="button"
                  id="firmar"
                  onClick={() => handleFirmar(abierta)}
                  className="gap-2 bg-[#007A53] px-5 text-white hover:bg-[#006343]"
                >
                  <ShieldCheck className="size-4" />
                  Firmar acuerdo y habilitar descargas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Descargas */}
        <Card
          className={`border-slate-200 shadow-2xs transition-opacity ${
            firmada ? "bg-white" : "border-dashed bg-slate-50/90 opacity-80"
          }`}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {firmada ? (
                <Download className="size-4.5 text-[#007A53]" />
              ) : (
                <Lock className="size-4.5 text-slate-500" />
              )}
              {firmada ? "Archivos entregables" : "Descargas bloqueadas"}
            </CardTitle>
            <CardDescription>
              {firmada
                ? "Todas las descargas quedan registradas en la bitácora de auditoría del IESS."
                : "Firme el acuerdo de confidencialidad superior para habilitar la descarga de archivos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ARCHIVOS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.tipo}
                    type="button"
                    id={`bajar-${item.tipo}`}
                    disabled={!firmada}
                    onClick={() => handleDescargar(abierta, item.tipo)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.principal
                        ? "border-[#004B87] bg-[#004B87] text-white shadow-sm hover:bg-[#003366] sm:col-span-2 lg:col-span-3"
                        : "border-slate-200 bg-white text-slate-800 hover:border-[#004B87] hover:bg-[#E8F1F8]/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        item.principal
                          ? "bg-white/15 text-white"
                          : "bg-[#E8F1F8] text-[#004B87]"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.titulo}</p>
                      <p
                        className={`mt-0.5 text-xs ${
                          item.principal ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {item.desc}
                      </p>
                    </div>
                    <Download
                      className={`mt-1 size-4 shrink-0 ${
                        item.principal ? "text-emerald-300" : "text-slate-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {abierta.descargas.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Historial de descargas registradas
                </h4>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Archivo</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abierta.descargas.map((d, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-slate-800">
                            {d.archivo}
                          </TableCell>
                          <TableCell className="text-xs font-semibold uppercase text-[#004B87]">
                            {d.tipo}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-slate-600">
                            {fechaHora(d.fecha)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Use los datos únicamente para el estudio aprobado, sin intentar
              reidentificar personas ni cruzar fuentes externas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Listado de peticiones del doctor / autorizado
  const porFirmar = mias.filter((x) => x.estado === "publicada").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900">
          Mis peticiones
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Peticiones dirigidas a{" "}
          <strong className="font-semibold text-slate-900">
            {etiquetaDestinatario(usuario.destinatario)}
          </strong>
          . Abra una petición publicada para firmar el acuerdo de
          confidencialidad y descargar.
        </p>
      </div>

      {porFirmar > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
          <span>
            <strong>{porFirmar} petición(es) esperan su firma</strong> para
            habilitar la descarga del paquete protegido.
          </span>
        </div>
      )}

      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-0">
          {mias.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="size-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No tiene peticiones dirigidas a su código
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Cuando el Comité de Ética y TI publiquen un dataset asignado a su
                identificador, aparecerá automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="font-semibold text-slate-600">
                      Petición
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Recibida
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Datos solicitados
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Estado
                    </TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mias.map((x) => {
                    const disponible = DISPONIBLES.includes(x.estado);
                    return (
                      <TableRow key={x.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-[#004B87]">
                          {x.id}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-slate-600">
                          {fechaCorta(x.creadaEn)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {describirFiltro(x.filtro)}
                        </TableCell>
                        <TableCell>
                          <EstadoPeticionBadge estado={x.estado} />
                        </TableCell>
                        <TableCell className="text-right">
                          {disponible ? (
                            <Button
                              type="button"
                              size="sm"
                              id={`abrir-${x.id}`}
                              variant={
                                x.estado === "publicada" ? "default" : "outline"
                              }
                              className={
                                x.estado === "publicada"
                                  ? "h-8 gap-1.5 bg-[#004B87] text-xs text-white hover:bg-[#003366]"
                                  : "h-8 gap-1.5 text-xs"
                              }
                              onClick={() => {
                                setAbiertaId(x.id);
                                setAcepto(false);
                                registrarLog(
                                  "peticion",
                                  "Petición consultada",
                                  "",
                                  { referencia: x.id }
                                );
                              }}
                            >
                              {x.estado === "publicada" ? (
                                <>
                                  <Signature className="size-3.5" />
                                  Abrir y firmar
                                </>
                              ) : (
                                "Abrir"
                              )}
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="size-3.5" />
                              En preparación por TI
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
