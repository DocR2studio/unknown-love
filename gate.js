/* Puerta de entrada: compara solo un hash con sal, nunca la clave en texto plano. */
(function (global) {
  const SALT = (typeof EDITOR_PIN_SALT === "string") ? EDITOR_PIN_SALT : "unknown-love-editor-v1:";
  const HASH = (typeof EDITOR_PIN_HASH === "string") ? EDITOR_PIN_HASH : "537d65ecd0968194eb24e215050bc263e9fc0ee6ba9eed04324310e3698a8d58";
  const STORE = "eva_novela_gate_v1";

  const waiters = [];
  let open = false;

  function hexDigest(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function pinSame(a, b) {
    a = String(a || "");
    b = String(b || "");
    if (a.length !== b.length) return false;
    let x = 0;
    for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return x === 0;
  }
  function digest(v) {
    if (!v || typeof crypto === "undefined" || !crypto.subtle) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + v)).then(hexDigest);
  }
  function storedOk() {
    try { return pinSame(localStorage.getItem(STORE) || "", HASH); } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(STORE, HASH); } catch (e) { /* ignore */ }
  }
  function revealAssets() {
    document.querySelectorAll("img[data-src]").forEach((img) => {
      if (!img.getAttribute("src")) img.setAttribute("src", img.getAttribute("data-src"));
    });
    const icon = document.getElementById("app-icon");
    const apple = document.getElementById("app-apple-icon");
    if (icon) icon.setAttribute("href", "assets/logo-eva.jpg");
    if (apple) apple.setAttribute("href", "assets/logo-eva.jpg");
  }
  function setOpen() {
    if (open) return;
    open = true;
    document.documentElement.classList.remove("is-locked");
    const gate = document.getElementById("entry-gate");
    if (gate) gate.setAttribute("hidden", "");
    revealAssets();
    waiters.splice(0).forEach((fn) => {
      try { fn(); } catch (e) { console.error(e); }
    });
  }
  function isOpen() {
    return open || storedOk();
  }
  function onUnlock(fn) {
    if (typeof fn !== "function") return;
    if (isOpen() && document.documentElement.classList.contains("is-locked") === false && open) {
      fn();
      return;
    }
    if (open) { fn(); return; }
    waiters.push(fn);
  }
  function showError() {
    const err = document.getElementById("gate-error");
    const card = document.querySelector("#entry-gate .gate-card");
    if (err) err.hidden = false;
    if (card) {
      card.classList.remove("is-shaking");
      void card.offsetWidth;
      card.classList.add("is-shaking");
    }
  }
  async function submit() {
    const input = document.getElementById("input-gate");
    const v = input ? input.value.trim() : "";
    if (input) input.value = "";
    const h = await digest(v);
    if (HASH && pinSame(h, HASH)) {
      const err = document.getElementById("gate-error");
      if (err) err.hidden = true;
      remember();
      setOpen();
    } else {
      showError();
      if (input) input.focus();
    }
  }
  function bindGate() {
    if (storedOk()) {
      setOpen();
      return;
    }
    document.documentElement.classList.add("is-locked");
    const gate = document.getElementById("entry-gate");
    if (gate) gate.removeAttribute("hidden");
    const btn = document.getElementById("btn-gate");
    const input = document.getElementById("input-gate");
    if (btn) btn.addEventListener("click", submit);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D+/g, "").slice(0, 4);
      });
      setTimeout(() => input.focus(), 200);
    }
  }

  if (storedOk()) {
    document.documentElement.classList.remove("is-locked");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindGate);
  } else {
    bindGate();
  }

  global.EntryGate = { isOpen, onUnlock, revealAssets };
})(window);
