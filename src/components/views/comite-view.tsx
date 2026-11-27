"use client";

import { useRef, useState } from "react";
import { validarPeticion } from "@/motor/peticiones.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import { FILTRO_ESTUDIO } from "@/motor/cie10.js";
import { useApp } from "@/context/app-context";
import {
  getPeticiones,
  registrarLog,
  mostrarError,
  notificarOk,
  fechaCorta,
  fechaHora,
  sha256Bytes,
  describirFiltro,
  abrirPdf,
} from "@/lib/servicios";
import { guardarArchivo } from "@/lib/archivos";
import { CampoPersona } from "@/components/shared/campo-persona";
import { CampoFiltro } from "@/components/shared/campo-filtro";
import { EstadoPeticionBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FileUp,
  FolderOpen,
  Plus,
  Send,
  Wrench,
} from "lucide-react";
import type {
  AprobacionPDF,
  Destinatario,
  FiltroCIE10,
  Peticion,
} from "@/lib/types";

interface BorradorPeticion {
  id?: string;
  destinatario: Destinatario;
  filtro: FiltroCIE10;
  pdf: File | null;
  aprobacion: AprobacionPDF | null;
  motivo?: string;
}

const crearBorrador = (): BorradorPeticion => ({
  destinatario: { tipo: "msp", id: "" },
  filtro: { ...FILTRO_ESTUDIO },
  pdf: null,
  aprobacion: null,
});

