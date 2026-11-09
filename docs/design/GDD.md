# La Rosca — Documento de diseño del juego

**Versión:** 0.2 · **Estado:** Concepto inicial

## 1. Visión

La Rosca es un juego político de simulación para navegador, de un jugador y ambientado en un país ficticio. El jugador funda un partido pequeño y empieza como un afiliado sin poder interno. A través de trabajo territorial, organización y decisiones políticas, busca construir una fuerza capaz de sostenerse y seguir creciendo.

La campaña no exige ganar una elección ni alcanzar el gobierno para considerarse completa. El foco está en desarrollar el partido, ampliar su presencia y decidir qué significa representar sus principios a medida que cambian sus circunstancias.

El tono es serio: las acciones y las decisiones políticas deben tener consecuencias comprensibles para el partido, sus miembros y su entorno. El diseño deja espacio para dilemas y desacuerdos sin asumir una única ideología correcta.

## 2. Fantasía y rol del jugador

El jugador es una de las personas que funda el partido, pero la fundación no le concede autoridad automática. El grupo comienza siendo pequeño y el protagonista ocupa el rango más bajo. Su influencia se gana con trabajo y resultados; debe convencer a otros miembros de que puede asumir responsabilidades mayores.

La organización interna y la expansión del partido son progresos relacionados, pero distintos. El jugador puede ascender mientras el partido gana afiliados y apoyo, aunque ninguna de las dos trayectorias sustituye a la otra.

## 3. Ciclo de juego

1. Revisar el estado del partido, sus necesidades y las misiones disponibles.
2. Elegir una misión y asignarla a la cola de acciones.
3. Dejar avanzar el tiempo simulado mientras la misión se lleva a cabo.
4. Resolver el resultado, aplicar sus consecuencias y mostrar un resumen al jugador.
5. Usar el nuevo estado del partido y el rango personal para decidir qué hacer después.

El tiempo avanza en semanas simuladas, con una agenda personal y una cola de acciones. Cada semana ofrece una cantidad limitada de bloques de tiempo para el jugador. Las responsabilidades de un rango alto ocupan parte de esa agenda, por lo que queda menos tiempo para realizar personalmente tareas de contacto directo. Las cantidades concretas de bloques y la duración de cada misión quedan pendientes de balance.

Al asignar una misión, el jugador puede realizarla personalmente o delegarla. La ejecución personal consume bloques de su agenda y ofrece contacto directo; la delegación consume capacidad de afiliados o equipos disponibles, y permite llegar a más lugares mientras el jugador atiende responsabilidades de coordinación. Una misión delegada depende de que existan miembros disponibles y adecuados. El jugador puede combinar ambos métodos en la misma semana.

Las misiones pueden ser breves, estándar o prolongadas según su alcance. La cola informa qué está en curso, quién la ejecuta y cuándo se resolverá. Al terminar, el juego presenta el resultado y actualiza la agenda, el partido y las opciones disponibles.

## 4. Rangos y cargos

El **rango** expresa la autoridad, el alcance de las decisiones y el nivel de responsabilidad del jugador dentro del partido. Es una progresión abierta: llegar a la conducción nacional no cierra la campaña y se podrán sumar etapas superiores más adelante. Los nombres y límites territoriales son provisionales.

| Etapa de rango | Responsabilidad y alcance | Perfil de misiones que empieza a habilitar |
| --- | --- | --- |
| Afiliado | Aprende la organización y colabora en tareas simples. | Reparto de volantes, reuniones y colaboración comunitaria. |
| Militante o activista | Sostiene actividades con regularidad y puede captar nuevos miembros. | Contacto vecinal, reclutamiento y apoyo en eventos. |
| Referente barrial (puntero) | Mantiene vínculos locales y moviliza contactos de una zona. | Visitas, relevamiento de necesidades y organización barrial. |
| Coordinador local | Ordena equipos y actividades en varias zonas cercanas. | Coordinación de voluntarios, actos locales y comunicación territorial. |
| Comunero o representante comunal | Representa al partido ante organizaciones e instituciones de su ámbito comunal. | Mesas vecinales, propuestas locales y negociación comunitaria. |
| Jefe seccional | Conduce la estructura de una sección y responde por sus equipos. | Planificación seccional, formación de cuadros y eventos de mayor escala. |
| Coordinador zonal o municipal | Armoniza varias secciones y distribuye recursos territoriales. | Campañas coordinadas, alianzas locales y resolución de conflictos internos. |
| Dirigente provincial | Define prioridades y organiza la presencia del partido en una provincia. | Giras, actos provinciales, acuerdos y desarrollo de propuestas regionales. |
| Integrante de la conducción nacional | Participa en decisiones y coordinación de alcance nacional. | Convenciones, estrategia nacional, comunicación pública y coordinación entre provincias. |
| Secretario general o presidente partidario | Ejerce la conducción ejecutiva nacional si la organización llega a esa etapa. | Dirección, negociación entre corrientes y respuesta a crisis nacionales. |

