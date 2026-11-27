"use client";

import { useState } from "react";
import { ROLES } from "@/motor/usuarios.js";
import { useApp, VISTAS_POR_ROL } from "@/context/app-context";
import { getPeticiones } from "@/lib/servicios";
import { IessLogo, TricolorBar } from "@/components/shared/iess-brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  BookOpen,
  ClipboardList,
  Cpu,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  RotateCcw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { Peticion, VistaId } from "@/lib/types";

const ICONOS_VISTA: Record<VistaId, React.ComponentType<{ className?: string }>> = {
  login: ShieldCheck,
  tablero: LayoutDashboard,
  "ti-peticiones": ClipboardList,
  proceso: Cpu,
  "ti-logs": ScrollText,
  "ce-peticiones": ClipboardList,
  "doc-peticiones": FileCheck2,
};

const TITULOS_VISTA: Record<VistaId, { titulo: string; subtitulo: string }> = {
  login: { titulo: "Iniciar sesión", subtitulo: "" },
  tablero: {
    titulo: "Tablero de TI",
    subtitulo: "Indicadores, actividad reciente y entregas completadas",
  },
  "ti-peticiones": {
    titulo: "Bandeja de peticiones",
    subtitulo: "Revise, devuelva o procese solicitudes aprobadas por el comité",
  },
  proceso: {
    titulo: "Procesamiento y anonimización",
    subtitulo: "Flujo asistido por IA en 5 pasos con verificación automática",
  },
  "ti-logs": {
    titulo: "Logs del sistema",
    subtitulo: "Bitácora auditable de solo escritura (no repudio)",
  },
  "ce-peticiones": {
    titulo: "Comité de ética",
    subtitulo: "Gestión y seguimiento de peticiones de datos clínicos",
  },
  "doc-peticiones": {
    titulo: "Portal de investigador",
    subtitulo: "Firma de acuerdo de confidencialidad y descarga segura",
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    usuario,
    vista,
    proceso,
    irA,
    cerrarSesion,
    empezarDeNuevo,
    setAyudaAbierta,
    tick,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!usuario) return null;

  void tick;
  const todasPeticiones = getPeticiones().lista() as Peticion[];

  const badgeCount = (id: VistaId): number => {
    if (id === "ti-peticiones") {
      return todasPeticiones.filter(
        (p) => p.estado === "enviada" || p.estado === "en_proceso"
      ).length;
    }
    if (id === "ce-peticiones") {
      return todasPeticiones.filter((p) => p.estado === "devuelta").length;
    }
    if (id === "doc-peticiones" && usuario.destinatario) {
      const mias = getPeticiones().paraDestinatario(
        usuario.destinatario
      ) as Peticion[];
      return mias.filter((p) => p.estado === "publicada").length;
    }
    return 0;
  };

  const navItems = VISTAS_POR_ROL[usuario.rol];
  const meta = TITULOS_VISTA[vista];
  const rolLabel =
    (ROLES as Record<string, string>)[usuario.rol] ?? usuario.rol;

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <IessLogo variant="light" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navegación · {usuario.rol === "ti" ? "TI" : usuario.rol === "ce" ? "Comité" : "Receptor"}
        </p>

        <nav aria-label="Secciones principales" className="space-y-1">
          {navItems.map((item) => {
            const Icon = ICONOS_VISTA[item.id];
            const activo = vista === item.id;
            const count = badgeCount(item.id);
            return (
              <button
                key={item.id}
                type="button"
                id={`ver-${item.id}`}
                aria-current={activo ? "page" : undefined}
                onClick={() => {
                  irA(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  activo
                    ? "bg-[#E8F1F8] font-semibold text-[#004B87]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {activo && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-[#004B87]"
                  />
                )}
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`size-4 shrink-0 ${
                      activo
                        ? "text-[#004B87]"
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {count > 0 && (
                  <span
                    className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                      item.id === "ce-peticiones"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {usuario.rol === "ti" && proceso.peticion && (
          <div className="mt-5 rounded-xl border border-[#004B87]/20 bg-[#E8F1F8]/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#004B87]">
              Petición en curso
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-slate-900">
              {proceso.peticion.id}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {proceso.archivo || "Sin archivo cargado"}
            </p>
          </div>
        )}
      </div>

      {/* Pie del sidebar */}
      <div className="space-y-2 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => {
            setAyudaAbierta(true);
            setMobileMenuOpen(false);
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <BookOpen className="size-4 text-[#004B87]" />
          Ayuda y glosario
        </button>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {usuario.nombre}
              </p>
              <p className="truncate font-mono text-xs text-slate-500">
                {usuario.usuario}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#004B87] ring-1 ring-slate-200">
              {usuario.rol === "ti"
                ? "TI"
                : usuario.rol === "ce"
                ? "Comité"
                : "Autorizado"}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-500" title={rolLabel}>
            {rolLabel}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cerrarSesion}
            className="mt-2.5 h-8 w-full justify-center gap-1.5 border-slate-300 bg-white text-xs text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <TricolorBar />

      <div className="flex flex-1">
        {/* Sidebar escritorio */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
        </aside>

        {/* Drawer móvil */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            {renderSidebarContent()}
          </SheetContent>
        </Sheet>

        {/* Área principal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Abrir menú"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-lg font-bold text-slate-900">
                  {meta.titulo}
                </h1>
                {meta.subtitulo && (
                  <p className="hidden truncate text-xs text-slate-500 sm:block">
                    {meta.subtitulo}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {usuario.rol === "ti" && vista === "proceso" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  id="reiniciar"
                  disabled={!proceso.datos && !proceso.revision}
                  onClick={empezarDeNuevo}
                  className="gap-1.5 border-slate-300 text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="hidden sm:inline">Empezar de nuevo</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAyudaAbierta(true)}
                className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <BookOpen className="size-3.5 text-[#004B87]" />
                <span className="hidden sm:inline">Ayuda y glosario</span>
              </Button>
            </div>
          </header>

          <main
            id="contenido"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
