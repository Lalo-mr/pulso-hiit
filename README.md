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
- Si actualizas la app, cierra todas sus ventanas y vuelve a abrirla para activar la nueva versión; no se recargará a mitad del entrenamiento.

## Desarrollo y comprobaciones

HTML, CSS y JavaScript sin dependencias ni proceso de compilación. Rutas relativas compatibles con sitios de proyecto de GitHub Pages.

```sh
node --test engine.test.cjs pwa.test.cjs app.test.cjs
node --check app.js
node --check pwa.js
node --check sw.js
```

El uso real de voz, volumen, pantalla activa e instalación debe probarse en un iPhone. Las pruebas de Node comprueban lógica y estructura; no reproducen el audio de Safari.

[Documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) · [Añadir una web al inicio del iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios)