Los ascensos dependen del recorrido del jugador y del desarrollo alcanzado por el partido; no son una recompensa exclusiva por acumular misiones. En cada etapa, la responsabilidad interna aumenta y la agenda reserva más tiempo para coordinar, negociar y responder por otras personas. El jugador conserva la opción de hacer misiones de base, pero dispone de menos bloques personales para ellas.

Los **cargos** son funciones organizativas que pueden asignarse dentro del partido y que no equivalen a un rango. Un rango alto no implica automáticamente ser responsable de todas las áreas. Los cargos habilitan capacidades, decisiones y misiones de su especialidad:

| Cargo o área | Capacidad que habilita |
| --- | --- |
| Organización territorial | Abrir, coordinar y sostener equipos y sedes en nuevas zonas. |
| Organización interna | Reclutar, distribuir tareas, convocar reuniones y resolver problemas de coordinación. |
| Comunicación | Preparar boletines, mensajes públicos, prensa y campañas de difusión. |
| Formación y programa | Organizar talleres, elaborar propuestas y traducir principios en políticas. |
| Administración y finanzas | Gestionar recursos, presupuestos, materiales y rendición interna. |
| Campaña y alianzas | Planificar actos, coordinar movilizaciones, negociar apoyos y preparar campañas electorales. |

Los cargos no reemplazan los requisitos de rango ni el crecimiento del partido: una capacidad se habilita cuando coinciden la responsabilidad apropiada, el cargo pertinente y una organización con desarrollo suficiente. La composición de cargos, su duración y quién los asigna quedan por definir.

## 5. Crecimiento del partido

El partido tiene al menos dos grupos que cumplen funciones distintas:

- **Seguidores:** personas que apoyan al partido de forma intensa y constituyen una base estable de apoyo. Con el paso del tiempo, esa base puede traducirse en una presencia electoral potencial.
- **Afiliados:** miembros formales que participan en la organización. Su número puede aumentar o disminuir según las acciones, los resultados y la percepción del partido.

La cantidad de seguidores y afiliados no debe confundirse. Un partido puede tener una base de apoyo amplia con una organización pequeña, o contar con muchos afiliados cuya adhesión sea más variable. En esta primera versión no se fijan fórmulas de conversión, tasas de crecimiento ni magnitudes.

## 6. Misiones

Las misiones son acciones para construir presencia, organización, identidad pública y capacidad política. Cada una se desbloquea por una combinación de rango personal, desarrollo del partido y, cuando corresponde, un cargo funcional. El acceso puede ser personal o delegado. Una acción de alcance pequeño puede estar disponible temprano y seguir siendo útil en rangos altos, aunque compita por los bloques personales cada vez más escasos.

### Ficha de misión

Cada misión se define con estos elementos:

- **Propósito:** qué intenta lograr y a quién alcanza.
- **Desbloqueo:** rango mínimo, desarrollo organizativo requerido y cargo relacionado si aplica.
- **Duración:** breve, estándar o prolongada, en tiempo simulado.
- **Ejecución:** personal, delegada o ambas; indica si usa bloques del jugador, capacidad de afiliados o ambas.
- **Riesgo:** factores cualitativos que hacen más o menos probable el éxito, como dificultad, confianza local, preparación, recursos, experiencia del equipo y adecuación del cargo.
- **Resultado:** beneficios posibles en apoyo, afiliados, confianza, visibilidad, recursos, organización o influencia.
- **Fracaso:** costo recuperable y relacionado con la acción, por ejemplo tiempo, recursos, confianza o cohesión.

