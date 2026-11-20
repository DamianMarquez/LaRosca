// Base electoral: perfil histórico de cada provincia en términos de partidos ficticios. Sin DOM.
// Las simulaciones de elecciones (F4) se apoyarán en esta estructura.

// Traduce {agrupación real: %} a {partido ficticio: %} según data/partidos.json
export function mapear(resultados, partidos) {
  const out = {};
  for (const [real, pct] of Object.entries(resultados)) {
    const p = partidos.find(p => p.equivale.some(f => real.toUpperCase().includes(f))) ?? partidos.find(p => p.id === 'otros');
    out[p.id] = +((out[p.id] ?? 0) + pct).toFixed(4);
  }
  return out;
}

// Perfil de una provincia: [{año, participacion, electores, partidos:{id:pct}, lider}] del más reciente al más antiguo
export function perfil(historicos, partidos, iso) {
  const d = historicos?.distritos?.[iso];
  if (!d) return [];
  return Object.keys(d).sort().reverse().map(año => {
    const e = d[año], pct = mapear(e.resultados, partidos);
    const lider = Object.entries(pct).filter(([id]) => id !== 'otros').sort((a, b) => b[1] - a[1])[0]?.[0];
    return { año, participacion: e.participacion, electores: e.electores, escrutinio: e.escrutinio, partidos: pct, lider };
  });
}

// Parte de los electores de una zona que votaría al partido del jugador según su control territorial.
// Provisorio: a control total del barrio, la mitad de sus electores.
export const MAX_VOTO_POR_CONTROL = 0.5;
export function intencionVoto(zonas, ratioElectores) {
  let potencial = 0, electores = 0;
  for (const z of zonas) {
    const e = z.pop * ratioElectores;
    electores += e;
    potencial += e * z.control * MAX_VOTO_POR_CONTROL;
  }
  return electores ? potencial / electores : 0;
}
