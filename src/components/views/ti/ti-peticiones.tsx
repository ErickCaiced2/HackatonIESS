"use client";

import { useState } from "react";
import { ESTADOS } from "@/motor/peticiones.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import { useApp } from "@/context/app-context";
import {
  getPeticiones,
  registrarLog,
  mostrarError,
  notificarAviso,
  fechaCorta,
  fechaHora,
  describirFiltro,
  abrirPdf,
} from "@/lib/servicios";
import { EstadoPeticionBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Cpu,
  Eye,
  FileText,
  Inbox,
  Play,
  Undo2,
} from "lucide-react";
import type { Peticion } from "@/lib/types";

type FiltroEstado = "pendientes" | "todas" | string;

export function TiPeticiones() {
  const { usuario, procesarPeticion, tick, refrescar } = useApp();
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("pendientes");
  const [peticionRevisar, setPeticionRevisar] = useState<Peticion | null>(null);
  const [peticionVer, setPeticionVer] = useState<Peticion | null>(null);
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [errorDevolucion, setErrorDevolucion] = useState("");

  void tick;
  const todas = getPeticiones().lista() as Peticion[];

  const filtros: {
    id: FiltroEstado;
    label: string;
    fn: (p: Peticion) => boolean;
  }[] = [
    {
      id: "pendientes",
      label: "Por atender",
      fn: (p) => p.estado === "enviada" || p.estado === "en_proceso",
    },
    { id: "todas", label: "Todas", fn: () => true },
    ...Object.entries(ESTADOS as Record<string, string>).map(([k, v]) => ({
      id: k,
      label: v,
      fn: (p: Peticion) => p.estado === k,
    })),
  ];

  const filtroActual = filtros.find((f) => f.id === filtroEstado) ?? filtros[0];
  const lista = todas.filter(filtroActual.fn);

  const handleDevolver = () => {
    if (!peticionRevisar) return;
    if (!motivoDevolucion.trim()) {
      setErrorDevolucion("Escriba el motivo de la devolución para el comité.");
      return;
    }
    try {
      getPeticiones().devolver(
        peticionRevisar.id,
        motivoDevolucion,
        usuario?.usuario ?? "ti"
      );
      registrarLog("peticion", "Devuelta al comité", motivoDevolucion.trim(), {
        referencia: peticionRevisar.id,
      });
      notificarAviso(`Petición ${peticionRevisar.id} devuelta al comité`);
      setPeticionRevisar(null);
      setMotivoDevolucion("");
      setErrorDevolucion("");
      refrescar();
    } catch (e) {
      mostrarError(
        e instanceof Error ? e.message : String(e),
        "Devolver petición"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-900">
          Bandeja de peticiones del comité
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Revise cada petición junto con su PDF aprobado. Puede devolverla con
          un motivo o tomarla para cargar el CSV, anonimizar con IA y publicarla.
        </p>
      </div>

      {/* Pestañas de estado */}
      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => {
          const count = todas.filter(f.fn).length;
          const active = filtroEstado === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroEstado(f.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "bg-[#004B87] text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>{f.label}</span>
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
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="size-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No hay peticiones en este estado
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cambie de pestaña para ver el historial o espere nuevas
                solicitudes del comité de ética.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold text-slate-600">
                      Petición
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Recibida
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Destinatario
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Datos pedidos
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
                  {lista.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/70">
                      <TableCell className="font-mono text-xs font-bold text-[#004B87]">
                        {p.id}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-slate-600">
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
                      <TableCell className="text-right">
                        {p.estado === "enviada" ? (
                          <Button
                            type="button"
                            size="sm"
                            id={`revisar-${p.id}`}
                            onClick={() => {
                              setPeticionRevisar(p);
                              setMotivoDevolucion("");
                              setErrorDevolucion("");
                            }}
                            className="h-8 gap-1.5 bg-[#004B87] text-xs text-white hover:bg-[#003366]"
                          >
                            <Eye className="size-3.5" />
                            Revisar
                          </Button>
                        ) : p.estado === "en_proceso" ? (
                          <Button
                            type="button"
                            size="sm"
                            id={`continuar-${p.id}`}
                            onClick={() => procesarPeticion(p.id, true)}
                            className="h-8 gap-1.5 bg-[#007A53] text-xs text-white hover:bg-[#006343]"
                          >
                            <Play className="size-3.5" />
                            Continuar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            id={`ver-pet-${p.id}`}
                            onClick={() => setPeticionVer(p)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Eye className="size-3.5" />
                            Ver detalle
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Revisar petición (Tomar o Devolver) */}
      <Dialog
        open={!!peticionRevisar}
        onOpenChange={(open) => {
          if (!open) setPeticionRevisar(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {peticionRevisar && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="font-heading text-lg font-bold">
                    Revisar{" "}
                    <span className="font-mono text-[#004B87]">
                      {peticionRevisar.id}
                    </span>
                  </DialogTitle>
                  <EstadoPeticionBadge estado={peticionRevisar.estado} />
                </div>
                <DialogDescription>
                  Verifique la solicitud aprobada antes de iniciar el
                  procesamiento o devolverla al comité.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-slate-500">Creada</p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {fechaHora(peticionRevisar.creadaEn)} por{" "}
                      {peticionRevisar.creadaPor}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Destinatario</p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {etiquetaDestinatario(peticionRevisar.destinatario)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-semibold text-slate-500">Datos pedidos</p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {describirFiltro(peticionRevisar.filtro)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-[#004B87]" />
                      <span className="font-medium text-slate-800">
                        {peticionRevisar.aprobacion?.nombre}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      id="abrir-pdf"
                      onClick={() => abrirPdf(peticionRevisar.id)}
                      className="h-7 gap-1 bg-white text-xs"
                    >
                      <Eye className="size-3.5" />
                      Abrir PDF
                    </Button>
                  </div>
                </div>

                {/* Bloque de devolución */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <Label
                    htmlFor="motivo-devolucion"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Motivo de devolución (solo si requiere corrección del comité)
                  </Label>
                  <Textarea
                    id="motivo-devolucion"
                    value={motivoDevolucion}
                    onChange={(e) => {
                      setMotivoDevolucion(e.target.value);
                      setErrorDevolucion("");
                    }}
                    placeholder="Explique claramente al comité qué debe corregir..."
                    className="min-h-20 bg-white text-sm"
                  />
                  {errorDevolucion && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                      <AlertCircle className="size-3.5" />
                      {errorDevolucion}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    id="devolver"
                    onClick={handleDevolver}
                    className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    <Undo2 className="size-4" />
                    Devolver con motivo
                  </Button>

                  <Button
                    type="button"
                    id="procesar"
                    onClick={() => {
                      const id = peticionRevisar.id;
                      setPeticionRevisar(null);
                      procesarPeticion(id);
                    }}
                    className="gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
                  >
                    <Cpu className="size-4" />
                    Procesar petición
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Ver detalle histórico */}
      <Dialog
        open={!!peticionVer}
        onOpenChange={(open) => {
          if (!open) setPeticionVer(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {peticionVer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="font-mono text-lg font-bold text-[#004B87]">
                    {peticionVer.id}
                  </DialogTitle>
                  <EstadoPeticionBadge estado={peticionVer.estado} />
                </div>
                <DialogDescription>
                  Para {etiquetaDestinatario(peticionVer.destinatario)} ·{" "}
                  {describirFiltro(peticionVer.filtro)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <div className="space-y-1">
                    {peticionVer.ejecucion && (
                      <p>
                        <strong className="text-slate-700">
                          Ejecución publicada:
                        </strong>{" "}
                        <span className="font-mono text-[#004B87]">
                          {peticionVer.ejecucion.id}
                        </span>
                      </p>
                    )}
                    {peticionVer.firmadoEn && (
                      <p>
                        <strong className="text-slate-700">
                          Acuerdo firmado:
                        </strong>{" "}
                        {fechaHora(peticionVer.firmadoEn)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => abrirPdf(peticionVer.id)}
                    className="h-8 gap-1.5 bg-white text-xs"
                  >
                    <FileText className="size-3.5" />
                    Abrir PDF aprobado
                  </Button>
                </div>

                {peticionVer.descargas.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Descargas realizadas
                    </h4>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">Archivo</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs">Fecha</TableHead>
                            <TableHead className="text-xs">Por</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {peticionVer.descargas.map((d, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">
                                {d.archivo}
                              </TableCell>
                              <TableCell className="text-xs uppercase">
                                {d.tipo}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">
                                {fechaHora(d.fecha)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {d.por}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Historial
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
                        {peticionVer.historial.map((h, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs tabular-nums text-slate-600">
                              {fechaHora(h.fecha)}
                            </TableCell>
                            <TableCell>
                              <EstadoPeticionBadge estado={h.estado} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
