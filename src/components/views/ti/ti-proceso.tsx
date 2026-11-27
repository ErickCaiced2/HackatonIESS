"use client";

import { PASOS_PROCESO, useApp } from "@/context/app-context";
import { StatusBadge, type Tono } from "@/components/shared/status-badge";
import { PasoDatos } from "@/components/views/ti/paso-datos";
import { PasoProteccion } from "@/components/views/ti/paso-proteccion";
import { PasoResultados } from "@/components/views/ti/paso-resultados";
import { PasoTrazabilidad } from "@/components/views/ti/paso-trazabilidad";
import { PasoPublicar } from "@/components/views/ti/paso-publicar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Check, Keyboard } from "lucide-react";
import type { PasoProcesoId } from "@/lib/types";

export function TiProceso() {
  const { proceso, pasoActivo, setPasoActivo, irA } = useApp();

  const estadoPaso = (id: PasoProcesoId): { tono: Tono; texto: string } => {
    switch (id) {
      case "datos":
        if (proceso.cohorte) return { tono: "ok", texto: "Listo" };
        if (proceso.datos) return { tono: "aviso", texto: "Falta extraer" };
        if (proceso.revision) return { tono: "aviso", texto: "Revisar IA" };
        return { tono: "neutro", texto: "Por hacer" };
      case "proteccion":
        if (proceso.r) return { tono: "ok", texto: "Listo" };
        if (!proceso.cohorte) return { tono: "neutro", texto: "Bloqueado" };
        if (proceso.desactualizado)
          return { tono: "aviso", texto: "Volver a medir" };
        return { tono: "aviso", texto: "Por hacer" };
      case "resultados":
        if (!proceso.r) return { tono: "neutro", texto: "Pendiente" };
        return proceso.r.apto
          ? { tono: "ok", texto: "Apto" }
          : { tono: "mal", texto: "No apto" };
      case "trazabilidad":
        return proceso.r
          ? { tono: "ok", texto: "Disponible" }
          : { tono: "neutro", texto: "Pendiente" };
      case "publicar":
        if (!proceso.r) return { tono: "neutro", texto: "Bloqueado" };
        return proceso.r.cohorte?.esEstudio && proceso.r.apto
          ? { tono: "ok", texto: "Lista" }
          : { tono: "aviso", texto: "Faltan datos" };
    }
  };

  const siguienteAccion = (): {
    texto: string;
    accion: () => void;
  } => {
    if (!proceso.peticion)
      return {
        texto: "Elija una petición en la bandeja para comenzar.",
        accion: () => irA("ti-peticiones"),
      };
    if (proceso.revision)
      return {
        texto: "Revise la propuesta de columnas de la IA y confirme.",
        accion: () => setPasoActivo("datos"),
      };
    if (!proceso.datos)
      return {
        texto: "Cargue la base de datos (CSV o TSV) de la petición.",
        accion: () => setPasoActivo("datos"),
      };
    if (!proceso.cohorte)
      return {
        texto: "Extraiga las personas de la cohorte solicitada.",
        accion: () => setPasoActivo("datos"),
      };
    if (!proceso.r)
      return {
        texto: "Configure la protección y mida el resultado.",
        accion: () => setPasoActivo("proteccion"),
      };
    if (!proceso.r.apto)
      return {
        texto: "Ajuste la protección: el resultado actual no es apto.",
        accion: () => setPasoActivo("proteccion"),
      };
    return {
      texto: "Revise resultados y trazabilidad, y publique al destinatario.",
      accion: () => setPasoActivo("publicar"),
    };
  };

  const completados = PASOS_PROCESO.filter(
    (p) => estadoPaso(p.id).tono === "ok"
  ).length;
  const progresoPct = (completados / PASOS_PROCESO.length) * 100;
  const pasoMeta =
    PASOS_PROCESO.find((p) => p.id === pasoActivo) ?? PASOS_PROCESO[0];
  const next = siguienteAccion();

  return (
    <div className="space-y-6">
      {/* Barra de progreso y Stepper horizontal */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Avance del procesamiento
              </span>
              <span className="rounded-full bg-[#E8F1F8] px-2.5 py-0.5 font-mono text-xs font-bold text-[#004B87]">
                {completados} / {PASOS_PROCESO.length} pasos
              </span>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex">
              <Keyboard className="size-3.5" />
              Atajos: Alt + 0 tablero · Alt + 1 a 5 pasos
            </span>
          </div>

          <Progress value={progresoPct} className="h-2 bg-slate-100" />

          {/* Stepper de 5 pasos */}
          <nav
            aria-label="Pasos del procesamiento"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          >
            {PASOS_PROCESO.map((paso) => {
              const est = estadoPaso(paso.id);
              const activo = pasoActivo === paso.id;
              const ok = est.tono === "ok";
              return (
                <button
                  key={paso.id}
                  type="button"
                  onClick={() => setPasoActivo(paso.id)}
                  aria-current={activo ? "step" : undefined}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                    activo
                      ? "border-[#004B87] bg-[#E8F1F8]/70 ring-2 ring-[#004B87]/15"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        ok
                          ? "bg-[#007A53] text-white"
                          : activo
                          ? "bg-[#004B87] text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ok ? <Check className="size-3.5" /> : paso.numero}
                    </span>
                    <StatusBadge tono={est.tono} className="text-[10px] px-2">
                      {est.texto}
                    </StatusBadge>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      activo ? "text-[#003366]" : "text-slate-800"
                    }`}
                  >
                    {paso.corto}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Barra guía de siguiente acción */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#004B87]/20 bg-[#E8F1F8]/50 px-4 py-2.5 text-xs">
            <p className="text-slate-700">
              <strong className="font-semibold text-[#003366]">
                Siguiente paso recomendado:{" "}
              </strong>
              {next.texto}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={next.accion}
              className="h-7 gap-1 border-[#004B87]/30 bg-white text-xs font-semibold text-[#004B87] hover:bg-[#E8F1F8]"
            >
              Ir
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido del paso activo */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="font-heading text-lg font-bold text-slate-900">
            {pasoMeta.titulo}
          </CardTitle>
          <CardDescription>{pasoMeta.descripcion}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {pasoActivo === "datos" && <PasoDatos />}
          {pasoActivo === "proteccion" && <PasoProteccion />}
          {pasoActivo === "resultados" && <PasoResultados />}
          {pasoActivo === "trazabilidad" && <PasoTrazabilidad />}
          {pasoActivo === "publicar" && <PasoPublicar />}
        </CardContent>
      </Card>
    </div>
  );
}
