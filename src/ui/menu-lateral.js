// Menú lateral del procesamiento: se puede plegar y cambiar de ancho. Angosto, muestra solo íconos.
// maximo solo se usa mientras no se puede medir el contenido; margen es el aire a la derecha del texto más largo.
export const MENU = Object.freeze({ compacto: 68, umbral: 170, inicial: 240, maximo: 240, margen: 50, paso: 16 });
const CLAVE = 'iess.menu.v1';

// Por debajo del umbral el texto ya no cabe bien: el menú salta al ancho de solo íconos.
export function ajustarAncho(px, maximo = MENU.maximo) {
  const n = Math.round(Number(px));
  if (!Number.isFinite(n)) return Math.min(MENU.inicial, maximo);
  return n < MENU.umbral ? MENU.compacto : Math.min(maximo, n);
}

// Ancho máximo según el contenido: donde acaba el texto más largo, más el margen.
// El botón va centrado, así que solo necesita caber con su relleno.
export const limiteAncho = (finDelTexto, anchoBoton = 0) =>
  Math.max(MENU.umbral, Math.ceil(finDelTexto + MENU.margen), Math.ceil(anchoBoton + 30));

// Mide el contenido a su ancho natural, aunque el menú esté plegado. Devuelve null si no está a la vista.
function medirLimite(disposicion, reiniciar) {
  if (!disposicion.offsetParent || !globalThis.matchMedia?.('(min-width: 821px)').matches) return null;
  const compacto = disposicion.classList.contains('compacto');
  disposicion.classList.remove('compacto');
  disposicion.classList.add('midiendo');
  const nav = disposicion.querySelector('nav');
  const inicio = nav.getBoundingClientRect().left;
  const finales = [...nav.querySelectorAll('#menu a .texto-menu')].map(e => e.getBoundingClientRect().right - inicio);
  const boton = [...reiniciar.children].reduce((a, e) => a + e.getBoundingClientRect().width, 8);
  disposicion.classList.remove('midiendo');
  disposicion.classList.toggle('compacto', compacto);
  return finales.length ? limiteAncho(Math.max(...finales), boton) : null;
}

// Los íconos viven en iconos.js; se reexportan para no cambiar a quien ya los importa de aquí.
import { icono } from './iconos.js';
export { icono };

// El ancho elegido es una preferencia de este navegador; si no se puede guardar, todo sigue igual.
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) ?? {}; } catch { return {}; } };
const guardar = x => { try { localStorage.setItem(CLAVE, JSON.stringify(x)); } catch { /* sin almacenamiento */ } };

export function iniciarMenuLateral({ disposicion, plegar, tirador, reiniciar }) {
  const previo = leer();
  let maximo = MENU.maximo;
  let ancho = ajustarAncho(previo.ancho ?? MENU.inicial, Infinity);
  // Último ancho con texto: es el que vuelve al desplegar.
  let amplio = Math.max(MENU.umbral, ajustarAncho(previo.amplio ?? MENU.inicial, Infinity));

  const aplicar = (px, recordar = true) => {
    ancho = ajustarAncho(px, maximo);
    const compacto = ancho === MENU.compacto;
    if (!compacto) amplio = ancho;
    disposicion.style.setProperty('--ancho-menu', ancho + 'px');
    disposicion.classList.toggle('compacto', compacto);
    const texto = compacto ? 'Desplegar menú' : 'Plegar menú';
    plegar.setAttribute('aria-expanded', String(!compacto));
    plegar.setAttribute('aria-label', texto);
    plegar.title = texto;
    tirador.setAttribute('aria-valuemax', String(maximo));
    tirador.setAttribute('aria-valuenow', String(ancho));
    tirador.setAttribute('aria-valuetext', compacto ? 'Solo íconos' : `${ancho} píxeles`);
    if (recordar) guardar({ ancho, amplio });
  };

  plegar.prepend(icono('plegar'));
  reiniciar.prepend(icono('reiniciar'));
  tirador.setAttribute('aria-valuemin', String(MENU.compacto));
  plegar.addEventListener('click', () => aplicar(ancho === MENU.compacto ? amplio : MENU.compacto));

  // Arrastrar con ratón, dedo o lápiz.
  let arrastre = null;
  tirador.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    arrastre = { x: e.clientX, ancho };
    try { tirador.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
    disposicion.classList.add('arrastrando');
  });
  tirador.addEventListener('pointermove', e => { if (arrastre) aplicar(arrastre.ancho + e.clientX - arrastre.x, false); });
  const soltar = () => {
    if (!arrastre) return;
    arrastre = null;
    disposicion.classList.remove('arrastrando');
    guardar({ ancho, amplio });
  };
  tirador.addEventListener('pointerup', soltar);
  tirador.addEventListener('pointercancel', soltar);
  tirador.addEventListener('lostpointercapture', soltar);
  tirador.addEventListener('dblclick', () => aplicar(MENU.inicial));

  // Teclado: flechas, Inicio (solo íconos), Fin (máximo) y Enter (ancho original).
  tirador.addEventListener('keydown', e => {
    const destino = {
      ArrowLeft: ancho - MENU.paso < MENU.umbral ? MENU.compacto : ancho - MENU.paso,
      ArrowRight: ancho === MENU.compacto ? MENU.umbral : ancho + MENU.paso,
      Home: MENU.compacto, End: maximo, Enter: MENU.inicial,
    }[e.key];
    if (destino === undefined || e.altKey) return;
    e.preventDefault();
    aplicar(destino);
  });

  // El límite cambia con el texto (por ejemplo, los estados): se vuelve a medir tras pintar el menú.
  // Quien tenía el menú al máximo sigue al máximo; quien lo tenía más angosto lo conserva.
  let elegido = ancho;
  const recalcular = () => {
    const nuevo = medirLimite(disposicion, reiniciar);
    if (nuevo === null) return;
    const alMaximo = ancho !== MENU.compacto && (ancho >= maximo || elegido > nuevo);
    maximo = nuevo;
    aplicar(alMaximo ? maximo : ancho, false);
  };
  globalThis.addEventListener?.('resize', recalcular);

  aplicar(ancho, false);
  return { recalcular };
}
