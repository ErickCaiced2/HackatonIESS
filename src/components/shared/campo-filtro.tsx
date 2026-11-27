"use client";

import {
  CAPITULOS,
  bloquesDe,
  categoriasDe,
  PERIODO_MINIMO,
  anioActual,
  periodo,
} from "@/motor/cie10.js";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/shared/native-select";
import { CalendarRange, Stethoscope } from "lucide-react";
import type { FiltroCIE10 } from "@/lib/types";

interface CampoFiltroProps {
  filtro: FiltroCIE10;
  onChange: (next: FiltroCIE10) => void;
}

export function CampoFiltro({ filtro, onChange }: CampoFiltroProps) {
  const p = periodo(filtro);
  const anios: number[] = [];
  for (let a = anioActual(); a >= PERIODO_MINIMO; a--) anios.push(a);

  const bloques = bloquesDe(filtro.capitulo) as { id: string; nombre: string }[];
  const categorias = categoriasDe(filtro.capitulo, filtro.bloque, []) as [
    string,
    string,
  ][];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Stethoscope className="size-3.5 text-[#004B87]" />
          Diagnóstico CIE-10
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-capitulo" className="text-slate-700">
              Capítulo CIE-10
            </Label>
            <NativeSelect
              id="pf-capitulo"
              value={filtro.capitulo}
              onChange={(e) =>
                onChange({
                  ...filtro,
                  capitulo: e.target.value,
                  bloque: "",
                  categoria: "",
                })
              }
            >
              {(
                CAPITULOS as {
                  id: string;
                  desde: string;
                  hasta: string;
                  nombre: string;
                }[]
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.desde}-{c.hasta} · {c.nombre}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-grupo" className="text-slate-700">
              Grupo
            </Label>
            <NativeSelect
              id="pf-grupo"
              value={filtro.bloque}
              onChange={(e) =>
                onChange({ ...filtro, bloque: e.target.value, categoria: "" })
              }
            >
              <option value="">Todos los grupos</option>
              {bloques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.nombre}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-categoria" className="text-slate-700">
              Categoría
            </Label>
            <NativeSelect
              id="pf-categoria"
              value={filtro.categoria}
              onChange={(e) =>
                onChange({ ...filtro, categoria: e.target.value })
              }
            >
              <option value="">Todas las categorías</option>
              {categorias.map(([c, n]) => (
                <option key={c} value={c}>
                  {c} · {n}
                </option>
              ))}
            </NativeSelect>
            {filtro.capitulo !== "V" && (
              <p className="text-xs text-slate-500">
                Fuera del capítulo V solo se puede pedir el capítulo o un grupo
                completo.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <CalendarRange className="size-3.5 text-[#004B87]" />
          Periodo de atención
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-desde" className="text-slate-700">
              Desde el año
            </Label>
            <NativeSelect
              id="pf-desde"
              value={String(p.desde)}
              onChange={(e) =>
                onChange({ ...filtro, desde: Number(e.target.value) })
              }
            >
              {anios.map((a) => (
                <option key={a} value={String(a)} disabled={a > p.hasta}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-hasta" className="text-slate-700">
              Hasta el año
            </Label>
            <NativeSelect
              id="pf-hasta"
              value={String(p.hasta)}
              onChange={(e) =>
                onChange({ ...filtro, hasta: Number(e.target.value) })
              }
            >
              {anios.map((a) => (
                <option key={a} value={String(a)} disabled={a < p.desde}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200/80">
          Fecha de ingreso del{" "}
          <strong className="font-semibold text-slate-800">
            1 de enero de {p.desde}
          </strong>{" "}
          al{" "}
          <strong className="font-semibold text-slate-800">
            31 de diciembre de {p.hasta}
          </strong>
          . Solo personas de 18 años o más.
        </p>
      </div>
    </div>
  );
}
