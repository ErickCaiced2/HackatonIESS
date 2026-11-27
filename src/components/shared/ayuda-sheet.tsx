"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Search, ShieldCheck } from "lucide-react";

const PASOS_FLUJO = [
  {
    rol: "1. Comité de ética",
    texto:
      "Crea la petición con el PDF aprobado, la persona autorizada (licencia del MSP o identificador del IESS) y los datos que necesita (periodo y diagnóstico CIE-10), y la envía a TI.",
  },
  {
    rol: "2. Equipo de TI",
    texto:
      "Revisa la petición y el PDF. Puede devolverla con un motivo o procesarla: carga la base, revisa y confirma lo que la IA propone para cada columna, configura la protección, revisa resultados y trazabilidad, y la publica.",
  },
  {
    rol: "3. Doctor o personal autorizado",
    texto:
      "Ingresa con su licencia y el teclado seguro en pantalla, firma el acuerdo de confidencialidad y descarga los archivos protegidos.",
  },
  {
    rol: "4. Auditoría de TI",
    texto:
      "Consulta en Logs y en el Tablero todo lo ocurrido: accesos, peticiones, firmas, descargas y errores. El registro es inmutable (no repudio).",
  },
];

const GLOSARIO = [
  {
    termino: "Cohorte",
    definicion: "Las personas que cumplen los criterios solicitados por el estudio.",
  },
  {
    termino: "Cuasiidentificador",
    definicion:
      "Dato que por sí solo no identifica, pero combinado con otros sí (edad, sexo, región).",
  },
  {
    termino: "k (k-anonimato)",
    definicion:
      "Número de personas distintas en el grupo más pequeño que comparte los mismos cuasiidentificadores. La meta es 5 o más.",
  },
  {
    termino: "Persona única",
    definicion:
      "Nadie más comparte su combinación de datos (k = 1): se puede distinguir fácilmente.",
  },
  {
    termino: "Diversidad (l)",
    definicion:
      "Cantidad de diagnósticos distintos que debe contener cada grupo para evitar deducción de enfermedad.",
  },
  {
    termino: "Suprimir",
    definicion:
      "Eliminar una columna identificadora o retirar a las personas que quedan en grupos demasiado pequeños.",
  },
  {
    termino: "Utilidad",
    definicion:
      "Grado en que los datos protegidos siguen siendo válidos y útiles para responder la pregunta del estudio.",
  },
  {
    termino: "Anonimizar",
    definicion:
      "Transformar los datos para que nadie pueda reidentificar a una persona sin un esfuerzo desproporcionado. Nunca equivale a «riesgo cero».",
  },
  {
    termino: "Petición",
    definicion:
      "Solicitud formal del comité de ética con destinatario, PDF aprobado, periodo y CIE-10. Estados: enviada, devuelta, en proceso, publicada, firmada, descargada.",
  },
  {
    termino: "Logs",
    definicion:
      "Bitácora de auditoría de TI: inicios de sesión, peticiones, descargas y errores. Solo se agregan registros; no se pueden borrar.",
  },
  {
    termino: "PTA",
    definicion:
      "Protocolo Técnico de Anonimización: informe auditable de las transformaciones realizadas y el riesgo residual.",
  },
];

export function AyudaSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const norm = q.trim().toLowerCase();
  const filtrados = GLOSARIO.filter(
    (g) =>
      !norm ||
      g.termino.toLowerCase().includes(norm) ||
      g.definicion.toLowerCase().includes(norm)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#E8F1F8] text-[#004B87]">
              <BookOpen className="size-4.5" />
            </div>
            <div>
              <SheetTitle className="font-heading text-base font-bold text-slate-900">
                Ayuda y glosario institucional
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                Flujo de trabajo y definiciones técnicas de privacidad
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          <div className="space-y-6 pb-6">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#004B87]">
                <ShieldCheck className="size-4" />
                Cómo funciona la plataforma
              </h3>
              <ol className="space-y-2.5">
                {PASOS_FLUJO.map((p) => (
                  <li
                    key={p.rol}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {p.rol}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {p.texto}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#004B87]">
                  Glosario técnico ({filtrados.length})
                </h3>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar término (ej. k, cohorte, PTA)..."
                  className="h-9 bg-white pl-9 text-sm"
                />
              </div>

              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {filtrados.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">
                    No se encontraron términos para «{q}».
                  </p>
                ) : (
                  filtrados.map((item) => (
                    <div key={item.termino} className="p-3.5">
                      <dt className="text-sm font-semibold text-slate-900">
                        {item.termino}
                      </dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {item.definicion}
                      </dd>
                    </div>
                  ))
                )}
              </dl>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
