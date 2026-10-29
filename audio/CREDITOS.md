# Voces de Pulso HIIT

Estas frases en español fueron sintetizadas localmente para Pulso mediante Piper y el modelo **es_ES-sharvard-medium**. La app reproduce los audios incluidos; no envía texto, rutinas ni datos personales a un servicio de voz.

- Modelo: [rhasspy/piper-voices, es_ES-sharvard-medium](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/sharvard/medium).
- [Ficha del modelo](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/sharvard/medium/MODEL_CARD): español de España, dos hablantes; configuración `M: 0`, `F: 1`.
- Corpus original: **Sharvard_IJA**, Vincent Aubanel, Maria Luisa García Lecumberri y Martin Cooke (2014), LISTA Consortium. DOI: [10.7488/ds/75](https://doi.org/10.7488/ds/75).
- Licencia del corpus declarada por el modelo: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/).
- Generador: [Piper](https://github.com/rhasspy/piper), versión 2023.11.14-2, licencia MIT. El generador y el modelo no se distribuyen dentro de esta app.

Adaptaciones realizadas para Pulso: síntesis de frases propias de entrenamiento y números del uno al cien; recorte de silencios; ajuste de nivel; unión de segmentos y codificación MP3 mono a 48 kb/s. Los archivos `male.mp3` y `female.mp3` contienen los segmentos indicados en `manifest.json`. Se conserva esta atribución junto con los audios.

Las etiquetas «masculina» y «femenina» corresponden a los dos hablantes identificados por el corpus y la configuración del modelo. Las voces son sintéticas; la atribución no implica el respaldo de los autores, las instituciones o los hablantes a Pulso.
