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

Si no escuchas la prueba, comprueba el volumen, la salida de audio y que el iPhone tenga una voz en español disponible.

## Bienvenida

Pulso abre con su pantalla de bienvenida. Toca **Entrar a Pulso** para configurar tu entrenamiento. El logotipo del menú vuelve a la bienvenida cuando no hay una sesión en marcha.

## Vista horizontal y TV

Al girar el iPhone, el aro y los controles se colocan lado a lado. El panel decorativo no aparece durante el entrenamiento.

- Toca el único **icono de pantalla/TV** de la esquina para abrir las opciones.
- Dentro de ese menú, **Modo TV** amplía el temporizador y aprovecha toda el área disponible.
- **Pantalla completa** oculta el navegador cuando el dispositivo lo permite. En iPhone, abrir Pulso desde el icono de inicio permite evitar las barras de Safari.
- Ese mismo menú explica cómo duplicar el iPhone con AirPlay. Gíralo en horizontal y usa Centro de control → Duplicar pantalla. La TV compatible y el iPhone deben estar en la misma red wifi.
- También puedes abrir esta dirección en el navegador de la TV o en una computadora conectada a ella.
- En duplicación, las bandas negras y los bordes dependen también de la proporción del iPhone y los ajustes de imagen de la TV. Pulso conserva la proporción del aro; no puede controlar el ajuste físico del televisor.

## Elegir voz masculina o femenina

En **Más → Voz de la guía**, elige Automática, Femenina o Masculina y pulsa **Probar voz**. También puedes elegir una voz específica por nombre. La elección queda guardada en el dispositivo.

La selección utiliza las voces en español que ofrece el navegador. Si no se identifica el tipo elegido, Pulso lo indica y muestra la alternativa que usará. No descarga voces ni simula el género cambiando el tono.

## Añadir a la pantalla de inicio

En Safari, toca **Compartir → Añadir a pantalla de inicio**. Si aparece **Abrir como app web**, actívalo. Después toca **Añadir**.

En **Más** también encontrarás las instrucciones de instalación. Cuando aparezca «Lista para abrir sin internet en este dispositivo», la interfaz puede cargar sin conexión. La voz depende de las voces disponibles en el iPhone.

## Qué debes saber

- Mantén Pulso visible para escuchar las alertas. iOS puede suspender los sonidos y la voz al bloquear el iPhone o cambiar a otra app.
- **Mantener pantalla activa** usa la función del navegador cuando está disponible; no sustituye esa limitación.
- Los datos se guardan en este navegador y dispositivo. No se suben a GitHub ni se sincronizan entre dispositivos. Usa **Exportar mis datos** para conservar una copia.
- Borrar los datos del sitio puede eliminar rutinas e historial.
- El código de la app y la página son públicos. Tus entrenamientos guardados localmente no forman parte del repositorio.
- No necesitas cuenta para usar Pulso. No incluye anuncios, analítica ni servidores de datos personales.
- Cuando se publique una actualización, recarga Pulso para verla. La descarga de la nueva versión no recarga ni interrumpe un entrenamiento que ya esté en marcha.

## Desarrollo y comprobaciones

HTML, CSS y JavaScript sin dependencias ni proceso de compilación. Rutas relativas compatibles con sitios de proyecto de GitHub Pages.

```sh
node --test engine.test.cjs pwa.test.cjs app.test.cjs voices.test.cjs display.test.cjs
node --check app.js
node --check pwa.js
node --check sw.js
```

El uso real de voz, volumen, pantalla activa e instalación debe probarse en un iPhone. Las pruebas de Node comprueban lógica y estructura; no reproducen el audio de Safari.

[Documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [Añadir una web al inicio del iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios)
