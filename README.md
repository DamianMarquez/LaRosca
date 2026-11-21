# La Rosca

Simulador político para navegador, de un jugador: empezás repartiendo volantes en un barrio de la capital de tu provincia y ganás zonas en un mapa, con el tiempo corriendo en vivo (pausa y velocidades). Web estática: sin backend, base de datos ni compilación.

## Ejecutar

Necesita un servidor estático (los módulos y los JSON no cargan desde `file://`):

```bash
python3 -m http.server 8765
```

Abrí http://localhost:8765. Para publicar (por ejemplo en Plesk) subí el contenido de la carpeta, sin `scripts/`, `docs/` ni `legacy/`.

## Cómo se avanza

- **Fundás el partido** con un nombre, 3 principios y un trasfondo (de qué vivís), que define tus ingresos y tu tiempo libre.
- **Territorio:** lanzás misiones en los barrios de la capital (una acción personal a la vez). Más control en un barrio = más seguidores y afiliados.
- **Plata:** cada mes se liquidan ingresos (tu aporte, cuotas de afiliados, recaudaciones) y gastos fijos (materiales, sede, viáticos). Recaudar es legal (colectas, rifas, cenas) o ilegal (coimas, comisiones, desvíos: en negro, con exposición y deudas de favor).
- **Jerarquía:** solo administrás lo que está por debajo de tu rango; lo de arriba es de la conducción. Cada cargo bajo tu mando (Territorial, Interna, Comunicación, Finanzas, Formación, Campaña) lo manejás vos (rinde según tu habilidad, pero suma carga de tiempo y desgaste) o lo delegás en un subordinado (rinde según su capacidad y depende de su lealtad; cobra viáticos). Si delegás el Territorial, el coordinador cubre solo los referentes de barrio. Al fundar no se define ningún rol. Si alguien se baja o se pasa a un rival, queda una vacante en lo delegado.
- **Escalafón:** para ascender hay que cumplir varios requisitos a la vez (experiencia, afiliados, barrios con control, relación con tu líder y un puesto vacante). Se pide desde Partido.
- **Rivales:** cada partido hace una acción a la vez, te puede quitar terreno, captar cuadros o bloquear misiones. Podés pactar con ellos (no agresión, apoyo en un barrio, favores), con riesgo de traición.

## Interfaz

- **Modo Rápido / Detallado** (barra superior o tecla `M`): Rápido muestra lo esencial; Detallado, todos los números y explicaciones. Es una preferencia del navegador, no de la partida.
- **«Ahora»:** una franja con lo más importante del momento (vacante, ascenso listo, golpe rival, números rojos). Tocala para ir directo.
- **Tooltips:** pasá el mouse o enfocá con `Tab` cualquier dato subrayado. El botón `?` abre el glosario completo.
- **Atajos:** `Espacio` pausa, `0 1 2 3` velocidades, `Z R P Y D` pestañas, `M` modo, `?` ayuda, `Esc` cierra.

## Tu personaje

- **Habilidades** (Oratoria, Organización, Calle, Negociación, Finanzas): se entrenan haciendo misiones afines y mejoran con los puntos que ganás al ascender.
- **Familia y trabajo:** tu situación familiar y laboral cambian tu tiempo, tus gastos y cuánto te duele un escándalo. Podés reducir jornada o dejar el trabajo, con consecuencias.
- **Desgaste:** sube mientras estás ocupado y baja descansando. Alto, resta éxito; muy alto, provoca una crisis. Pestaña **Yo**.

## Guardar y recuperar la partida

- **Autoguardado:** se guarda solo en este navegador (`localStorage`) en cada cambio. Al volver, el mapa ofrece **Continuar**.
- **Exportar / Importar:** los botones de la barra superior descargan o cargan la partida como JSON (`schemaVersion` 4). El archivo importado se valida antes de usarse.
- **Nueva:** borra el guardado local.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/core/` | Simulación sin DOM: reloj, juego, economía, plantel, escalafón, rivales, pactos, línea partidaria, eventos, electoral, guardado |
| `src/map/`, `src/ui/` | Mapa SVG con zoom y arrastre, panel, modales y estilos |
| `data/` | Configuración y datos: misiones, rangos, eventos, partidos ficticios, datos reales |
| `scripts/` | Generadores de datos (ver abajo). No se usan en el juego |
| `docs/design/` | GDD y mecánicas |
| `legacy/` | Prototipo anterior por turnos (referencia) |

## Datos reales

Las fuentes, licencias y advertencias están en [`data/fuentes/README.md`](data/fuentes/README.md). Resumen:

- **Provincias:** población INDEC Censo 2022 (definitivo), electores 2025 (de prensa; falta contrastar con la CNE).
- **Ciudades:** barrios de OpenStreetMap (ODbL) más fracciones censales; población por radio censal (INDEC / CONICET, CC-BY-4.0).
- **Resultados históricos:** presidenciales 2019 (definitivo) y 2023 (provisorio, 1ª vuelta), DINE. En el juego las agrupaciones reales se reemplazan por partidos ficticios (`data/partidos.json`).

Los scripts que los generan son `scripts/build-*.{mjs,py}`; algunos requieren descargar archivos grandes fuera del repo.

## Balance

Duraciones, costos, alcances, probabilidades, gastos y requisitos de ascenso son valores provisionales de prototipo, en `data/*.json` (`game`, `economia`, `trasfondos`, `plantel`, `escalafon`, `rivales`, `pactos`, `linea`, `eventos`).
