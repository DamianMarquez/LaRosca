# La Rosca — Mecánicas económicas y políticas

**Versión:** 0.1 · **Estado:** Propuesta inicial

## 1. Propósito y alcance

Este documento desarrolla las reglas de recursos que conectan las misiones con el crecimiento del personaje y del partido. Complementa el GDD: allí se describen la visión, los rangos y el catálogo de misiones; aquí se define qué puede gastar, ganar o arriesgar cada actor.

La oposición se considera como una futura extensión del modelo. Esta versión no simula sus recursos ni sus decisiones, y no fija cantidades, porcentajes, fórmulas de crecimiento o balance.

## 2. Dos niveles de estado

El juego mantiene una cuenta del partido y otra del personaje. Las cuentas son independientes: el jugador puede aportar dinero propio al partido, pero no retirar o gastar fondos partidarios como si fueran personales.

| Recurso | Partido | Personaje |
| --- | --- | --- |
| Dinero blanco | Fondos declarados disponibles para la organización. | Fondos personales declarados. |
| Dinero negro | Fondos partidarios no registrados o de origen opaco. | Fondos personales no registrados o de origen opaco. |
| Capital político | Influencia colectiva para movilizar, negociar y sostener decisiones. | Influencia propia, relaciones y capacidad de conseguir apoyo. |
| Afiliados | Miembros formales de toda la organización. | Afiliados vinculados personalmente al jugador, como su equipo o red de confianza. |
| Seguidores | Base de apoyo intenso asociada al partido. | Personas que apoyan al jugador y pueden acompañar su trayectoria política. |
| Intención de voto | Estimación cambiante del apoyo electoral al partido. | No aplica como reserva personal; la red personal puede influirla, pero no equivale a votos propios. |

Los afiliados y seguidores personales son subconjuntos de las cantidades del partido mientras el personaje pertenece a él. No se suman dos veces. El partido puede tener miembros y seguidores que no están vinculados personalmente al protagonista.

La intención de voto estima qué proporción de personas elegiría al partido si hubiera una elección en ese momento. No es el resultado de una elección ni se convierte automáticamente en votos emitidos. Su simulación puede incorporar elecciones en una etapa posterior.

## 3. Dinero blanco y dinero negro

Ambas clases de dinero son recursos distintos y no se convierten automáticamente entre sí.

- **Dinero blanco:** fondos transparentes y registrables. Sirven para gastos organizativos y públicos, y permiten rendir cuentas. Algunas misiones formales pueden requerir que sus costos se paguen con esta cuenta.
- **Dinero negro:** fondos opacos, más flexibles y difíciles de registrar. Pueden cubrir gastos que no admiten una rendición clara, pero su uso aumenta la exposición a escándalos, pérdidas, chantajes o daño de confianza si la operación sale mal o queda expuesta.

El dinero negro no garantiza una misión exitosa ni es siempre más eficaz. Su riesgo depende de quién participa, el alcance de la actividad, la discreción, la preparación y la posibilidad de que se conozca su origen. Una misión puede no aceptar este recurso si el gasto debe ser público y trazable.

El personaje puede transferir fondos personales al partido mediante un aporte explícito. La transferencia reduce la cuenta personal y aumenta la cuenta partidaria del mismo tipo. El origen no cambia: el dinero negro aportado sigue siendo dinero negro. Los fondos partidarios permanecen en el partido cuando el jugador se va.

## 4. Capital político

El capital político representa capacidad de influencia, más allá del dinero. Existe en los dos niveles:

- El **capital del partido** refleja su capacidad colectiva para convocar, negociar, coordinar a sus miembros y sostener acuerdos.
- El **capital personal** refleja la reputación, las relaciones y la capacidad del personaje para convencer a otros y conseguir responsabilidades.

Las misiones pueden consumir capital político para facilitar una negociación, movilización o decisión difícil. También pueden generarlo al demostrar capacidad, resolver problemas o ganar confianza. Un fracaso puede reducirlo si debilita la credibilidad o deja compromisos sin cumplir.

El capital personal no reemplaza al rango: puede ayudar a obtener responsabilidades, pero los ascensos también dependen del desarrollo del partido y de la trayectoria del personaje. El capital partidario no se transfiere a la cuenta personal.

## 5. Cómo se resuelve una misión

Antes de iniciarla, cada misión muestra sus costos y los recursos que puede afectar. La resolución sigue este flujo:

1. **Comprobar requisitos:** rango, desarrollo del partido, cargo funcional, equipo y recursos disponibles.
2. **Elegir ejecución:** personal, delegada o mixta, si la misión lo permite.
3. **Reservar costos:** bloques de agenda personal, capacidad de afiliados y dinero o capital político de las cuentas indicadas.
4. **Evaluar el riesgo:** dificultad, preparación, confianza local, recursos, experiencia del equipo, alcance y exposición del dinero negro.
5. **Resolver:** éxito o fracaso, sin probabilidades numéricas en esta versión.
6. **Aplicar efectos:** actualizar por separado el estado del personaje y el del partido, registrar las consecuencias y liberar capacidad reservada.

Si falta un recurso obligatorio, la misión no se inicia. Si falla, el costo ya comprometido puede perderse; además se aplican las consecuencias recuperables definidas para esa misión. Un resultado adverso no debe eliminar automáticamente al personaje ni terminar la campaña.

