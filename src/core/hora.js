// Hora del día a partir de la fracción de día del reloj (acc 0..1). El día arranca a las 06:00. Sin DOM.
const DIA_INICIO = 6;

// { h, m, franja, texto, t }  t = fracción de la jornada 0..1 desde las 00:00
export function horaDe(acc = 0) {
  const a = Math.min(Math.max(acc, 0), 0.9999);
  const total = (DIA_INICIO + a * 24) % 24, h = Math.floor(total), m = Math.floor((total - h) * 60);
  const franja = h < 6 ? 'madrugada' : h < 12 ? 'mañana' : h < 20 ? 'tarde' : 'noche';
  return { h, m, franja, texto: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, t: total / 24 };
}

// Oscuridad 0 (pleno día) .. 1 (noche cerrada), con amanecer y atardecer suaves
export function noche(acc = 0) {
  const { h, m } = horaDe(acc), x = h + m / 60;
  if (x >= 7.5 && x <= 18.5) return 0;
  if (x < 5 || x > 21) return 1;
  const s = v => v * v * (3 - 2 * v);            // smoothstep
  return x < 7.5 ? 1 - s((x - 5) / 2.5) : s((x - 18.5) / 2.5);
}

// Faltan `dias` (fraccionarios) para algo: «3 d», «1 d 4 h», «5 h»
export function restante(dias) {
  const horas = Math.max(0, Math.ceil(dias * 24 - 1e-6));
  if (horas >= 48 || dias >= 2) return `${Math.ceil(dias - 1e-6)} d`;
  if (horas >= 24) { const h = horas - 24; return h ? `1 d ${h} h` : '1 d'; }
  return `${horas} h`;
}
