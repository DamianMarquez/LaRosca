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
- **El juego se va abriendo (modo progresivo):** una partida nueva arranca con lo mínimo (mapa, dos misiones, dinero y afiliados) y todo lo demás se revela solo a medida que crecés: más misiones, Yo y el registro (tras la primera misión), Rivales, Recaudación, Datos y finanzas, la leyenda de control, Partido, estructura y delegación, pactos, dinero ilegal, Elecciones y, al fundar, cada sección de Organización. Cada apertura se anuncia con una tarjeta que pausa el juego (con «Mostrame») y deja una marca «Nuevo» donde apareció. Lo revelado nunca se vuelve a ocultar; en el menú Partida se puede apagar el modo progresivo para ver todo. Las partidas guardadas antes se ven completas.
- **Centro de ayuda (?):** Cómo se juega, Tu primer mes (checklist que se tilda sola), Progreso (la hoja de ruta con lo abierto y lo que falta), Conceptos y Glosario/atajos; además un recorrido guiado de primer uso (repetible) y una mini-guía la primera vez que entrás a cada solapa. La franja «Ahora» muestra lo próximo en abrirse.
- **Dos formas de empezar:** **Sumarte** a uno de los 5 partidos existentes (entrás de afiliado, con superior, línea partidaria y escalafón; ese partido deja de ser rival y arrastra su voto histórico) o **Fundar** uno propio. Quien funda **no tiene superiores** y elige su origen: **figura pública** (fama y contactos desde el día 1, voto de opinión sin territorio, pero sin estructura ni fiscales: el caso extremo), **desde abajo** (casi invisible, lento, con acuerdos) o **desprendimiento** de un partido (arrancás con cuadros, algunos barrios y concejales, y un enemigo directo).
- **Organización (solo al fundar):** estado legal del partido (idea → agrupación → personería → reconocimiento de distrito → provincial → nacional) con requisitos y trámites que tardan; autoridades con nombre (apoderado, tesorería, fiscalización…) que se delegan; comités barriales; notoriedad y agenda mediática; **acuerdos de cupos en listas ajenas** con bloque y ruptura; fondo partidario permanente y rendición de cuentas anual. Tu influencia no se «pide»: se deriva del estado legal, la fama y las bancas.
- **Elecciones cada 2 años:** alternan legislativas (2025, 2029…) y ejecutivas (2027, 2031…). Proceso con convocatoria, alianzas y frentes, cierre de listas, PASO, campaña (con encuestas), veda, votación, balotaje presidencial y asunción. Se disputan Concejo e intendente (la capital que jugás, barrio por barrio), legislatura y gobernación, diputados, senadores y presidente (el resto del país se modela por distrito con la historia electoral real). Bancas por D'Hondt con piso del 3 % del padrón. Los cargos ganados dan dietas y alcance; si un electo se va, se lleva la banca. Hay una solapa **Elecciones** y una cuenta regresiva en la barra superior.
- **Solapas generales:** arriba elegís **Mapa · Partido · Yo**. Mapa conserva el panel lateral (Zona, Rivales, Datos); Partido y Yo ocupan toda la pantalla. En Partido ves Resumen, Organigrama (conducción → vos → cargos → referentes → militantes), Personas (lista ordenable con riesgo de irse), Escalafón, Línea y Principios, y cada persona tiene su ficha.
- **Pausa al terminar:** cuando termina una misión o un descanso, el juego se pausa y aparece una tarjeta con el resultado y qué cambió. «Continuar» (o Espacio) retoma la velocidad anterior. Se puede desactivar en Partida → «Pausar con avisos».
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
| `src/core/` | Simulación sin DOM: reloj, juego, economía, plantel, escalafón, rivales, pactos, línea partidaria, eventos, electoral, elecciones, guardado |
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

Duraciones, costos, alcances, probabilidades, gastos y requisitos de ascenso son valores provisionales de prototipo, en `data/*.json` (`game`, `economia`, `trasfondos`, `plantel`, `escalafon`, `rivales`, `pactos`, `linea`, `eventos`, `organizacion`, `origenes`, `elecciones`, `revelado`, `ayuda`).


## Creación del personaje y fama
- **Profesión** (12: docente, abogado, periodista, estudiante de economía…): da habilidades iniciales, fama, fortalezas y puntos débiles (`data/trasfondos.json`). **Puntos libres** (3) para repartir; **estilo público**: figura (más fama y exposición), equilibrado o militante (más confianza y afiliación, menos fama).
- **Fama** (`g.fama`) vale para fundadores y afiliados. Se gana con acciones visibles, entrevistas y debates.

## Avance por objetivos
Nada se abre por pasar los días: cada elemento de `data/revelado.json` se destraba por hechos (misiones, afiliados, fama, control, rivalidad, fases del calendario electoral). Lo mismo valen `requiere` en misiones y `cuando` en eventos. Una partida inactiva no abre casi nada. «Próximo en abrirse» explica qué falta.

