"use client";

import { toast } from "sonner";
import { crearRegistro } from "@/motor/registro.js";
import { crearPeticiones } from "@/motor/peticiones.js";
import { crearLogs } from "@/motor/logs.js";
import { etiquetaFiltro, etiquetaPeriodo } from "@/motor/cie10.js";
import { leerArchivo } from "@/lib/archivos";
import type { FiltroCIE10, UsuarioSesion } from "@/lib/types";

// Lazy singletons so SSR never touches localStorage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _registro: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _peticiones: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _logs: any = null;

export function getRegistro() {
  if (!_registro) _registro = crearRegistro();
  return _registro;
}

export function getPeticiones() {
  if (!_peticiones) _peticiones = crearPeticiones();
  return _peticiones;
}

export function getLogs() {
  if (!_logs) _logs = crearLogs();
  return _logs;
}

const CLAVE_SESION = "iess.sesion.v1";

export const sesion = {
  actual(): UsuarioSesion | null {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(
        window.sessionStorage.getItem(CLAVE_SESION) ?? "null"
      ) as UsuarioSesion | null;
    } catch {
      return null;
    }
  },
  iniciar(usuario: UsuarioSesion) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ ...usuario, desde: new Date().toISOString() })
    );
  },
  cerrar() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(CLAVE_SESION);
  },
};

export function registrarLog(
  tipo: "sesion" | "peticion" | "descarga" | "error",
  accion: string,
  detalle = "",
  extra: Record<string, unknown> = {}
) {
  const u = sesion.actual();
  try {
    return getLogs().registrar({
      tipo,
      accion,
      detalle,
      usuario: u?.usuario ?? "",
      rol: u?.rol ?? "",
      ...extra,
    });
  } catch {
    return null;
  }
}

const SOLUCIONES: [RegExp, string][] = [
  [
    /separador|encabezado|Excel|primera fila/,
    "Use un archivo de texto con una fila de nombres de columna y una fila por atención.",
  ],
  [
    /Faltan columnas|sin clasificar|repetidas/,
    "Use un archivo con las 28 columnas del diccionario, sin cambiar sus nombres.",
  ],
  [
    /Filas inválidas|comilla/,
    "Corrija esas filas en el archivo original y vuelva a cargarlo.",
  ],
  [
    /vacía|vacío|no tiene filas/,
    "Revise que sea el archivo correcto y que el filtro de la petición tenga casos.",
  ],
  [
    /provincia/,
    "Corrija la columna provincia usando los nombres de las 24 provincias.",
  ],
  [
    /digest|subtle/,
    "Abra la página en localhost o HTTPS para habilitar las funciones criptográficas del navegador.",
  ],
  [
    /almacenamiento/,
    "Libere espacio del navegador o use otro navegador.",
  ],
  [
    /no puede pasar|Solo el destinatario|Firme/,
    "Actualice la vista: la petición pudo cambiar de estado.",
  ],
];

export function mostrarError(mensaje: string, contexto = "Error") {
  if (!mensaje) return;
  registrarLog("error", contexto, mensaje, { resultado: "fallo" });
  const solucion =
    SOLUCIONES.find(([patron]) => patron.test(mensaje))?.[1] ??
    "Revise el último paso e inténtelo de nuevo.";
  toast.error("No se pudo completar", {
    description: `${mensaje} — Qué hacer: ${solucion}`,
    duration: 7000,
  });
}

export function notificarOk(mensaje: string, descripcion?: string) {
  toast.success(mensaje, descripcion ? { description: descripcion } : undefined);
}

export function notificarAviso(mensaje: string, descripcion?: string) {
  toast.warning(mensaje, descripcion ? { description: descripcion } : undefined);
}

export function notificarMal(mensaje: string, descripcion?: string) {
  toast.error(mensaje, descripcion ? { description: descripcion } : undefined);
}

export const fechaHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-EC", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "—";

export const fechaCorta = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-EC", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

export async function sha256Bytes(buffer: ArrayBuffer): Promise<string> {
  const hsh = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hsh)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function descargar(
  nombre: string,
  contenido: Blob | BlobPart,
  tipo: string
) {
  const blob =
    contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const describirFiltro = (f: FiltroCIE10) =>
  `${etiquetaFiltro(f)} · periodo ${etiquetaPeriodo(f)}`;

export async function abrirPdf(id: string) {
  try {
    const blob = await leerArchivo<Blob>("aprobacion:" + id);
    if (!blob) {
      throw new Error(
        "No se encontró el PDF de la solicitud aprobada en este navegador."
      );
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    mostrarError(
      e instanceof Error ? e.message : String(e),
      "Abrir solicitud aprobada"
    );
  }
}
