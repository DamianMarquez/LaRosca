// Íconos propios (trazo simple, un solo estilo) para no depender de los emoji de cada sistema.
const P = {
  dinero: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M9 9.3c0-1 1.2-1.8 3-1.8s3 .8 3 1.9-1.2 1.5-3 2-3 .9-3 2 1.2 1.9 3 1.9 3-.8 3-1.8"/>',
  negro: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4l16 16"/>',
  alerta: '<path d="M12 3.5l10 17.5H2L12 3.5z"/><path d="M12 10v5M12 18.2v.01"/>',
  afiliados: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16.5c.6-1.5 1.8-2.2 3.2-2.2s2.6.7 3.2 2.2M14.5 10h4M14.5 13.5h3"/>',
  seguidores: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.2" cy="9" r="2.4"/><path d="M16.2 14.2c2.7.3 4.8 2.4 4.8 5.8"/>',
  voto: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 12.2l3 3 5-6"/>',
  rango: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2l-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  objetivo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r=".8"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.6a2.6 2.6 0 015.1.6c0 1.6-2.6 2-2.6 3.6M12 17.3v.01"/>',
  mas: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  persona: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  equipo: '<path d="M7 12l3-3 3 2 4-4M5 17l3 3 4-4 3 2 4-4"/>',
  flecha: '<path d="M9 5l7 7-7 7"/>',
};
export const ico = (nombre, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] ?? ''}</svg>`;