## Modalidades y medios
- Las misiones tienen **modalidades** (casa por casa o esquina masiva, pintada con permiso o clandestina, reunión en casa o en la plaza…): cambian éxito, alcance, tiempo, fama y exposición (`missions[].modalidades`).
- **Medios** (`src/core/medios.js`, `data/medios.json`): con fama llegan invitaciones a entrevistas y debates, y los rivales te arman emboscadas. Cada decisión es un chequeo de habilidad + perfil (profesión) + estilo, entre 5 y 95%.

## Ideología y atención
Cada principio ubica en 4 ejes (Estado/mercado, federal/unitario, orden/libertades, cambio/tradición; `data/principios.json`). La distancia con cada rival (`src/core/ideologia.js`, `data/ideologia.json`) marca **opuestos naturales** y **afines**: cambia su hostilidad, la relación inicial y con quién se alían en la Mesa. Tu **atención** crece con la fama y con ayudar a la comunidad, y atrae golpes.

## Ritmo del modo progresivo
Las capas se abren escalonadas (primera misión → Yo ~día 7 → Rivales ~día 14-21 → Recaudación ~día 28 → Fin de mes → Presencia ~día 35 → Partido ~día 45 → Estructura ~día 75 → Pactos ~día 100 → Dinero ilegal ~día 120 → Elecciones desde ~día 90). Hay un cooldown de 7 días entre avisos mayores (`cooldownDias` en `data/revelado.json`). En los primeros 60 días aparecen *encuentros de barrio* (eventos con `encuentro: true` en `data/eventos.json`) que anticipan cada mecánica. Botones: principal dorado, secundario gris azulado, ghost de texto, `danger` y `negro` (variables en `:root`).

## Horas, calendario, ofensivas y mesa de alianzas
- **Horas del día:** el reloj muestra hora y franja con un arco de sol (`src/core/hora.js`); el mapa se oscurece de noche (`#luz`). Es solo visual.
- **Calendario anual** (`data/calendario.json`, `src/core/calendario.js`, vista Calendario): elecciones (derivadas de `data/elecciones.json`), fechas institucionales, feriados con oportunidad de acto (ventanas con bono a ciertas misiones) y hitos del partido. Se abre ~día 40 en modo progresivo.
- **Ofensivas** (`data/ofensivas.json`, `src/core/ofensivas.js`): «Atacar…» desde la ficha del rival o el barrio. Sabotaje, desprestigio (con rebote), robar un cuadro y medios/debates. Cada golpe sube el **rencor** del rival, que lo vuelve más agresivo y puede romper pactos. Se abre ~día 60.
- **Mesa de armado** (`data/elecciones.json` → `mesa`, `src/core/mesa.js`, Elecciones): ofertas de frente, cupo o apoyo con respuesta en días, contraofertas, acuerdos que pueden romperse hasta el cierre de listas y alianzas entre los demás partidos. Reemplaza la tirada única de frentes y cupos.

## Movilidad

Moverte entre barrios lleva tiempo y un pasaje simbólico. Tenés una **casa** (arranca en el Centro; podés mudarte desde la ficha del barrio donde estés). Al lanzar una acción **personal** en otra zona, tu figura sale de donde estás, recorre el mapa (marcador con el ícono del medio, rastro, destino y una etiqueta con el tiempo restante y la hora de llegada) y la acción **arranca al llegar**. Cuando termina, **volvés a casa automáticamente** y esa vuelta ocupa tu acción hasta que llegues. El equipo (acciones delegadas) no viaja. La ida se puede cancelar; la vuelta no.

- **Medios** (`data/movilidad.json`): a pie, bici, colectivo, remis, moto y auto propio, con velocidad, espera, desgaste y tarifas bajas con tope por tramo. El viaje (ida + vuelta) cuesta siempre mucho menos que la acción: además del tope, nunca supera el 40% de lo que cuesta la acción. Si no elegís medio, se usa el más rápido que no salga caro; podés fijar uno preferido en «Yo → Movilidad» o elegir en cada zona.
- **Rama de mejoras:** bici → abono → app de remises → carnet → moto → auto → chofer de campaña → flota partidaria.
- **Ritmo:** `escalaViaje` (×8) dilata las horas reales para que el viaje se vea en pantalla; `rodeo` alarga las distancias rectas. Los kilómetros salen del área real de los barrios.
- **Día y noche:** en el menú Partida, «Simular día y noche: no» deja el mapa siempre iluminado (las horas siguen pasando).
- **Hacia lo nacional:** cada medio declara su `alcance`; micro, tren y avión ya están en los datos, bloqueados hasta que exista el mapa interurbano.
- En modo progresivo, el panel de mejoras se abre hacia el día 30 (`yo.movilidad`).