### Ficha mecánica

Cada misión debe especificar:

- **Objetivo y desbloqueo:** qué busca lograr y qué rango, desarrollo o cargo la habilita.
- **Ejecución y duración:** quién la realiza, cuánto tiempo simulado requiere y qué capacidad ocupa.
- **Costos:** cuenta exacta que paga cada gasto, más cualquier capital político, afiliados o bloques requeridos.
- **Factores de riesgo:** condiciones que favorecen o dificultan el resultado, incluidas la exposición y la confianza.
- **Efectos de éxito:** cambios posibles en recursos personales y partidarios.
- **Efectos de fracaso:** costos perdidos, daños recuperables y posibles eventos posteriores.

Una misión puede afectar a ambos niveles, pero el GDD debe indicar a quién pertenece cada cambio. Completar personalmente una actividad puede generar reconocimiento para el jugador además del beneficio partidario; delegarla puede ampliar la operación a cambio de depender más del equipo y de su preparación.

## 6. Ejemplos de conexión entre misiones y recursos

Los efectos de esta tabla son posibilidades de diseño, no garantías ni cantidades fijas.

| Misión | Costos posibles | Éxito posible | Fracaso posible |
| --- | --- | --- | --- |
| Repartir volantes | Dinero blanco del partido o aporte personal; tiempo propio o capacidad de afiliados. | El partido gana visibilidad y mejora su intención de voto; el jugador suma contactos y seguidores personales. | Se pierden materiales y tiempo; si el mensaje fue mal recibido, baja la confianza local o el capital personal. |
| Ayudar a la comunidad | Dinero blanco para materiales y capacidad de afiliados; el jugador puede dedicar tiempo personal. | Aumentan la confianza y los seguidores del partido; el jugador puede sumar afiliados vinculados a su equipo y capital político personal. | Se pierden recursos sin resolver la necesidad; una mala coordinación puede dañar confianza partidaria y personal. |
| Participar en una marcha | Dinero blanco para logística, bloques personales o equipo delegado; capital partidario si requiere coordinación amplia. | Aumentan la visibilidad, los seguidores y la intención de voto; la participación exitosa puede elevar el capital político de ambas cuentas. | La baja convocatoria consume recursos y puede debilitar la credibilidad del equipo o la capacidad de movilización del partido. |
| Negociar una alianza | Tiempo personal, capital político personal y, si corresponde, dinero blanco para preparar la actividad. | El partido obtiene alcance, cooperación o capacidad de convocatoria; el jugador gana influencia por conducir el acuerdo. | Se gastan tiempo y capital; un acuerdo mal planteado puede afectar la confianza entre organizaciones o dentro del partido. |

El **dinero negro** podría cubrir gastos de misiones que admitan costos opacos, pero debe aparecer explícitamente como opción con su riesgo asociado. El jugador debe poder comparar antes de confirmar una misión qué cuenta se utilizará y qué recursos podrían cambiar.

## 7. Cambiar de partido

El personaje puede cambiar de partido durante la campaña por motivos que surjan del juego, como desacuerdos sobre principios o estrategia, una crisis interna, falta de oportunidades o una invitación de otra organización. El cambio se trata como una transición política y social, no como un reinicio del personaje.

| Se conserva con el personaje | Permanece en el partido anterior |
| --- | --- |
| Dinero blanco y negro personales. | Dinero blanco y negro partidarios. |
| Capital político personal y experiencia acumulada. | Capital político partidario. |
| Seguidores y afiliados vinculados personalmente al jugador. | Afiliados y seguidores no vinculados personalmente al jugador. |
| Trayectoria y elegibilidad para un rango equivalente en el partido nuevo. | Cargos, responsabilidades y capacidades institucionales. |

Al salir, las redes personales dejan de contar dentro de los totales del partido anterior y pasan a asociarse al nuevo partido cuando el jugador se incorpora. De este modo no se duplican. No todo el apoyo personal se transforma en intención de voto para la nueva organización: esa reacción depende de cómo reciban el cambio los seguidores, afiliados y comunidades involucradas.

El nuevo partido reconoce la trayectoria y el capital personal del protagonista mediante un rango equivalente, sujeto a que exista una responsabilidad comparable. Los cargos no se transfieren: deben obtenerse o asignarse en la nueva organización. La salida y la llegada pueden activar cambios de confianza, reputación, relaciones y apoyos; sus magnitudes y eventos se definirán más adelante.

## 8. Qué queda para etapas posteriores

- Definir cantidades, probabilidades, límites de recursos y ritmo de crecimiento.
- Diseñar elecciones y determinar cómo se transforma la intención de voto en resultados.
- Simular recursos, acciones y competencia de los partidos opositores.
- Definir eventos, condiciones de cambio de partido y consecuencias concretas para cada transición.
- Diseñar la interfaz para consultar cuentas, costos, riesgo y cambios de cada misión.

## 9. Glosario

- **Intención de voto:** estimación cambiante del apoyo electoral a un partido.
- **Capital político:** influencia disponible para convocar, negociar o conseguir apoyo.
- **Red personal:** afiliados y seguidores vinculados al personaje dentro de la organización.
- **Dinero blanco:** fondos declarados y registrables.
- **Dinero negro:** fondos opacos con mayor exposición a escándalos u otras consecuencias.