No se establecen porcentajes ni valores en esta versión. La posibilidad de éxito o fracaso debe ser visible antes de confirmar la misión, junto con los factores principales que la afectan. La delegación amplía el alcance y libera tiempo del jugador, pero su resultado depende de la capacidad, preparación y disponibilidad del equipo asignado.

### Catálogo inicial por etapa

Las etapas de partido de la tabla son cualitativas: **incipiente** (grupo fundador), **presencia local** (actividad sostenida en una comunidad), **organización multizona** (equipos en varias áreas) y **red provincial o nacional** (coordinación entre muchas secciones). No son umbrales numéricos.

| Área y etapa | Misión y propósito | Desbloqueo orientativo | Duración y ejecución | Riesgo principal | Éxito / costo recuperable si falla |
| --- | --- | --- | --- | --- | --- |
| Territorio · Incipiente | Repartir volantes para presentar el partido. | Afiliado; grupo incipiente. | Breve; personal o delegada. | Baja atención o mensaje poco claro. | Visibilidad y contactos / tiempo y materiales perdidos. |
| Territorio · Incipiente | Visitar vecinos y escuchar necesidades. | Afiliado; grupo incipiente. | Estándar; personal o delegada. | Desconfianza o mala selección de la zona. | Confianza e información local / tiempo y confianza desperdiciados. |
| Comunidad · Incipiente | Ayudar en una actividad o necesidad comunitaria. | Afiliado; grupo incipiente. | Estándar; personal o delegada. | Recursos insuficientes o necesidad mal entendida. | Vínculos y confianza / recursos gastados sin resolver la necesidad. |
| Comunicación · Incipiente | Hacer pintadas y señalizar presencia partidaria. | Afiliado; grupo incipiente; comunicación si se delega a un equipo. | Breve; personal o delegada. | Mala ubicación, poca preparación o rechazo vecinal. | Visibilidad / materiales perdidos y daño a la imagen local. |
| Organización · Incipiente | Convocar una reunión abierta de presentación. | Activista; presencia local inicial. | Estándar; personal o delegada. | Convocatoria débil o falta de seguimiento. | Nuevos contactos y afiliaciones / tiempo y confianza desperdiciados. |
| Organización · Presencia local | Reclutar voluntarios para una zona. | Referente barrial; presencia local. | Estándar; personal o delegada. | Desinterés o promesas organizativas incumplidas. | Más capacidad de equipo / tiempo y reputación perdidos. |
| Territorio · Presencia local | Relevar necesidades y prioridades del barrio. | Referente barrial; presencia local. | Estándar; personal o delegada. | Muestra limitada o lectura equivocada. | Información y confianza / esfuerzo con información poco útil. |
| Comunidad · Presencia local | Coordinar una jornada comunitaria con vecinos. | Coordinador local; presencia local; organización territorial o interna. | Prolongada; ambas vías. | Coordinación débil o expectativas incumplidas. | Confianza y vínculos duraderos / recursos y credibilidad comprometidos. |
| Acción pública · Presencia local | Participar en una marcha o acto público. | Activista; convocatoria o evento disponible. | Estándar; personal o delegada. | Baja participación o recepción desfavorable. | Visibilidad y contactos / tiempo y recursos de traslado perdidos. |
| Comunicación · Presencia local | Publicar un boletín o comunicado local. | Coordinador local; presencia local; comunicación. | Breve; personal o delegada. | Mensaje confuso o mal recibido. | Visibilidad y claridad pública / confianza o credibilidad dañadas. |
| Formación · Organización multizona | Organizar un taller de formación política. | Jefe seccional; organización multizona; formación y programa. | Prolongada; ambas vías. | Contenido poco pertinente o baja asistencia. | Miembros preparados y cohesión / tiempo de formadores y asistentes perdido. |
| Programa · Organización multizona | Elaborar una propuesta para un problema comunal. | Comunero; presencia local sostenida; formación y programa. | Prolongada; personal o delegada. | Diagnóstico débil o propuesta desconectada de la comunidad. | Influencia y confianza / recursos y credibilidad perdidos. |
| Organización · Organización multizona | Resolver una disputa interna entre equipos. | Jefe seccional; organización multizona; organización interna. | Estándar; personal. | Falta de legitimidad o agravio a una de las partes. | Cohesión y continuidad / conflicto prolongado y pérdida de confianza. |
| Administración · Organización multizona | Preparar presupuesto y rendición de una actividad. | Jefe seccional; organización multizona; administración y finanzas. | Estándar; personal o delegada. | Costos imprevistos o registros incompletos. | Control y recursos mejor organizados / gastos y confianza interna afectados. |
| Alianzas · Red provincial o nacional | Negociar una alianza con una organización afín. | Dirigente provincial; red provincial; campaña y alianzas. | Prolongada; personal. | Diferencias de principios o términos poco claros. | Alcance y cooperación / confianza entre organizaciones dañada. |
| Campaña · Red provincial o nacional | Coordinar un acto en varias secciones. | Dirigente provincial; red provincial; campaña y alianzas. | Prolongada; delegada o ambas vías. | Equipos descoordinados, logística débil o convocatoria baja. | Alcance público y coordinación / recursos y credibilidad perdidos. |
| Comunicación · Red provincial o nacional | Dar una entrevista o responder a una crisis pública. | Conducción provincial o nacional; red amplia; comunicación. | Estándar; personal. | Preparación insuficiente o contradicción con los principios. | Claridad e influencia pública / confianza y reputación afectadas. |
| Campaña y programa · Red provincial o nacional | Organizar una convención para acordar prioridades y propuestas. | Conducción nacional; red provincial o nacional; formación y programa, u organización interna. | Prolongada; delegada o ambas vías. | Desacuerdos no resueltos o acuerdos poco representativos. | Dirección compartida y nuevas propuestas / cohesión y tiempo organizativo comprometidos. |

