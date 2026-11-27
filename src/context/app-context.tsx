"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { REFERENCIA, PROPIA } from "@/motor/config.js";
import { FILTRO_ESTUDIO } from "@/motor/cie10.js";
import {
  getPeticiones,
  sesion,
  registrarLog,
  mostrarError,
  notificarOk,
  describirFiltro,
} from "@/lib/servicios";
import type {
  ConfirmOptions,
  EstadoProceso,
  PasoProcesoId,
  Peticion,
  Rol,
  UsuarioSesion,
  VistaId,
} from "@/lib/types";

export const VISTAS_POR_ROL: Record<Rol, { id: VistaId; label: string }[]> = {
  ti: [
    { id: "tablero", label: "Tablero" },
    { id: "ti-peticiones", label: "Peticiones" },
    { id: "proceso", label: "Procesamiento" },
    { id: "ti-logs", label: "Logs" },
  ],
  ce: [{ id: "ce-peticiones", label: "Peticiones" }],
  receptor: [{ id: "doc-peticiones", label: "Mis peticiones" }],
};

export const PASOS_PROCESO: {
  id: PasoProcesoId;
  numero: number;
  titulo: string;
  corto: string;
  descripcion: string;
}[] = [
  {
    id: "datos",
    numero: 1,
    titulo: "1. Datos e IA",
    corto: "Datos e IA",
    descripcion:
      "Cargue la base de datos de la petición, revise las columnas propuestas por la IA y extraiga la cohorte.",
  },
  {
    id: "proteccion",
    numero: 2,
    titulo: "2. Protección",
    corto: "Protección",
    descripcion:
      "Elija entre la configuración de referencia o propia y ajuste los parámetros de anonimización.",
  },
  {
    id: "resultados",
    numero: 3,
    titulo: "3. Resultados",
    corto: "Resultados",
    descripcion:
      "Evalúe el veredicto de riesgo de reidentificación (k, l) frente a la utilidad conservada.",
  },
  {
    id: "trazabilidad",
    numero: 4,
    titulo: "4. Trazabilidad",
    corto: "Trazabilidad",
    descripcion:
      "Audite qué se hizo en cada vuelta, columna por columna, y las verificaciones V-01 a V-08.",
  },
  {
    id: "publicar",
    numero: 5,
    titulo: "5. Publicar",
    corto: "Publicar",
    descripcion:
      "Verifique los requisitos finales y publique el entregable protegido al destinatario autorizado.",
  },
];

export function crearEstadoProcesoInicial(): EstadoProceso {
  return {
    datos: null,
    revision: null,
    archivo: "",
    cohorte: null,
    antes: null,
    r: null,
    historial: {},
    config: { ...REFERENCIA },
    propia: { ...PROPIA },
    filtro: { ...FILTRO_ESTUDIO },
    deshacer: null,
    desactualizado: false,
    peticion: null,
    contar: null,
  };
}