export function ComiteView() {
  const { usuario, tick, refrescar } = useApp();
  const [borrador, setBorrador] = useState<BorradorPeticion | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [detallePeticion, setDetallePeticion] = useState<Peticion | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  void tick;
  const lista = getPeticiones().lista() as Peticion[];

  const total = lista.length;
  const enCurso = lista.filter(
    (p) =>
      p.estado === "enviada" ||
      p.estado === "en_proceso" ||
      p.estado === "publicada"
  ).length;
  const devueltas = lista.filter((p) => p.estado === "devuelta").length;
  const completadas = lista.filter(
    (p) => p.estado === "firmada" || p.estado === "descargada"
  ).length;

  const handleEnviar = async () => {
    if (!borrador) return;
    setErrores([]);
    const aprobacion: AprobacionPDF | null = borrador.pdf
      ? {
          nombre: borrador.pdf.name,
          tamano: borrador.pdf.size,
          tipo: borrador.pdf.type,
        }
      : borrador.aprobacion;

    const problemas = validarPeticion({
      destinatario: borrador.destinatario,
      filtro: borrador.filtro,
      aprobacion,
    }) as string[];

    if (problemas.length > 0) {
      setErrores(problemas);
      return;
    }

    setEnviando(true);
    try {
      const aprobacionFinal: AprobacionPDF | null =
        borrador.pdf && aprobacion
          ? {
              ...aprobacion,
              sha256: await sha256Bytes(await borrador.pdf.arrayBuffer()),
            }
          : aprobacion;
      const user = usuario?.usuario ?? "ce";
      const pets = getPeticiones();
      const p: Peticion = borrador.id
        ? pets.reenviar(
            borrador.id,
            {
              destinatario: borrador.destinatario,
              filtro: borrador.filtro,
              aprobacion: aprobacionFinal,
            },
            user
          )
        : pets.crear(
            {
              destinatario: borrador.destinatario,
              filtro: borrador.filtro,
              aprobacion: aprobacionFinal,
            },
            user
          );

      if (borrador.pdf) {
        await guardarArchivo("aprobacion:" + p.id, borrador.pdf);
      }

      registrarLog(
        "peticion",
        borrador.id ? "Corregida y reenviada a TI" : "Creada y enviada a TI",
        `Para ${etiquetaDestinatario(p.destinatario)} · ${describirFiltro(p.filtro)}`,
        { referencia: p.id }
      );
      notificarOk(`Petición ${p.id} enviada a TI`);
      setBorrador(null);
      setErrores([]);
      refrescar();
    } catch (e) {
      mostrarError(
        e instanceof Error ? e.message : String(e),
        "Enviar petición"
      );
    } finally {
      setEnviando(false);
    }
  };

  if (borrador) {
    const pickFile = (file?: File | null) => {
      if (!file) return;
      setBorrador((prev) => (prev ? { ...prev, pdf: file } : prev));
    };

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setBorrador(null);
                setErrores([]);
              }}
              className="-ml-2 mb-1 gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              Volver al listado
            </Button>
            <h2 className="font-heading text-xl font-bold text-slate-900">
              {borrador.id
                ? `Corregir petición ${borrador.id}`
                : "Nueva petición de datos clínicos"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Adjunte la solicitud aprobada, indique la persona autorizada y
              defina el filtro CIE-10 y periodo. TI la revisará y anonimizará.
            </p>
          </div>
        </div>

        {borrador.motivo && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Petición devuelta por TI</p>
              <p className="mt-0.5 text-red-800">{borrador.motivo}</p>
            </div>
          </div>
        )}

        {/* Paso 1: PDF */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#E8F1F8] text-xs font-bold text-[#004B87]">
                1
              </span>
              Solicitud aprobada (PDF)
            </CardTitle>
            <CardDescription>
              Adjunte el documento de aprobación emitido por el comité de ética.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
                arrastrando
                  ? "border-[#004B87] bg-[#E8F1F8]/60"
                  : "border-slate-300 bg-slate-50/70 hover:border-[#004B87]/60 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileRef}
                id="pet-pdf"
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <div className="mb-2.5 flex size-11 items-center justify-center rounded-full bg-white text-[#004B87] shadow-xs ring-1 ring-slate-200">
                <FileUp className="size-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Haga clic para elegir el PDF o arrástrelo aquí
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Formato PDF (.pdf) · Almacenamiento local seguro en el navegador
              </p>
            </div>

            {borrador.pdf ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-[#E6F4EF]/70 px-3.5 py-2.5 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 shrink-0 text-[#007A53]" />
                  <span className="truncate font-medium text-slate-900">
                    {borrador.pdf.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-600">
                    ({Math.ceil(borrador.pdf.size / 1024)} KB)
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#007A53]">
                  Seleccionado
                </span>
              </div>
            ) : borrador.aprobacion ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="size-4 shrink-0 text-[#004B87]" />
                  <span className="truncate font-medium text-slate-800">
                    Actual: {borrador.aprobacion.nombre}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Elija otro solo para reemplazarlo
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Paso 2: Destinatario */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#E8F1F8] text-xs font-bold text-[#004B87]">
                2
              </span>
              Persona autorizada a recibir el entregable
            </CardTitle>
            <CardDescription>
              Doctor (número de licencia del MSP) o personal institucional del
              IESS. Solo esta persona podrá firmar y descargar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampoPersona
              prefijo="pet"
              valor={borrador.destinatario}
              onChange={(next) =>
                setBorrador((prev) =>
                  prev ? { ...prev, destinatario: next } : prev
                )
              }
            />
          </CardContent>
        </Card>

        {/* Paso 3: Parámetros CIE-10 y Periodo */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#E8F1F8] text-xs font-bold text-[#004B87]">
                3
              </span>
              Parámetros mínimos del dataset
            </CardTitle>
            <CardDescription>
              Defina el diagnóstico CIE-10 y el rango de años que TI aplicará
              exactamente al extraer la cohorte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampoFiltro
              filtro={borrador.filtro}
              onChange={(next) =>
                setBorrador((prev) => (prev ? { ...prev, filtro: next } : prev))
              }
            />
          </CardContent>
        </Card>

        {errores.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="flex items-center gap-2 font-semibold text-red-900">
              <AlertCircle className="size-4 text-red-600" />
              Revise los siguientes campos antes de enviar:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setBorrador(null);
              setErrores([]);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            id="pet-enviar"
            disabled={enviando}
            onClick={handleEnviar}
            className="gap-2 bg-[#004B87] px-5 text-white hover:bg-[#003366]"
          >
            <Send className="size-4" />
            {borrador.id ? "Reenviar a TI" : "Enviar a TI"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado y CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">
            Peticiones del comité de ética
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Cree peticiones con la solicitud aprobada y haga seguimiento hasta la
            descarga final.
          </p>
        </div>

        <Button
          type="button"
          id="nueva-peticion"
          onClick={() => {
            setErrores([]);
            setBorrador(crearBorrador());
          }}
          className="h-10 gap-2 bg-[#004B87] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#003366]"
        >
          <Plus className="size-4" />
          Nueva petición
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total peticiones",
            value: total,
            desc: "Registradas por el comité",
            icon: FolderOpen,
            tone: "text-[#004B87] bg-[#E8F1F8]",
          },
          {
            label: "En trámite / publicadas",
            value: enCurso,
            desc: "En revisión o listas para firma",
            icon: Clock,
            tone: "text-sky-700 bg-sky-50",
          },
          {
            label: "Devueltas por TI",
            value: devueltas,
            desc: "Requieren corrección del comité",
            icon: AlertTriangle,
            tone:
              devueltas > 0
                ? "text-red-700 bg-red-50"
                : "text-slate-500 bg-slate-100",
          },
          {
            label: "Firmadas / descargadas",
            value: completadas,
            desc: "Acuerdo firmado o entregadas",
            icon: CheckCircle2,
            tone: "text-[#007A53] bg-[#E6F4EF]",
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

      {devueltas > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
          <span>
            <strong>
              {devueltas} petición(es) devuelta(s) por TI:
            </strong>{" "}
            abra el detalle para revisar el motivo, corregir los datos y
            reenviar.
          </span>
        </div>
      )}

      {/* Listado */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base">Historial de peticiones</CardTitle>
          <CardDescription>
            Seleccione una petición para ver su línea de tiempo, abrir el PDF o
            corregirla si fue devuelta.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FolderOpen className="size-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Todavía no hay peticiones registradas
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Pulse «Nueva petición» para adjuntar la primera solicitud
                aprobada y enviarla al equipo de TI.
              </p>
              <Button
                type="button"
                onClick={() => setBorrador(crearBorrador())}
                className="mt-4 gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
              >
                <Plus className="size-4" />
                Crear primera petición
              </Button>
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
                      Creada
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Para
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Datos pedidos
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Estado
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Última novedad
                    </TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((p) => {
                    const ultimo = p.historial[p.historial.length - 1];
                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-bold text-[#004B87]">
                          {p.id}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 tabular-nums">
                          {fechaCorta(p.creadaEn)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {etiquetaDestinatario(p.destinatario)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-slate-600">
                          {describirFiltro(p.filtro)}
                        </TableCell>
                        <TableCell>
                          <EstadoPeticionBadge estado={p.estado} />
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-slate-600">
                          {p.estado === "devuelta" ? (
                            <span className="font-medium text-red-700">
                              Motivo: {ultimo?.motivo}
                            </span>
                          ) : (
                            fechaCorta(ultimo?.fecha)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDetallePeticion(p)}
                              className="h-8 gap-1 text-xs"
                            >
                              <Eye className="size-3.5" />
                              Detalle
                            </Button>
                            {p.estado === "devuelta" && (
                              <Button
                                type="button"
                                size="sm"
                                id={`corregir-${p.id}`}
                                onClick={() =>
                                  setBorrador({
                                    id: p.id,
                                    destinatario: { ...p.destinatario },
                                    filtro: { ...p.filtro },
                                    pdf: null,
                                    aprobacion: p.aprobacion,
                                    motivo: ultimo?.motivo,
                                  })
                                }
                                className="h-8 gap-1 bg-[#004B87] text-xs text-white hover:bg-[#003366]"
                              >
                                <Wrench className="size-3.5" />
                                Corregir
                              </Button>
                            )}
                          </div>
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

      {/* Modal Detalle de Petición */}
      <Dialog
        open={!!detallePeticion}
        onOpenChange={(open) => {
          if (!open) setDetallePeticion(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {detallePeticion && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2.5">
                  <DialogTitle className="font-mono text-lg font-bold text-[#004B87]">
                    {detallePeticion.id}
                  </DialogTitle>
                  <EstadoPeticionBadge estado={detallePeticion.estado} />
                </div>
                <DialogDescription>
                  Para {etiquetaDestinatario(detallePeticion.destinatario)} ·{" "}
                  {describirFiltro(detallePeticion.filtro)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2.5 text-sm">
                    <FileText className="size-4 text-[#004B87]" />
                    <span className="font-medium text-slate-800">
                      {detallePeticion.aprobacion?.nombre ?? "Solicitud PDF"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => abrirPdf(detallePeticion.id)}
                    className="gap-1.5 bg-white text-xs"
                  >
                    <Eye className="size-3.5" />
                    Ver PDF aprobado
                  </Button>
                </div>

                <div>
                  <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Línea de tiempo del trámite
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Estado</TableHead>
                          <TableHead className="text-xs">Por</TableHead>
                          <TableHead className="text-xs">Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detallePeticion.historial.map((h, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs tabular-nums text-slate-600">
                              {fechaHora(h.fecha)}
                            </TableCell>
                            <TableCell>
                              <EstadoPeticionBadge estado={h.estado} />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">
                              {h.por}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {h.motivo ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {detallePeticion.estado === "devuelta" && (
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const p = detallePeticion;
                        setDetallePeticion(null);
                        setBorrador({
                          id: p.id,
                          destinatario: { ...p.destinatario },
                          filtro: { ...p.filtro },
                          pdf: null,
                          aprobacion: p.aprobacion,
                          motivo: p.historial[p.historial.length - 1]?.motivo,
                        });
                      }}
                      className="gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
                    >
                      <Wrench className="size-4" />
                      Corregir y reenviar a TI
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
