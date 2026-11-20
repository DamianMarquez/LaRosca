# La Rosca

Simulador político para navegador, de un jugador: empezás repartiendo volantes en un barrio de la capital de tu provincia y ganás zonas en un mapa, con el tiempo corriendo en vivo (pausa y velocidades). Web estática: sin backend, base de datos ni compilación.

## Ejecutar

Necesita un servidor estático (los módulos y los JSON no cargan desde `file://`):

```bash
python3 -m http.server 8765
```

Abrí http://localhost:8765. Para publicar (por ejemplo en Plesk) subí el contenido de la carpeta, sin `scripts/`, `docs/` ni `legacy/`.

## Guardar y recuperar la partida

- **Autoguardado:** se guarda solo en este navegador (`localStorage`) en cada cambio. Al volver, el mapa ofrece **Continuar**.
- **Exportar / Importar:** los botones de la barra superior descargan o cargan la partida como JSON (`schemaVersion` 3). El archivo importado se valida antes de usarse.
- **Nueva:** borra el guardado local.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/core/` | Simulación sin DOM: reloj, juego, misiones, eventos, electoral, guardado |
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

Duraciones, costos, alcances, probabilidades y exposición son valores provisionales de prototipo, en `data/game.json` y `data/eventos.json`.
