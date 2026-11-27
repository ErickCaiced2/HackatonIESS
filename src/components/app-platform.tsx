"use client";

import { AppProvider, useApp } from "@/context/app-context";
import { LoginView } from "@/components/views/login-view";
import { AppShell } from "@/components/views/app-shell";
import { ComiteView } from "@/components/views/comite-view";
import { DoctorView } from "@/components/views/doctor-view";
import { TiTablero } from "@/components/views/ti/ti-tablero";
import { TiPeticiones } from "@/components/views/ti/ti-peticiones";
import { TiProceso } from "@/components/views/ti/ti-proceso";
import { TiLogs } from "@/components/views/ti/ti-logs";
import { AyudaSheet } from "@/components/shared/ayuda-sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BusyOverlay } from "@/components/shared/busy-overlay";
import { Loader2 } from "lucide-react";

function PlatformContent() {
  const { hidratado, usuario, vista, ayudaAbierta, setAyudaAbierta } = useApp();

  if (!hidratado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="size-5 animate-spin text-[#004B87]" />
          Cargando TASS...
        </div>
      </div>
    );
  }

  return (
    <>
      {!usuario || vista === "login" ? (
        <LoginView />
      ) : (
        <AppShell>
          {vista === "tablero" && <TiTablero />}
          {vista === "ti-peticiones" && <TiPeticiones />}
          {vista === "proceso" && <TiProceso />}
          {vista === "ti-logs" && <TiLogs />}
          {vista === "ce-peticiones" && <ComiteView />}
          {vista === "doc-peticiones" && <DoctorView />}
        </AppShell>
      )}

      <AyudaSheet open={ayudaAbierta} onOpenChange={setAyudaAbierta} />
      <ConfirmDialog />
      <BusyOverlay />
    </>
  );
}

export function AppPlatform() {
  return (
    <AppProvider>
      <PlatformContent />
    </AppProvider>
  );
}
