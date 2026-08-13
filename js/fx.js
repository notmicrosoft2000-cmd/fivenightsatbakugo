(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  function typeNode(el, text, speed) {
    return new Promise((res) => {
      let i = 0;
      const tick = () => {
        if (i < text.length) {
          el.textContent = text.slice(0, ++i);
          setTimeout(tick, speed);
        } else {
          res();
        }
      };
      tick();
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const noiseCnv = $("#noise");
  let noiseCtx = null;
  function sizeNoise() {
    if (!noiseCnv) return;
    noiseCnv.width = Math.max(1, Math.floor(window.innerWidth / 2));
    noiseCnv.height = Math.max(1, Math.floor(window.innerHeight / 2));
  }
  let noiseFrame = 0;
  function frameNoise() {
    if (noiseCtx) {
      const w = noiseCnv.width, h = noiseCnv.height;
      const img = noiseCtx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 22;
      }
      noiseCtx.putImageData(img, 0, 0);
      noiseFrame++;
      if (noiseFrame % 9 === 0) {
        noiseCtx.fillStyle = "rgba(255,255,255,0.05)";
        noiseCtx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 8);
      }
    }
    setTimeout(frameNoise, document.hidden ? 400 : 100);
  }
  window.addEventListener("resize", sizeNoise);

  const ashCnv = $("#ash");
  let ashCtx = null;
  let ashParticles = [];
  function sizeAsh() {
    if (!ashCnv) return;
    ashCnv.width = Math.max(1, Math.floor(window.innerWidth / 2));
    ashCnv.height = Math.max(1, Math.floor(window.innerHeight / 2));
    const w = ashCnv.width, h = ashCnv.height;
    ashParticles = [];
    for (let i = 0; i < 40; i++) {
      ashParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.3,
        size: Math.random() < 0.6 ? 1 : (Math.random() < 0.5 ? 1.5 : 2),
        phase: Math.random() * 6.28,
        b: 30 + Math.random() * 70,
        red: Math.random() < 0.16,
      });
    }
  }
  function frameAsh() {
    if (ashCtx && !document.hidden) {
      const w = ashCnv.width, h = ashCnv.height;
      ashCtx.clearRect(0, 0, w, h);
      const t = performance.now() / 1000;
      for (let i = 0; i < ashParticles.length; i++) {
        const p = ashParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + p.phase);
        const b = Math.max(8, Math.min(200, p.b * (0.5 + 0.5 * tw))) | 0;
        ashCtx.fillStyle = p.red ? ("rgb(" + b + "," + (b * 0.55 | 0) + "," + (b * 0.55 | 0) + ")") : ("rgb(" + b + "," + b + "," + b + ")");
        ashCtx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    requestAnimationFrame(frameAsh);
  }
  window.addEventListener("resize", sizeAsh);

  const flashEl = $(".flash");
  function redFlash() {
    if (!flashEl) return;
    flashEl.classList.remove("go");
    void flashEl.offsetWidth;
    flashEl.classList.add("go");
  }

  let burstCnv = null;
  let burstCtx = null;
  let burstTimer = null;
  function staticBurst(ms) {
    if (!burstCnv) {
      burstCnv = document.createElement("canvas");
      burstCnv.id = "staticBurst";
      document.querySelector(".crt").appendChild(burstCnv);
      burstCtx = burstCnv.getContext("2d");
    }
    const w = Math.floor(window.innerWidth / 2);
    const h = Math.floor(window.innerHeight / 2);
    if (burstCnv.width !== w || burstCnv.height !== h) {
      burstCnv.width = w;
      burstCnv.height = h;
    }
    burstCnv.style.opacity = "1";
    burstCnv.classList.add("go");
    if (burstCtx) {
      const img = burstCtx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      burstCtx.putImageData(img, 0, 0);
    }
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      burstCnv.style.opacity = "0";
    }, ms || 90);
  }

  function crtRoll() {
    const crt = $(".crt");
    if (crt) {
      crt.classList.remove("roll");
      void crt.offsetWidth;
      crt.classList.add("roll");
    }
  }

  const FX = {
    typeNode,
    sleep,
    initNoise() { noiseCtx = noiseCnv ? noiseCnv.getContext("2d") : null; sizeNoise(); frameNoise(); },
    initAsh() { ashCtx = ashCnv ? ashCnv.getContext("2d") : null; sizeAsh(); requestAnimationFrame(frameAsh); },
    redFlash,
    staticBurst,
    crtRoll,
  };

  window.FX = FX;
})();
