"use client";

import { useState } from "react";
import { REFERENCIA, PROPIA } from "@/motor/config.js";
import {
  ejecutar,
  plan,
  validarConfig,
  ANCHO_EDAD,
  gruposDeEdad,
} from "@/motor/motor.js";
import { entradaDeEjecucion } from "@/motor/registro.js";
import { useApp } from "@/context/app-context";
import {
  getRegistro,
  notificarAviso,
  notificarMal,
  notificarOk,
  registrarLog,
} from "@/lib/servicios";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import type { ConfigProteccion } from "@/lib/types";

const MENSAJE_DESACTUALIZADO =
  "Cambió la configuración. Vuelva a proteger los datos para ver resultados y publicar.";

export function PasoProteccion() {
  const {
    proceso,
    setProceso,
    trabajar,
    setPasoActivo,
    campoResaltado,
    parametrosAbiertos,
    setParametrosAbiertos,
  } = useApp();
  const [busquedaVars, setBusquedaVars] = useState("");

  if (!proceso.cohorte) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
          <Lock className="size-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Primero cargue la base y extraiga las personas de la petición
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPasoActivo("datos")}
          className="mt-4 gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Ir al paso 1 (Datos e IA)
        </Button>
      </div>
    );
  }

  const c = proceso.config;
  const fija = c.tipo === "referencia";
  const errores = validarConfig(c) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variables: any[] = plan(c);
  const qVars = busquedaVars.trim().toLowerCase();
  const varsFiltradas = variables.filter(
    (v) =>
      !qVars ||
      [v.nombre, v.clasificacion, v.categoria, v.tecnica, v.parametro].some(
        (x) =>
          String(x ?? "")
            .toLowerCase()
            .includes(qVars)
      )
  );

  const elegirModo = (tipo: "referencia" | "propia") => {
    if (c.tipo === tipo) return;
    setProceso((prev) => ({
      ...prev,
      config: tipo === "referencia" ? { ...REFERENCIA } : { ...prev.propia },
      r: prev.historial[tipo] ?? null,
      desactualizado: false,
      deshacer: null,
    }));
    notificarOk(
      `Configuración ${tipo === "referencia" ? "Referencia" : "Propia"} seleccionada`
    );
  };

  const cambiar = <K extends keyof ConfigProteccion>(
    clave: K,
    valor: ConfigProteccion[K]
  ) => {
    setProceso((prev) => {
      const nextConfig: ConfigProteccion = { ...prev.config, [clave]: valor };
      const nextHistorial = { ...prev.historial };
      delete nextHistorial.propia;
      const estabaCalculado = !!(prev.r || prev.desactualizado);

      if (estabaCalculado) notificarAviso(MENSAJE_DESACTUALIZADO);
      else notificarOk("Configuración actualizada");

      return {
        ...prev,
        deshacer: {
          config: { ...prev.config },
          propia: { ...prev.propia },
          r: prev.r,
          historial: { ...prev.historial },
          desactualizado: prev.desactualizado,
        },
        config: nextConfig,
        propia: nextConfig,
        r: null,
        historial: nextHistorial,
        desactualizado: estabaCalculado,
      };
    });
  };

  const restablecerPropia = () => {
    setProceso((prev) => {
      const nextHistorial = { ...prev.historial };
      delete nextHistorial.propia;
      return {
        ...prev,
        deshacer: {
          config: { ...prev.config },
          propia: { ...prev.propia },
          r: prev.r,
          historial: { ...prev.historial },
          desactualizado: prev.desactualizado,
        },
        config: { ...PROPIA },
        propia: { ...PROPIA },
        r: null,
        historial: nextHistorial,
        desactualizado: true,
      };
    });
    notificarAviso(MENSAJE_DESACTUALIZADO);
  };

  const deshacerCambio = () => {
    if (!proceso.deshacer) return;
    setProceso((prev) => ({
      ...prev,
      ...prev.deshacer,
      deshacer: null,
    }));
    notificarOk("Se deshizo el último cambio");
  };

  const handleAnonimizar = () => {
    if (!proceso.cohorte || !proceso.datos || !proceso.peticion) return;
    const solicitadoEn = new Date().toISOString();
    const cohorte = proceso.cohorte;
    const configActual = proceso.config;
    const datosActual = proceso.datos;
    const archivoActual = proceso.archivo;
    const peticionActual = proceso.peticion;

    trabajar(
      "Protegiendo los datos y midiendo el resultado…",
      () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = ejecutar(cohorte, configActual, datosActual.nombreOriginal);
        r.estandarizacion = datosActual.estandarizacion;
        r.destinatario = null;
        r.peticionId = peticionActual.id;

        getRegistro().agregar(
          entradaDeEjecucion(r, { archivo: archivoActual, solicitadoEn })
        );
        registrarLog(
          "peticion",
          "Protección ejecutada",
          `${r.id} · configuración ${configActual.tipo} · ${
            r.apto ? "APTA" : "NO APTA"
          }`,
          { referencia: peticionActual.id }
        );

        setProceso((prev) => ({
          ...prev,
          r,
          historial: { ...prev.historial, [configActual.tipo]: r },
          desactualizado: false,
          deshacer: null,
        }));

        if (r.apto) {
          notificarOk(
            "La ejecución es APTA",
            "Los resultados y trazabilidad están listos."
          );
        } else {
          const fallas = r.verificaciones
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((v: any) => !v.ok)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((v: any) => v.id)
            .join(", ");
          notificarMal("La ejecución NO es apta", `Fallaron: ${fallas}.`);
        }
      },
      "resultados"
    );
  };

  const fijarAnchoEdad = (v: number) => {
    const n = Math.round(v);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(ANCHO_EDAD.max, Math.max(ANCHO_EDAD.min, n));
    if (clamped !== c.anchoEdad) cambiar("anchoEdad", clamped);
  };

  return (
    <div className="space-y-6">
      {/* Selector de modo */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Elija una forma de proteger los datos
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              tipo: "referencia" as const,
              titulo: "Referencia del estudio",
              badge: "Reglas fijas",
              desc: "Aplica exactamente las reglas oficiales del diccionario (k ≥ 5, grupos de 20 años, región y año-mes). Sirve para la verificación del jurado.",
            },
            {
              tipo: "propia" as const,
              titulo: "Propia (recomendada para entregar)",
              badge: "Editable",
              desc: "Añade protección l-diversidad contra deducción de diagnóstico y agrupa estancias hospitalarias extremas (30+ días). Permite ajustar parámetros.",
            },
          ].map((opt) => {
            const elegida = c.tipo === opt.tipo;
            return (
              <button
                key={opt.tipo}
                type="button"
                id={`modo-${opt.tipo}`}
                onClick={() => elegirModo(opt.tipo)}
                className={`flex items-start gap-3.5 rounded-2xl border p-5 text-left transition-all ${
                  elegida
                    ? "border-[#004B87] bg-[#E8F1F8]/60 ring-2 ring-[#004B87]/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    elegida
                      ? "border-[#004B87] bg-[#004B87] text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {elegida && <CheckCircle2 className="size-3.5" />}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-bold text-slate-900">
                      {opt.titulo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        elegida
                          ? "bg-[#004B87] text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parámetros */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <button
          type="button"
          onClick={() => setParametrosAbiertos(!parametrosAbiertos)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-4 text-[#004B87]" />
            <span className="text-sm font-bold text-slate-900">
              {fija
                ? "Parámetros de anonimización (fijos en la referencia)"
                : "Ajustar parámetros de protección"}
            </span>
          </div>
          <span className="text-xs font-semibold text-[#004B87]">
            {parametrosAbiertos ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {parametrosAbiertos && (
          <div className="space-y-5 border-t border-slate-100 p-5">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* k */}
              <div
                className={`space-y-1.5 ${
                  campoResaltado === "p-k" ? "field-highlight p-2" : ""
                }`}
              >
                <Label htmlFor="p-k" className="text-xs font-semibold text-slate-700">
                  Grupo mínimo (k)
                </Label>
                <NativeSelect
                  id="p-k"
                  disabled={fija}
                  value={String(c.k)}
                  onChange={(e) => cambiar("k", Number(e.target.value))}
                >
                  {[5, 6, 8, 10, 15].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} personas
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[11px] text-slate-500">
                  Cada persona se confunde con otras. Más alto protege más.
                </p>
              </div>

              {/* Ancho de edad stepper */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="p-anchoEdad"
                  className="text-xs font-semibold text-slate-700"
                >
                  Ancho de los rangos de edad
                </Label>
                <div className="flex h-10 w-fit items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                  <button
                    type="button"
                    id="p-anchoEdad-menos"
                    disabled={fija || c.anchoEdad <= ANCHO_EDAD.min}
                    onClick={() => fijarAnchoEdad(c.anchoEdad - 1)}
                    aria-label="Disminuir ancho de los rangos de edad"
                    className="flex h-full w-10 items-center justify-center border-r border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    id="p-anchoEdad"
                    type="number"
                    min={ANCHO_EDAD.min}
                    max={ANCHO_EDAD.max}
                    disabled={fija}
                    value={c.anchoEdad}
                    onChange={(e) => fijarAnchoEdad(Number(e.target.value))}
                    className="h-full w-14 border-0 bg-transparent text-center font-mono text-sm font-semibold text-slate-900 focus:outline-none disabled:text-slate-500"
                  />
                  <span className="pr-2.5 text-xs text-slate-500">años</span>
                  <button
                    type="button"
                    id="p-anchoEdad-mas"
                    disabled={fija || c.anchoEdad >= ANCHO_EDAD.max}
                    onClick={() => fijarAnchoEdad(c.anchoEdad + 1)}
                    aria-label="Aumentar ancho de los rangos de edad"
                    className="flex h-full w-10 items-center justify-center border-l border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Grupos:{" "}
                  <span className="font-mono text-slate-700">
                    {(gruposDeEdad(c.anchoEdad) as string[]).join(" · ")}
                  </span>
                </p>
              </div>

              {/* Ubicación */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="p-ubicacion"
                  className="text-xs font-semibold text-slate-700"
                >
                  Ubicación geográfica
                </Label>
                <NativeSelect
                  id="p-ubicacion"
                  disabled={fija}
                  value={c.ubicacion}
                  onChange={(e) =>
                    cambiar(
                      "ubicacion",
                      e.target.value as "region" | "provincia"
                    )
                  }
                >
                  <option value="region">Región</option>
                  <option value="provincia">Provincia</option>
                </NativeSelect>
                <p className="text-[11px] text-slate-500">
                  Región agrupa a más personas (Costa, Sierra, Amazonía, Insular).
                </p>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="p-fecha"
                  className="text-xs font-semibold text-slate-700"
                >
                  Granularidad de fecha
                </Label>
                <NativeSelect
                  id="p-fecha"
                  disabled={fija}
                  value={c.fecha}
                  onChange={(e) =>
                    cambiar("fecha", e.target.value as "mes" | "anio")
                  }
                >
                  <option value="mes">Año y mes</option>
                  <option value="anio">Solo año</option>
                </NativeSelect>
                <p className="text-[11px] text-slate-500">
                  El estudio solicita año y mes (AAAA-MM).
                </p>
              </div>

              {/* l-diversidad */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="p-l"
                  className="text-xs font-semibold text-slate-700"
                >
                  Diagnósticos distintos por grupo (l)
                </Label>
                <NativeSelect
                  id="p-l"
                  disabled={fija}
                  value={String(c.l)}
                  onChange={(e) => cambiar("l", Number(e.target.value))}
                >
                  <option value="1">No exigir</option>
                  <option value="2">Al menos 2</option>
                  <option value="3">Al menos 3</option>
                </NativeSelect>
                <p className="text-[11px] text-slate-500">
                  Evita deducir la enfermedad de un grupo homogéneo.
                </p>
              </div>

              {/* Estancias largas */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="p-topeEstancia"
                  className="text-xs font-semibold text-slate-700"
                >
                  Estancias largas
                </Label>
                <NativeSelect
                  id="p-topeEstancia"
                  disabled={fija}
                  value={c.topeEstancia === null ? "null" : String(c.topeEstancia)}
                  onChange={(e) =>
                    cambiar(
                      "topeEstancia",
                      e.target.value === "null" ? null : Number(e.target.value)
                    )
                  }
                >
                  <option value="null">Mostrar exactas</option>
                  <option value="15">15 días o más juntas</option>
                  <option value="30">30 días o más juntas</option>
                  <option value="60">60 días o más juntas</option>
                </NativeSelect>
                <p className="text-[11px] text-slate-500">
                  Evita que un valor atípico señale a una persona.
                </p>
              </div>
            </div>

            {!fija && (
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={restablecerPropia}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" />
                  Restablecer valores recomendados
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plan de 28 columnas */}
      <Accordion className="rounded-xl border border-slate-200 bg-white px-4">
        <AccordionItem value="variables" className="border-0">
          <AccordionTrigger className="py-3.5 text-sm font-semibold text-slate-800 hover:no-underline">
            Ver qué pasa con cada una de las {variables.length} columnas
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={busquedaVars}
                onChange={(e) => setBusquedaVars(e.target.value)}
                placeholder="Buscar columna, clasificación o técnica..."
                className="h-9 bg-white pl-9 text-xs"
              />
            </div>

            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Columna</TableHead>
                    <TableHead className="text-xs">Qué es</TableHead>
                    <TableHead className="text-xs">Categoría especial</TableHead>
                    <TableHead className="text-xs">¿La pide el estudio?</TableHead>
                    <TableHead className="text-xs">Qué se hace</TableHead>
                    <TableHead className="text-xs">Cómo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {varsFiltradas.map((v) => (
                    <TableRow key={v.nombre}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {v.nombre}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {v.clasificacion}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {v.categoria || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{v.solicitada}</TableCell>
                      <TableCell className="text-xs font-medium text-[#004B87]">
                        {v.tecnica}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {v.parametro || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {errores.map((err, i) => (
        <div
          key={i}
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          {err}
        </div>
      ))}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div>
          {proceso.deshacer && (
            <Button
              type="button"
              variant="outline"
              onClick={deshacerCambio}
              className="gap-1.5 text-xs"
            >
              <Undo2 className="size-3.5" />
              Deshacer el último cambio
            </Button>
          )}
        </div>

        <Button
          type="button"
          id="anonimizar"
          disabled={errores.length > 0}
          onClick={handleAnonimizar}
          className="h-10 gap-2 bg-[#004B87] px-6 text-sm font-semibold text-white shadow-xs hover:bg-[#003366]"
        >
          <Shield className="size-4" />
          {proceso.r
            ? "Volver a proteger y medir"
            : "Proteger los datos y medir"}
        </Button>
      </div>
    </div>
  );
}
