export type Rol = "ti" | "ce" | "receptor";

export type VistaId =
  | "login"
  | "tablero"
  | "ti-peticiones"
  | "proceso"
  | "ti-logs"
  | "ce-peticiones"
  | "doc-peticiones";

export type PasoProcesoId =
  | "datos"
  | "proteccion"
  | "resultados"
  | "trazabilidad"
  | "publicar";

export interface Destinatario {
  tipo: "msp" | "iess";
  id: string;
}

export interface UsuarioSesion {
  usuario: string;
  nombre: string;
  rol: Rol;
  destinatario?: Destinatario;
  desde?: string;
}

export interface FiltroCIE10 {
  capitulo: string;
  bloque: string;
  categoria: string;
  desde: number;
  hasta: number;
}

export interface AprobacionPDF {
  nombre: string;
  tamano: number;
  tipo: string;
  sha256?: string;
}

export interface HistorialPeticionItem {
  fecha: string;
  estado: string;
  por: string;
  motivo?: string;
}

export interface DescargaPeticion {
  archivo: string;
  tipo: string;
  fecha: string;
  por: string;
}

export interface Peticion {
  id: string;
  estado:
    | "enviada"
    | "devuelta"
    | "en_proceso"
    | "publicada"
    | "firmada"
    | "descargada";
  creadaEn: string;
  creadaPor: string;
  destinatario: Destinatario;
  filtro: FiltroCIE10;
  aprobacion: AprobacionPDF;
  historial: HistorialPeticionItem[];
  ejecucion?: {
    id: string;
    fecha: string;
    configuracion: string;
    kDespues: number;
    personas: number;
  } | null;
  firmadoEn?: string | null;
  firmadoPor?: string | null;
  descargas: DescargaPeticion[];
}

export interface ConfigProteccion {
  tipo: "referencia" | "propia";
  k: number;
  anchoEdad: number;
  ubicacion: "region" | "provincia";
  fecha: "mes" | "anio";
  l: number;
  topeEstancia: number | null;
}

export interface DecisionesIA {
  asignacion: string[];
  revisadas: Set<number>;
  sexo: Record<string, string>;
  tipo: Record<string, string>;
  ordenFecha: Record<string, string>;
}

export interface RevisionIA {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analisis: any;
  decisiones: DecisionesIA;
  codificacion: string;
}

export interface EstadoProceso {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos: any | null;
  revision: RevisionIA | null;
  archivo: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cohorte: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  antes: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  r: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historial: Record<string, any>;
  config: ConfigProteccion;
  propia: ConfigProteccion;
  filtro: FiltroCIE10;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deshacer: any | null;
  desactualizado: boolean;
  peticion: Peticion | null;
  contar?: ((f: FiltroCIE10) => number) | null;
}

export interface ConfirmOptions {
  titulo: string;
  mensaje: string;
  confirmarTexto?: string;
  destructivo?: boolean;
}
