"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useApp } from "@/context/app-context";

export function ConfirmDialog() {
  const { confirmState, resolverConfirmacion } = useApp();

  if (!confirmState) return null;

  return (
    <Dialog
      open={confirmState.open}
      onOpenChange={(open) => {
        if (!open) resolverConfirmacion(false);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                confirmState.destructivo
                  ? "bg-red-50 text-red-600"
                  : "bg-[#E8F1F8] text-[#004B87]"
              }`}
            >
              <AlertTriangle className="size-4.5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900">
                {confirmState.titulo}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-slate-600">
                {confirmState.mensaje}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => resolverConfirmacion(false)}
          >
            Cancelar
          </Button>
          <Button
            variant={confirmState.destructivo ? "destructive" : "default"}
            className={
              confirmState.destructivo
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[#004B87] text-white hover:bg-[#003366]"
            }
            onClick={() => resolverConfirmacion(true)}
          >
            {confirmState.confirmarTexto ?? "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