El catálogo es una base para ampliar. No todas las misiones tienen que ser electorales; las de campaña también sirven para construir acuerdos, presencia y capacidad organizativa. La escala nacional aumenta coordinación e influencia, pero reduce el tiempo disponible para que el jugador haga personalmente una visita, volanteada o actividad barrial.

## 7. Fundación y principios

Al fundar el partido, el jugador elige sus principios de un catálogo. Esos principios forman la identidad fundacional del partido y se consideran irrompibles: no se borran cuando cambia la estrategia o la conducción.

Durante la campaña, el jugador puede proponer nuevas interpretaciones de las bases. La reinterpretación modifica cómo el partido entiende o aplica un principio, pero conserva un vínculo reconocible con su formulación original. Esto permite que aparezcan tensiones entre tradición, estrategia y circunstancias sin reemplazar silenciosamente la identidad inicial.

El catálogo puede incluir principios de distinta amplitud, por ejemplo:

- **Principio amplio:** «Haremos cosas por el país».
- **Principio específico:** «Eliminaremos a los ladrones habilitando la pena capital en el país».

La diferencia de especificidad ofrece distintos grados de libertad interpretativa. El juego todavía debe definir cómo se presentan las reinterpretaciones, quién puede proponerlas y qué efectos tienen sobre seguidores, afiliados y misiones. Las formulaciones del catálogo son material de diseño y podrán revisarse.

## 8. Alcance de esta versión

Este GDD define una progresión inicial abierta de rangos, seis áreas funcionales de cargos, una agenda semanal basada en bloques de tiempo y un catálogo de misiones con desbloqueos y consecuencias cualitativas. No fija cantidades de bloques, duraciones exactas, probabilidades, fórmulas de riesgo, umbrales de crecimiento, presupuestos ni condiciones de derrota; esos valores se especificarán durante el diseño y el balance.

## 9. Glosario inicial

- **Partido:** organización política fundada y desarrollada durante la partida.
- **Rango:** nivel de autoridad y responsabilidad del jugador dentro del partido.
- **Cargo:** función organizativa que habilita capacidades y misiones de un área.
- **Misión:** acción asignada a la agenda o cola, resuelta después de un tiempo simulado.
- **Bloque de tiempo:** unidad abstracta de disponibilidad semanal del jugador.
- **Delegación:** ejecución de una misión mediante afiliados o equipos del partido.
- **Seguidor:** simpatizante de apoyo intenso que integra la base del partido.
- **Afiliado:** miembro formal cuya participación puede cambiar durante la campaña.
- **Principio:** base de identidad elegida al fundar el partido; su formulación permanece, aunque pueda reinterpretarse.
