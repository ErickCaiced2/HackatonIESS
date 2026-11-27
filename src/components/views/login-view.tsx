"use client";

import { useState } from "react";
import { autenticar, ROLES } from "@/motor/usuarios.js";
import { normalizarId, validarDestinatario } from "@/motor/destinatario.js";
import { useApp } from "@/context/app-context";
import { registrarLog } from "@/lib/servicios";
import { IessLogo, TricolorBar } from "@/components/shared/iess-brand";
import { CampoPersona } from "@/components/shared/campo-persona";
import { TecladoVirtual } from "@/components/shared/teclado-virtual";
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
  AlertCircle,
  BookOpen,
  Building2,
  KeyRound,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import type { Destinatario, UsuarioSesion } from "@/lib/types";

export function LoginView() {
  const { iniciarSesion, setAyudaAbierta } = useApp();
  const [modo, setModo] = useState<"interno" | "receptor">("interno");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [persona, setPersona] = useState<Destinatario>({ tipo: "msp", id: "" });
  const [claveTeclado, setClaveTeclado] = useState("");
  const [shuffleKey, setShuffleKey] = useState(0);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const intentarAcceso = async (
    identificador: string,
    contrasena: string,
    rolesPermitidos: string[]
  ) => {
    setError("");
    setEnviando(true);
    try {
      const u = (await autenticar(
        identificador,
        contrasena
      )) as UsuarioSesion | null;
      if (!u || !rolesPermitidos.includes(u.rol)) {
        const motivo = u
          ? "Rol no permitido en esta pestaña"
          : "Credenciales no válidas";
        registrarLog("sesion", "Inicio de sesión fallido", motivo, {
          usuario: identificador,
          resultado: "fallo",
        });
        setError(
          "Usuario o contraseña incorrectos. Revise los datos e inténtelo de nuevo."
        );
        return;
      }
      iniciarSesion(u);
      registrarLog(
        "sesion",
        "Inicio de sesión",
        (ROLES as Record<string, string>)[u.rol] ?? u.rol
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmitInterno = async (e: React.FormEvent) => {
    e.preventDefault();
    await intentarAcceso(usuario, clave, ["ti", "ce"]);
  };

  const handleSubmitReceptor = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validarDestinatario(persona);
    if (err) {
      setError(err);
      return;
    }
    await intentarAcceso(normalizarId(persona.id), claveTeclado, ["receptor"]);
    setClaveTeclado("");
    setShuffleKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <TricolorBar />

      {/* Cabecera minimalista */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
        <IessLogo />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAyudaAbierta(true)}
          className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          <BookOpen className="size-3.5 text-[#004B87]" />
          Ayuda y glosario
        </Button>
      </header>

      {/* Formulario centrado, limpio y directo */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8">
            <h1
              id="login-h"
              className="mb-5 font-heading text-2xl font-bold text-slate-900"
            >
              Iniciar sesión
            </h1>

            {/* Selector de tipo de acceso */}
            <div
              role="group"
              aria-label="Tipo de acceso"
              className="mb-6 grid grid-cols-1 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-2"
            >
              <button
                type="button"
                id="login-modo-interno"
                aria-pressed={modo === "interno"}
                onClick={() => {
                  setModo("interno");
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  modo === "interno"
                    ? "bg-white text-[#004B87] shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building2 className="size-4 shrink-0" />
                Personal IESS (TI o comité)
              </button>

              <button
                type="button"
                id="login-modo-receptor"
                aria-pressed={modo === "receptor"}
                onClick={() => {
                  setModo("receptor");
                  setError("");
                  setShuffleKey((k) => k + 1);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  modo === "receptor"
                    ? "bg-white text-[#004B87] shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Stethoscope className="size-4 shrink-0" />
                Doctor o personal autorizado
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {modo === "interno" ? (
              <form onSubmit={handleSubmitInterno} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-usuario" className="text-slate-700">
                    Usuario
                  </Label>
                  <Input
                    id="login-usuario"
                    autoComplete="username"
                    required
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="Ej.: ti o ce"
                    className="h-10 border-slate-300 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-clave" className="text-slate-700">
                    Contraseña
                  </Label>
                  <Input
                    id="login-clave"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    className="h-10 border-slate-300 bg-white"
                  />
                </div>

                <Button
                  type="submit"
                  id="login-entrar"
                  disabled={enviando}
                  className="mt-2 h-10 w-full bg-[#004B87] text-sm font-semibold text-white hover:bg-[#003366]"
                >
                  <KeyRound className="size-4" />
                  {enviando ? "Verificando..." : "Ingresar"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmitReceptor} className="space-y-5">
                <CampoPersona
                  prefijo="login"
                  valor={persona}
                  onChange={setPersona}
                />

                <TecladoVirtual
                  key={shuffleKey}
                  id="login-clave-teclado"
                  label="Contraseña"
                  value={claveTeclado}
                  onChange={setClaveTeclado}
                />

                <Button
                  type="submit"
                  id="login-entrar"
                  disabled={enviando}
                  className="h-10 w-full bg-[#004B87] text-sm font-semibold text-white hover:bg-[#003366]"
                >
                  <UserCheck className="size-4" />
                  {enviando ? "Verificando..." : "Ingresar"}
                </Button>
              </form>
            )}
          </div>

          {/* Cuentas de prueba del prototipo */}
          <Accordion className="rounded-xl border border-slate-200 bg-white px-4 shadow-2xs">
            <AccordionItem value="cuentas" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-semibold text-slate-700 hover:no-underline">
                Cuentas de prueba del prototipo
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModo("interno");
                      setUsuario("ti");
                      setClave("ti");
                      setError("");
                    }}
                    className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-[#004B87] hover:bg-[#E8F1F8]/60"
                  >
                    <span className="text-xs font-bold text-[#004B87]">
                      Equipo de TI
                    </span>
                    <span className="mt-0.5 font-mono text-xs text-slate-600">
                      usuario: ti · clave: ti
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModo("interno");
                      setUsuario("ce");
                      setClave("ce");
                      setError("");
                    }}
                    className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-[#004B87] hover:bg-[#E8F1F8]/60"
                  >
                    <span className="text-xs font-bold text-[#007A53]">
                      Comité de ética
                    </span>
                    <span className="mt-0.5 font-mono text-xs text-slate-600">
                      usuario: ce · clave: ce
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModo("receptor");
                      setPersona({ tipo: "msp", id: "1720-2015-123456" });
                      setClaveTeclado("");
                      setError("");
                    }}
                    className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-[#004B87] hover:bg-[#E8F1F8]/60"
                  >
                    <span className="text-xs font-bold text-slate-800">
                      Doctor (MSP)
                    </span>
                    <span className="mt-0.5 font-mono text-xs text-slate-600">
                      1720-2015-123456 · clave: doc
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModo("receptor");
                      setPersona({ tipo: "iess", id: "IESS-0002" });
                      setClaveTeclado("");
                      setError("");
                    }}
                    className="flex flex-col items-start rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-[#004B87] hover:bg-[#E8F1F8]/60"
                  >
                    <span className="text-xs font-bold text-slate-800">
                      Personal IESS autorizado
                    </span>
                    <span className="mt-0.5 font-mono text-xs text-slate-600">
                      IESS-0002 · clave: iess
                    </span>
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Prototipo: las cuentas viven en el navegador y no son seguridad
                  real.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </div>
  );
}