interface AppContextValue {
  hidratado: boolean;
  usuario: UsuarioSesion | null;
  vista: VistaId;
  pasoActivo: PasoProcesoId;
  proceso: EstadoProceso;
  ocupado: string | null;
  ayudaAbierta: boolean;
  tick: number;
  campoResaltado: string | null;
  confirmState: (ConfirmOptions & { open: boolean }) | null;
  setAyudaAbierta: (open: boolean) => void;
  setPasoActivo: (paso: PasoProcesoId) => void;
  setProceso: React.Dispatch<React.SetStateAction<EstadoProceso>>;
  refrescar: () => void;
  iniciarSesion: (u: UsuarioSesion) => void;
  cerrarSesion: () => Promise<void>;
  irA: (nuevaVista: VistaId) => void;
  irACampo: (
    campoId: string,
    paso: PasoProcesoId,
    abrirParametros?: boolean
  ) => void;
  parametrosAbiertos: boolean;
  setParametrosAbiertos: (open: boolean) => void;
  confirmar: (opts: ConfirmOptions) => Promise<boolean>;
  resolverConfirmacion: (accepted: boolean) => void;
  trabajar: (
    mensaje: string,
    fn: () => Promise<void> | void,
    destinoPaso?: PasoProcesoId
  ) => void;
  procesarPeticion: (id: string, continuar?: boolean) => Promise<void>;
  empezarDeNuevo: () => Promise<void>;
  sePuedeDescartar: (accion: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

const emptySubscribe = () => () => {};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const hidratado = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(() =>
    sesion.actual()
  );
  const [vista, setVista] = useState<VistaId>(() => {
    const u = sesion.actual();
    return u ? VISTAS_POR_ROL[u.rol][0].id : "login";
  });
  const [pasoActivo, setPasoActivo] = useState<PasoProcesoId>("datos");
  const [proceso, setProceso] = useState<EstadoProceso>(crearEstadoProcesoInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [tick, setTick] = useState(0);
  const [parametrosAbiertos, setParametrosAbiertos] = useState(true);
  const [campoResaltado, setCampoResaltado] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { open: boolean }) | null
  >(null);
  const confirmResolverRef = useRef<((val: boolean) => void) | null>(null);

  const refrescar = useCallback(() => setTick((t) => t + 1), []);

  const confirmar = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({ ...opts, open: true });
    });
  }, []);

  const resolverConfirmacion = useCallback((accepted: boolean) => {
    setConfirmState(null);
    confirmResolverRef.current?.(accepted);
    confirmResolverRef.current = null;
  }, []);

  const sePuedeDescartar = useCallback(
    async (accion: string) => {
      if (!proceso.r && !Object.keys(proceso.historial).length) return true;
      return confirmar({
        titulo: "Se descartarán los resultados",
        mensaje: `Al ${accion} se borran los resultados de esta sesión. Las descargas ya guardadas no cambian.`,
        confirmarTexto: "Descartar y continuar",
        destructivo: true,
      });
    },
    [proceso.r, proceso.historial, confirmar]
  );

  const irA = useCallback((nuevaVista: VistaId) => {
    setVista(nuevaVista);
    setTick((t) => t + 1);
  }, []);

  const iniciarSesion = useCallback((u: UsuarioSesion) => {
    sesion.iniciar(u);
    setUsuario(u);
    setVista(VISTAS_POR_ROL[u.rol][0].id);
    setTick((t) => t + 1);
  }, []);

  const cerrarSesion = useCallback(async () => {
    if (!(await sePuedeDescartar("cerrar la sesión"))) return;
    registrarLog("sesion", "Cierre de sesión", "");
    sesion.cerrar();
    setUsuario(null);
    setProceso(crearEstadoProcesoInicial());
    setPasoActivo("datos");
    setVista("login");
    setTick((t) => t + 1);
  }, [sePuedeDescartar]);

  const trabajar = useCallback(
    (
      mensaje: string,
      fn: () => Promise<void> | void,
      destinoPaso?: PasoProcesoId
    ) => {
      setOcupado(mensaje);
      setTimeout(async () => {
        let bien = false;
        try {
          await fn();
          bien = true;
        } catch (e) {
          mostrarError(
            e instanceof Error ? e.message : String(e),
            "Procesamiento de la petición"
          );
        }
        setOcupado(null);
        setTick((t) => t + 1);
        if (bien && destinoPaso) {
          setVista("proceso");
          setPasoActivo(destinoPaso);
        }
      }, 35);
    },
    []
  );

  const procesarPeticion = useCallback(
    async (id: string, continuar = false) => {
      if (
        proceso.peticion?.id !== id &&
        !(await sePuedeDescartar("procesar otra petición"))
      ) {
        return;
      }
      try {
        const pets = getPeticiones();
        let p: Peticion = pets.obtener(id);
        if (p.estado === "enviada") {
          p = pets.tomar(id, sesion.actual()?.usuario ?? "ti");
          registrarLog(
            "peticion",
            "Tomada por TI para procesar",
            describirFiltro(p.filtro),
            { referencia: id }
          );
        }
        setProceso((prev) =>
          prev.peticion?.id !== id
            ? {
                ...crearEstadoProcesoInicial(),
                peticion: p,
                filtro: { ...p.filtro },
              }
            : { ...prev, peticion: p }
        );
        setVista("proceso");
        setPasoActivo("datos");
        setTick((t) => t + 1);
        if (!continuar) {
          notificarOk(`Procesando ${id}`, "Cargue la base de datos (CSV o TSV).");
        }
      } catch (e) {
        mostrarError(
          e instanceof Error ? e.message : String(e),
          "Procesar petición"
        );
      }
    },
    [proceso.peticion?.id, sePuedeDescartar]
  );

  const empezarDeNuevo = useCallback(async () => {
    const ok = await confirmar({
      titulo: "Empezar de nuevo",
      mensaje:
        "Se borra de la memoria el archivo cargado y los resultados de esta petición.",
      confirmarTexto: "Borrar todo",
      destructivo: true,
    });
    if (!ok) return;
    setProceso((prev) => ({
      ...crearEstadoProcesoInicial(),
      peticion: prev.peticion,
      filtro: prev.peticion ? { ...prev.peticion.filtro } : { ...FILTRO_ESTUDIO },
    }));
    setPasoActivo("datos");
    notificarOk("Memoria limpiada", "Se borró el archivo cargado y los resultados.");
    setTick((t) => t + 1);
  }, [confirmar]);

  const irACampo = useCallback(
    (campoId: string, paso: PasoProcesoId, abrirParametros = false) => {
      setVista("proceso");
      setPasoActivo(paso);
      if (abrirParametros) setParametrosAbiertos(true);
      setCampoResaltado(campoId);
      setTimeout(() => {
        const el = document.getElementById(campoId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus?.({ preventScroll: true });
        }
      }, 120);
      setTimeout(() => setCampoResaltado(null), 2600);
    },
    []
  );

  // Atajos de teclado de TI: Alt+0 tablero, Alt+1..5 pasos del wizard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || usuario?.rol !== "ti") return;
      if (e.key === "0") {
        e.preventDefault();
        setVista("tablero");
        return;
      }
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < PASOS_PROCESO.length) {
        e.preventDefault();
        setVista("proceso");
        setPasoActivo(PASOS_PROCESO[idx].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [usuario?.rol]);

  // Evita perder trabajo al recargar
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (proceso.datos || proceso.revision) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [proceso.datos, proceso.revision]);

  const value = useMemo<AppContextValue>(
    () => ({
      hidratado,
      usuario,
      vista,
      pasoActivo,
      proceso,
      ocupado,
      ayudaAbierta,
      tick,
      campoResaltado,
      confirmState,
      setAyudaAbierta,
      setPasoActivo,
      setProceso,
      refrescar,
      iniciarSesion,
      cerrarSesion,
      irA,
      irACampo,
      parametrosAbiertos,
      setParametrosAbiertos,
      confirmar,
      resolverConfirmacion,
      trabajar,
      procesarPeticion,
      empezarDeNuevo,
      sePuedeDescartar,
    }),
    [
      hidratado,
      usuario,
      vista,
      pasoActivo,
      proceso,
      ocupado,
      ayudaAbierta,
      tick,
      campoResaltado,
      confirmState,
      refrescar,
      iniciarSesion,
      cerrarSesion,
      irA,
      irACampo,
      parametrosAbiertos,
      confirmar,
      resolverConfirmacion,
      trabajar,
      procesarPeticion,
      empezarDeNuevo,
      sePuedeDescartar,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
