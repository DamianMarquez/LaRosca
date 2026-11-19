# La Rosca

Prototipo web estático para jugar una campaña política single player. No necesita backend, base de datos, Node.js ni proceso de compilación.

## Publicar en Plesk

Subí el contenido de esta carpeta (o directamente `index.html`, `styles.css` y `app.js`) a `httpdocs` del dominio. Después abrí el dominio en el navegador. Para probar localmente, abrí `index.html` o serví la carpeta con cualquier servidor estático.

## Guardar y recuperar una partida

En el juego, usá **Exportar partida** para descargar un JSON. Para continuar en otro navegador o dispositivo, abrí el sitio y usá **Importar partida**. El archivo incluye una versión de formato; no se guarda información en un servidor.

## Balance

Duraciones, costos, umbrales y probabilidades son valores provisionales de prototipo y están declarados al comienzo de `app.js`. El catálogo y los conceptos siguen los documentos en `docs/design/`.
