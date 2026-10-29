# Pulso HIIT

Temporizador de intervalos en español para usar en Safari y añadir a la pantalla de inicio del iPhone. Incluye Tabata, Rondas, Cronómetro, rutinas, historial, voz y sonidos.

## Publicar en GitHub Pages

1. Abre [Settings → Pages](https://github.com/Lalo-mr/pulso-hiit/settings/pages).
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona **main** y **/(root)**. Pulsa **Save**.
4. Espera a que GitHub muestre la publicación y abre [Pulso HIIT](https://lalo-mr.github.io/pulso-hiit/). La primera publicación puede tardar unos minutos.

No necesitas instalar herramientas ni contratar un dominio.

## Primera prueba en iPhone

1. Abre la dirección publicada en **Safari**.
2. En **Más**, pulsa **Probar voz** y ajusta el volumen.
3. Para una prueba de 56 segundos configura: preparación 5 s, entrenar 8 s, descansar 4 s, 2 rondas, 2 ciclos, descanso entre ciclos 6 s y enfriamiento 5 s.
4. Pulsa **Empezar entrenamiento** y mantén Pulso visible. Debes escuchar preparación, ejercicio/ronda, descanso, recuperación, enfriamiento y final.

Si no escuchas la prueba, comprueba el volumen, la salida de audio y que la primera descarga de las voces haya terminado con conexión.

## Bienvenida

Pulso abre con su pantalla de bienvenida. Toca **Entrar a Pulso** para configurar tu entrenamiento. El logotipo del menú vuelve a la bienvenida cuando no hay una sesión en marcha.

## Vista horizontal y TV

Durante un entrenamiento, gira el iPhone en horizontal para ver el único icono de **Pantalla completa**. Tócalo para ampliar y vuelve a tocarlo para salir. Al girar a vertical o terminar, Pulso recupera su vista normal. El aro conserva su forma circular.

Safari puede conservar sus barras; abrir Pulso desde la pantalla de inicio ayuda a aprovechar el espacio. En **Más → Cómo usar Pulso en una TV** encontrarás las instrucciones de AirPlay. En una computadora o navegador de TV, el mismo icono permite ampliar el temporizador. La proporción y las bandas negras de la duplicación también dependen del dispositivo y del televisor.

No hay botones de audio ni TV en la cabecera. Las preferencias están reunidas en **Más**.

## Elegir voz masculina o femenina

En **Más → Voz de la guía**, elige **Femenina** o **Masculina** y pulsa **Probar voz**. La elección queda guardada en este navegador.

Ambas voces en español están incluidas en la app como audios. No dependen de las voces de Siri ni de las que Safari pueda mostrar. La primera descarga necesita conexión; después de que la app indique que está lista sin internet, los audios también se pueden reproducir sin conexión. No se envía texto ni entrenamientos a un servicio de voz.

La guía anuncia las fases y el número de ronda. Los tres últimos segundos siguen usando pitidos. Si una voz no se puede cargar, Pulso muestra un aviso y permite reintentar con **Probar voz**; no sustituye silenciosamente una voz por otra.

Consulta los [créditos y licencia de las voces](audio/CREDITOS.md).

## Añadir a la pantalla de inicio

En Safari, toca **Compartir → Añadir a pantalla de inicio**. Si aparece **Abrir como app web**, actívalo. Después toca **Añadir**.

En **Más** también encontrarás las instrucciones de instalación. Cuando aparezca «Lista para abrir sin internet en este dispositivo», la interfaz puede cargar sin conexión. Las dos voces incluidas también se guardan para su reproducción sin conexión.

## Qué debes saber

- Mantén Pulso visible para escuchar las alertas. iOS puede suspender los sonidos y la voz al bloquear el iPhone o cambiar a otra app.
- **Mantener pantalla activa** usa la función del navegador cuando está disponible; no sustituye esa limitación.
- Los datos se guardan en este navegador y dispositivo. No se suben a GitHub ni se sincronizan entre dispositivos. Usa **Exportar mis datos** para conservar una copia.
- Borrar los datos del sitio puede eliminar rutinas e historial.
- El código de la app y la página son públicos. Tus entrenamientos guardados localmente no forman parte del repositorio.
- No necesitas cuenta para usar Pulso. No incluye anuncios, analítica ni servidores de datos personales.
- Cuando se publique una actualización, recarga Pulso para verla. La descarga de la nueva versión no recarga ni interrumpe un entrenamiento que ya esté en marcha.

## Visitas

No se ha añadido analítica ni un contador de visitas. GitHub Pages no ofrece una base de datos privada ni un receptor de eventos para registrar automáticamente las visitas a la app. Las estadísticas Traffic de GitHub corresponden al repositorio, no a las visitas de la página publicada. No se incluyen credenciales de GitHub en el navegador.

## Desarrollo y comprobaciones

HTML, CSS y JavaScript sin dependencias ni proceso de compilación. Rutas relativas compatibles con sitios de proyecto de GitHub Pages.

```sh
node --test engine.test.cjs pwa.test.cjs app.test.cjs voices.test.cjs display.test.cjs voice-audio.test.cjs
node --check app.js
node --check voice-audio.js
node --check pwa.js
node --check sw.js
```

El uso real de voz, volumen, pantalla activa e instalación debe probarse en un iPhone. Las pruebas de Node comprueban lógica y estructura; no reproducen el audio de Safari.

[Documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [Añadir una web al inicio del iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios)
