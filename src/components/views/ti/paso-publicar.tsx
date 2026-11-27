"use client";

import { useState } from "react";
import { aCSV } from "@/motor/csv.js";
import {
  sha256,
  configuracionJSON,
  trazabilidadJSON,
  ptaHTML,
  BORRADOR_RIESGO,
  BORRADOR_TITULAR,
} from "@/motor/entregables.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import {
  crearEstadoProcesoInicial,
  useApp,
} from "@/context/app-context";
import {
  describirFiltro,
  getPeticiones,
  getRegistro,
  mostrarError,
  notificarOk,
  registrarLog,
} from "@/lib/servicios";
import { guardarArchivo } from "@/lib/archivos";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { PasoProcesoId } from "@/lib/types";

export function PasoPublicar() {
  const {
    usuario,
    proceso,
    setProceso,
    irA,
    irACampo,
    setPasoActivo,
    refrescar,
  } = useApp();
  const [publicando, setPublicando] = useState(false);

  if (!proceso.r || !proceso.peticion) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
          <Lock className="size-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Para publicar primero necesita un resultado vigente
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
  const p = proceso.peticion;

  const requisitos: {
    texto: string;
    ok: boolean;
    campoId: string;
    paso: PasoProcesoId;
    abrirParametros?: boolean;
  }[] = [
    {
      texto: "La cohorte usa exactamente el filtro aprobado de la petición",
      ok: Boolean(r.cohorte?.esEstudio),
      campoId: "archivo",
      paso: "datos",
    },
    {
      texto: "La ejecución resultó APTA en todas las verificaciones",
      ok: Boolean(r.apto),
      campoId: "p-k",
      paso: "proteccion",
      abrirParametros: true,
    },
  ];

  const listo = requisitos.every((x) => x.ok);

  const handlePublicar = async () => {
    if (!listo || !usuario) return;
    setPublicando(true);
    try {
      const csv = aCSV(r.columnas, r.salida);
      const config = configuracionJSON(r);
      const rConDest = { ...r, destinatario: { ...p.destinatario } };
      const traza = await trazabilidadJSON(
        rConDest,
        await sha256(csv),
        await sha256(config)
      );

      await guardarArchivo("entrega:" + p.id, {
        base: r.id,
        ejecucionId: r.id,
        csv,
        config,
        traza,
        pta: ptaHTML(rConDest, { riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR }),
      });

      getRegistro().peticion(r.id, p.destinatario, new Date().toISOString());
      getPeticiones().publicar(
        p.id,
        {
          id: r.id,
          fecha: r.fecha,
          configuracion: r.config.tipo,
          kDespues: r.despues.kMin,
          personas: r.despues.personas,
        },
        usuario.usuario
      );
      registrarLog(
        "peticion",
        "Publicada al destinatario",
        `${r.id} para ${etiquetaDestinatario(p.destinatario)}`,
        { referencia: p.id }
      );
      notificarOk(
        `Petición ${p.id} publicada`,
        `${etiquetaDestinatario(p.destinatario)} ya puede firmar el acuerdo y descargar.`
      );
      setProceso(crearEstadoProcesoInicial());
      setPasoActivo("datos");
      refrescar();
      irA("ti-peticiones");
    } catch (e) {
      mostrarError(
        e instanceof Error ? e.message : String(e),
        "Publicar petición"
      );
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta resumen de entrega */}
      <div className="rounded-2xl border border-[#004B87]/20 bg-[#E8F1F8]/40 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#004B87]">
          <ShieldCheck className="size-4" />
          Resumen del entregable protegido
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Petición</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-[#004B87]">
              {p.id}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">
              Destinatario exclusivo
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {etiquetaDestinatario(p.destinatario)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Datos pedidos</p>
            <p className="mt-0.5 text-xs font-medium text-slate-800">
              {describirFiltro(p.filtro)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Ejecución</p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-slate-800">
              {r.id} · {r.config.tipo}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist de requisitos previos */}
      <div className="space-y-3">
        <h3 className="font-heading text-sm font-bold text-slate-900">
          Requisitos previos antes de publicar
        </h3>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {requisitos.map((req, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                {req.ok ? (
                  <CheckCircle2 className="size-5 shrink-0 text-[#007A53]" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-red-600" />
                )}
                <span className="text-sm font-medium text-slate-800">
                  {req.texto}
                </span>
              </div>

              {req.ok ? (
                <StatusBadge tono="ok">Listo</StatusBadge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    irACampo(req.campoId, req.paso, req.abrirParametros)
                  }
                  className="h-8 gap-1 border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100"
                >
                  Falta · Ir al campo
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Acción publicar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-relaxed text-slate-600">
          Al publicar, <strong>solo el destinatario autorizado</strong> podrá
          ver la petición desde su cuenta, firmar el acuerdo de confidencialidad
          y descargar los archivos. Los datos de personas nunca salen de este
          navegador.
        </p>

        <Button
          type="button"
          id="publicar-boton"
          disabled={!listo || publicando}
          onClick={handlePublicar}
          className="h-11 shrink-0 gap-2 bg-[#007A53] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#006343]"
        >
          <Send className="size-4" />
          {publicando ? "Publicando..." : "Publicar al destinatario"}
        </Button>
      </div>
    </div>
  );
}
