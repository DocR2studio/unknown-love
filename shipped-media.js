/* Medios incluidos de fábrica (rutas). El juego los usa si no hay un recambio en IndexedDB. */
const SHIPPED_MEDIA = {
  "evento:desayuno:conejito": { "image": "assets/editor-media/evento-desayuno-conejito.jpg" },
  "evento:desayuno:estirandose": { "image": "assets/editor-media/evento-desayuno-estirandose.jpg" },
  "evento:desayuno:sonriendo-plato": { "image": "assets/editor-media/evento-desayuno-sonriendo-plato.jpg" },
  "eva-accion": { "videos": ["assets/videos/acciones-01.mp4", "assets/videos/acciones-02.mp4", "assets/videos/acciones-03.mp4"] },
};

const SHIPPED_VIDEOS = ["assets/videos/video-01.mp4", "assets/videos/acciones-01.mp4", "assets/videos/acciones-02.mp4", "assets/videos/acciones-03.mp4"];

/* Música de fábrica (v35). Si falta un archivo, esa pista simplemente no suena. */
const SHIPPED_AUDIO = {
  "intro-menu": "assets/audio/intro-menu.mp3",
  "intro": "assets/audio/intro.mp3",
  "juego": "assets/audio/juego.mp3"
};
