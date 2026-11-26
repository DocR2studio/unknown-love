/* Música de fondo (v35): Web Audio con AudioBuffer en bucle (sin cortes en el empalme),
   fundidos entre pistas y arranque tras el primer toque (política de autoplay móvil).
   Pistas: "intro-menu" (arranque/título/menú), "intro" (intro del juego), "juego" (partida).
   Tolerante a archivos ausentes: si no se puede cargar una pista, simplemente no suena. */
const MusicDirector = (() => {
  const IDS = ["intro-menu", "intro", "juego"];
  const FADE_IN = 1.6;
  const FADE_OUT = 1.2;
  let ctx = null;
  let master = null;
  let unlocked = false;
  let want = null;
  let volume = 0.7;
  let muted = false;
  const buffers = {}; /* id -> Promise<AudioBuffer|null> */
  const voices = {}; /* id -> { src, gain, token } */
  const info = {}; /* id -> { source: "editor"|"fábrica"|"", loaded: bool, error: bool } */
  let seq = 0;

  function versioned(path) {
    if (!path || /^(blob:|data:|https?:)/i.test(path)) return path;
    const s = document.querySelector("script[src*=\"story.js\"]");
    const m = s && s.src && s.src.match(/[?&]v=([^&]+)/);
    return m ? path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + m[1] : path;
  }
  function shippedPath(id) {
    if (typeof SHIPPED_AUDIO !== "undefined" && SHIPPED_AUDIO && SHIPPED_AUDIO[id]) return SHIPPED_AUDIO[id];
    return "";
  }
  function targetGain() {
    return muted ? 0 : Math.max(0, Math.min(1, volume));
  }
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = targetGain();
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      master = null;
    }
    return ctx;
  }
  async function fetchBytes(id) {
    /* El reemplazo del editor (IndexedDB) manda sobre el archivo de fábrica. */
    try {
      if (typeof MediaStore !== "undefined") {
        const rec = await MediaStore.getRecord("music:" + id, "audio");
        if (rec && rec.blob) {
          info[id].source = "editor";
          return await rec.blob.arrayBuffer();
        }
      }
    } catch (e) { /* ignore */ }
    const path = shippedPath(id);
    if (!path) return null;
    try {
      const url = versioned(path);
      const res = await fetch(url);
      if (!res.ok) return null;
      info[id].source = "fábrica";
      return await res.arrayBuffer();
    } catch (e) {
      return null;
    }
  }
  function decode(bytes) {
    return new Promise((resolve) => {
      try {
        const p = ctx.decodeAudioData(bytes, (b) => resolve(b), () => resolve(null));
        if (p && typeof p.then === "function") p.then((b) => resolve(b), () => resolve(null));
      } catch (e) {
        resolve(null);
      }
    });
  }
  function load(id) {
    if (buffers[id]) return buffers[id];
    info[id] = info[id] || { source: "", loaded: false, error: false };
    buffers[id] = (async () => {
      if (!ensureCtx()) return null;
      const bytes = await fetchBytes(id);
      if (!bytes || !bytes.byteLength) { info[id].error = true; return null; }
      const buf = await decode(bytes);
      info[id].loaded = !!buf;
      info[id].error = !buf;
      return buf;
    })();
    return buffers[id];
  }
  function fadeTo(gainNode, value, seconds) {
    const t = ctx.currentTime;
    try {
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      gainNode.gain.linearRampToValueAtTime(value, t + seconds);
    } catch (e) {
      gainNode.gain.value = value;
    }
  }
  function stopVoice(id, seconds) {
    const v = voices[id];
    if (!v) return;
    delete voices[id];
    if (!v.src) return; /* aún cargando: el token invalidado cancela el arranque */
    fadeTo(v.gain, 0, seconds);
    window.setTimeout(() => {
      try { v.src.stop(); } catch (e) { /* ignore */ }
      try { v.src.disconnect(); v.gain.disconnect(); } catch (e) { /* ignore */ }
    }, Math.round(seconds * 1000) + 120);
  }
  async function startVoice(id) {
    if (voices[id]) return;
    const token = ++seq;
    voices[id] = { token: token, pending: true };
    const buf = await load(id);
    const cur = voices[id];
    if (!cur || cur.token !== token || want !== id || !ctx) {
      if (cur && cur.token === token) delete voices[id];
      return;
    }
    if (!buf) { delete voices[id]; return; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; /* bucle sin silencio: el buffer se repite en el mismo reloj de audio */
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(master);
    src.start(0);
    voices[id] = { src: src, gain: gain, token: token };
    fadeTo(gain, 1, FADE_IN);
  }
  function apply() {
    if (!unlocked || !ensureCtx()) return;
    Object.keys(voices).forEach((id) => {
      if (id !== want) stopVoice(id, FADE_OUT);
    });
    if (want && IDS.indexOf(want) !== -1) startVoice(want);
  }
  function request(id) {
    want = IDS.indexOf(id) !== -1 ? id : null;
    apply();
  }
  function unlock() {
    if (!ensureCtx()) return;
    const go = () => {
      unlocked = true;
      apply();
    };
    if (ctx.state === "running") { go(); return; }
    try {
      const p = ctx.resume();
      if (p && typeof p.then === "function") p.then(go, go);
      else go();
    } catch (e) { go(); }
  }
  function setSettings(vol, isMuted) {
    if (typeof vol === "number" && isFinite(vol)) volume = Math.max(0, Math.min(100, vol)) / 100;
    muted = !!isMuted;
    if (ctx && master) {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(targetGain(), now + 0.06);
      } catch (e) { master.gain.value = targetGain(); }
    }
  }
  /* Tras reemplazar o quitar una pista en el editor. */
  function reload(id) {
    delete buffers[id];
    if (info[id]) { info[id].loaded = false; info[id].error = false; info[id].source = ""; }
    if (voices[id] && !voices[id].pending) stopVoice(id, 0.4);
    if (want === id) window.setTimeout(apply, 450);
  }
  function bindGesture() {
    const handler = () => {
      if (!unlocked || (ctx && ctx.state !== "running")) unlock();
    };
    ["pointerdown", "touchend", "keydown", "click"].forEach((ev) => {
      document.addEventListener(ev, handler, { capture: true, passive: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) { try { ctx.suspend(); } catch (e) { /* ignore */ } }
      else if (unlocked) { try { ctx.resume(); } catch (e) { /* ignore */ } }
    });
  }
  function status() {
    return {
      unlocked: unlocked,
      ctx: ctx ? ctx.state : "none",
      want: want,
      playing: Object.keys(voices).filter((id) => voices[id] && voices[id].src),
      loopAll: Object.keys(voices).every((id) => !voices[id].src || voices[id].src.loop === true),
      master: master ? Number(master.gain.value.toFixed(3)) : null,
      muted: muted,
      volume: volume,
      info: JSON.parse(JSON.stringify(info))
    };
  }
  bindGesture();
  return { IDS, request, unlock, setSettings, reload, status, load };
})();
