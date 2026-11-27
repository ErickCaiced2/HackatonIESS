"use client";

import { useRef, useState } from "react";
import { extraerCohorte, contadorPorFiltro, medir } from "@/motor/motor.js";
import { num, pct, ident } from "@/motor/entregables.js";
import { etiquetaDestinatario } from "@/motor/destinatario.js";
import {
  analizar,
  decisionesIniciales,
  estandarizar,
} from "@/ia/estandarizar.js";
import {
  crearEstadoProcesoInicial,
  useApp,
} from "@/context/app-context";
import {
  describirFiltro,
  notificarOk,
  registrarLog,
} from "@/lib/servicios";
import { RevisionIAPanel } from "@/components/views/ti/revision-ia";
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
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  Lock,
  UploadCloud,
  Users,
} from "lucide-react";

export function PasoDatos() {
  const {
    proceso,
    setProceso,
    trabajar,
    sePuedeDescartar,
    irA,
    setPasoActivo,
  } = useApp();
  const [arrastrando, setArrastrando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!proceso.peticion) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500">
          <Lock className="size-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          No hay ninguna petición seleccionada para procesar
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500">
          Seleccione primero una petición aprobada en la bandeja de «Peticiones».
        </p>
        <Button
          type="button"
          onClick={() => irA("ti-peticiones")}
          className="mt-4 gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
        >
          Ir a peticiones
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  const cargarArchivo = async (archivo?: File | null) => {
    if (!archivo || !proceso.peticion) return;
    if (!(await sePuedeDescartar("cargar otro archivo"))) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const peticionActual = proceso.peticion;
    trabajar("La IA está leyendo y reconociendo las columnas…", async () => {
      const bytes = await archivo.arrayBuffer();
      let texto: string;
      let codificacion = "UTF-8";
      try {
        texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        texto = new TextDecoder("windows-1252").decode(bytes);
        codificacion = "Windows-1252";
      }
      const analisis = analizar(texto.replace(/^\uFEFF/, ""));
      setProceso({
        ...crearEstadoProcesoInicial(),
        peticion: peticionActual,
        filtro: { ...peticionActual.filtro },
        archivo: archivo.name,
        revision: {
          analisis,
          decisiones: decisionesIniciales(analisis),
          codificacion,
        },
      });
      notificarOk(
        `IA analizó ${analisis.columnas.length} columnas`,
        "Revise las asignaciones propuestas y confirme para continuar."
      );
    });
  };

  const confirmarEstandarizacion = () => {
    if (!proceso.revision || !proceso.peticion) return;
    const rev = proceso.revision;
    const pet = proceso.peticion;
    const nombreArchivo = proceso.archivo;

    trabajar("Estandarizando los datos…", () => {
      const res = estandarizar(rev.analisis, rev.decisiones);
      if (!res.datos) throw new Error(res.problemas.join(" "));
      const contar = contadorPorFiltro(res.datos.filas);
      setProceso((prev) => ({
        ...prev,
        datos: res.datos,
        revision: null,
        contar,
      }));
      registrarLog(
        "peticion",
        "Base de datos cargada",
        `${nombreArchivo} · ${num(res.datos.filas.length)} atenciones`,
        { referencia: pet.id }
      );
      notificarOk(
        `Datos estandarizados (${num(res.datos.filas.length)} atenciones)`,
        "Siguiente paso: extraiga las personas de la cohorte."
      );
    });
  };

  const handleExtraerCohorte = () => {
    if (!proceso.datos) return;
    const filas = proceso.datos.filas;
    const filtro = proceso.filtro;

    trabajar("Extrayendo la cohorte y midiendo el riesgo inicial…", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cohorte: any = (extraerCohorte as any)(filas, filtro);
      if (!cohorte.atenciones) throw new Error("La cohorte está vacía.");
      cohorte.esEstudio = true;
      const antes = medir(cohorte.filas, "cedula");
      setProceso((prev) => ({
        ...prev,
        cohorte,
        antes,
      }));
      notificarOk(
        `Cohorte lista: ${num(cohorte.personas)} personas`,
        `${num(cohorte.atenciones)} atenciones seleccionadas. Pase al paso 2 (Protección).`
      );
    });
  };

  const d = proceso.datos;
  const c = proceso.cohorte;
  const personasConFiltro =
    d && proceso.contar ? proceso.contar(proceso.filtro) : null;

  return (
    <div className="space-y-6">
      {/* Banner petición activa */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#004B87]/20 bg-[#E8F1F8]/60 px-4 py-3 text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold text-[#003366]">
            Procesando petición{" "}
            <span className="font-mono">{proceso.peticion.id}</span>
          </p>
          <p className="text-xs text-slate-600">
            Destinatario: <strong>{etiquetaDestinatario(proceso.peticion.destinatario)}</strong> ·{" "}
            {describirFiltro(proceso.filtro)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#007A53] ring-1 ring-slate-200">
          <Lock className="size-3" />
          Solo en memoria local
        </span>
      </div>

      {/* Dropzone de carga de CSV/TSV */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          cargarArchivo(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
          arrastrando
            ? "border-[#004B87] bg-[#E8F1F8]/70"
            : "border-slate-300 bg-slate-50/70 hover:border-[#004B87]/60 hover:bg-white"
        }`}
      >
        <input
          ref={fileRef}
          id="archivo"
          type="file"
          accept=".csv,.tsv,.txt"
          className="sr-only"
          onChange={(e) => cargarArchivo(e.target.files?.[0])}
        />
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-[#004B87] shadow-xs ring-1 ring-slate-200">
          {d || proceso.revision ? (
            <FileSpreadsheet className="size-6 text-[#007A53]" />
          ) : (
            <UploadCloud className="size-6" />
          )}
        </div>
        <p className="text-sm font-bold text-slate-900">
          {d || proceso.revision
            ? `Cambiar archivo (actual: ${proceso.archivo})`
            : "Elija el archivo de atenciones (CSV, TSV o texto delimitado)"}
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500">
          Arrastre y suelte o haga clic para seleccionar. El archivo se procesa
          en este equipo; la aplicación nunca lo envía a ningún servidor.
        </p>
      </div>

      {/* Panel de Revisión IA */}
      {proceso.revision && (
        <RevisionIAPanel
          revision={proceso.revision}
          onUpdate={(nextRev) =>
            setProceso((prev) => ({ ...prev, revision: nextRev }))
          }
          onConfirmar={confirmarEstandarizacion}
        />
      )}

      {/* Archivo estandarizado */}
      {d && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-[#E6F4EF] px-4 py-3.5 text-sm text-[#005C3E]">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#007A53]" />
            <div>
              <p className="font-semibold">
                «{proceso.archivo}» quedó estandarizado
              </p>
              <p className="text-xs">
                {num(d.filas.length)} atenciones de {num(d.personas)} personas
                listas para extraer la cohorte.
              </p>
            </div>
          </div>

          {d.avisos?.length > 0 && (
            <div className="space-y-1">
              {(d.avisos as string[]).map((a, i) => (
                <p key={i} className="text-xs text-slate-600">
                  Nota: {a}
                </p>
              ))}
            </div>
          )}

          {/* Acordeón detalle de estandarización */}
          <Accordion className="rounded-xl border border-slate-200 bg-white px-4">
            <AccordionItem value="estandarizacion" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
                Ver cómo se estandarizó el archivo
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Columna de origen</TableHead>
                        <TableHead className="text-xs">Se tomó como</TableHead>
                        <TableHead className="text-xs">Quién decidió</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {d.estandarizacion.asignaciones.map((x: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">
                            {x.columna_original}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-[#004B87]">
                            {x.campo === "desconocida" ? "se elimina" : x.campo}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {x.decidio}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {d.estandarizacion.cambios_de_formato.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">Campo</TableHead>
                          <TableHead className="text-xs">Formato aplicado</TableHead>
                          <TableHead className="text-right text-xs">
                            Valores cambiados
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {d.estandarizacion.cambios_de_formato.map((x: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              {x.campo}
                            </TableCell>
                            <TableCell className="text-xs">{x.regla}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {num(x.modificados)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No fue necesario cambiar ningún valor de formato.
                  </p>
                )}

                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {d.estandarizacion.derivados.map((x: any, i: number) => (
                  <p key={i} className="text-xs text-slate-700">
                    Se calculó «<strong>{x.campo}</strong>» desde: {x.desde}.
                  </p>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Filtro definido por el comité */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F1F8] text-[#004B87]">
                <Filter className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  Filtro de la petición {proceso.peticion.id}:{" "}
                  <span className="font-normal text-slate-700">
                    {describirFiltro(proceso.filtro)}
                  </span>
                </p>
                {personasConFiltro !== null && (
                  <p className="text-xs text-slate-600">
                    En este archivo hay{" "}
                    <strong className="text-slate-900">
                      {num(personasConFiltro)} personas
                    </strong>{" "}
                    de 18 años o más con este filtro. Lo definió el comité de
                    ética y no se cambia aquí.
                  </p>
                )}
              </div>
            </div>

            {!c && (
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={handleExtraerCohorte}
                  className="h-10 gap-2 bg-[#004B87] px-5 text-sm font-semibold text-white hover:bg-[#003366]"
                >
                  <Users className="size-4" />
                  Extraer las personas de la petición
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cohorte extraída y riesgo inicial */}
      {c && proceso.antes && (
        <div className="space-y-5 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-base font-bold text-slate-900">
              Cohorte extraída y medición inicial (Antes de proteger)
            </h3>
            <Button
              type="button"
              onClick={() => setPasoActivo("proteccion")}
              className="gap-1.5 bg-[#004B87] text-white hover:bg-[#003366]"
            >
              Continuar a Protección
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Personas seleccionadas",
                val: num(c.personas),
                sub: "Cohorte exacta de la petición",
                estado: undefined as boolean | undefined,
              },
              {
                label: "Atenciones",
                val: num(c.atenciones),
                sub: "Una persona puede tener varias",
                estado: undefined as boolean | undefined,
              },
              {
                label: "Grupo más pequeño (k)",
                val: String(proceso.antes.kMin),
                sub: "Antes de proteger. Meta: 5 o más",
                estado: proceso.antes.kMin >= 5,
              },
              {
                label: "Personas únicas",
                val: pct(proceso.antes.pctUnicas),
                sub: "Se distinguen de todas las demás",
                estado: proceso.antes.pctUnicas === 0,
              },
            ].map((m) => (
              <div
                key={m.label}
                className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
              >
                {m.estado !== undefined && (
                  <span
                    className={`absolute top-4 right-4 size-2.5 rounded-full ${
                      m.estado ? "bg-[#007A53]" : "bg-red-500"
                    }`}
                  />
                )}
                <p className="text-xs font-medium text-slate-500">{m.label}</p>
                <p className="mt-1 font-heading text-2xl font-bold text-slate-900 tabular-nums">
                  {m.val}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    m.estado === true
                      ? "text-[#007A53]"
                      : m.estado === false
                      ? "text-red-600"
                      : "text-slate-500"
                  }`}
                >
                  {m.estado === undefined
                    ? m.sub
                    : `${m.estado ? "Cumple" : "No cumple"} · ${m.sub}`}
                </p>
              </div>
            ))}
          </div>

          <Accordion className="rounded-xl border border-slate-200 bg-white px-4">
            <AccordionItem value="exclusiones" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
                Ver por qué se excluyeron atenciones
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Concepto</TableHead>
                        <TableHead className="text-right text-xs">
                          Atenciones
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["Atenciones en el archivo", num(c.entrada)],
                        [
                          `− Diagnóstico fuera del filtro (${c.etiquetaFiltro})`,
                          num(c.excluidas.diagnostico),
                        ],
                        [
                          "− Menor de 18 años en la fecha de atención",
                          num(c.excluidas.menor),
                        ],
                        [
                          `− Fuera del periodo ${c.periodo}`,
                          num(c.excluidas.periodo),
                        ],
                        ["= Atenciones en la cohorte", num(c.atenciones)],
                      ].map(([concepto, cant], i, arr) => (
                        <TableRow
                          key={concepto}
                          className={
                            i === arr.length - 1 ? "bg-slate-50 font-bold" : ""
                          }
                        >
                          <TableCell className="text-xs">{concepto}</TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {cant}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-slate-600">
                  <strong>Identificadores presentes ahora:</strong>{" "}
                  {ident(proceso.antes.identificadores)}.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}
