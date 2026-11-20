# Fuentes de datos

| Archivo | Contenido | Origen |
|---|---|---|
| `indec-c2022_tp_est_c1.xlsx` | Población por jurisdicción 2010 y 2022 (**resultados definitivos**, total país 45.892.285) | INDEC, Censo 2022, Cuadro 1: https://www.indec.gob.ar/ftp/cuadros/poblacion/c2022_tp_est_c1.xlsx |
| `electores-2025.csv` | Electores habilitados por distrito, elecciones legislativas 26/10/2025 | Cifras citadas por canal26.com (29/09/2025) como CNE/DINE. **No es el archivo oficial**: se debe contrastar con la Cámara Nacional Electoral. |
| `dine-2019-presidente-definitivo-x-distrito.xlsx` | Presidente y Vice, generales 2019, **escrutinio definitivo** por distrito | DINE: https://www.argentina.gob.ar/sites/default/files/p.v._definitivo_x_distrito_grales_2019.xlsx |
| *(no se guarda, ~1 GB descomprimido)* | Generales 2023, **escrutinio provisorio** a nivel mesa, 1ª vuelta | DINE: https://www.argentina.gob.ar/sites/default/files/2023_generales_1.zip (28 MB). Se agrega con `scripts/build-resultados-historicos.py <ResultadoElectorales_2023_Generales.csv>` |

`data/resultados-historicos.json` contiene el resultado agregado por provincia (porcentaje de votos positivos por agrupación, agrupaciones <1% en "OTROS", electores y participación). Validado: ponderado por provincia reproduce el resultado nacional oficial (2019: FdT 48,2 / JxC 40,3; 2023: UxP 36,7 / LLA 30,0 / JxC 23,8).

## Advertencias
- Resultados 2023 son **provisorios** (no definitivos) y solo de la primera vuelta; falta el balotaje 2023 y las legislativas 2025 (no encontré archivo oficial). Los electores 2023 suman 35.410.080.
- Las agrupaciones son reales; en el juego se mapearán a partidos ficticios.
- La suma de los 24 distritos de `electores-2025.csv` es 35.771.647; con los 490.726 electores del exterior da 36.262.373, pero la fuente declara un total de 36.477.204 (diferencia 214.831 sin explicar). Otras notas de prensa dan 35.987.634. Tratar las cifras como aproximadas hasta verificar con la CNE.
- Córdoba figura redondeada (3.084.000) en la fuente.
- Regenerar con: `python3 -I scripts/build-provincias-datos.py` (requiere `openpyxl`).
