(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  function typeNode(el, text, speed) {
    return new Promise((res) => {
      let i = 0;
      const tick = () => {
        if (i < text.length) {
          el.textContent = text.slice(0, ++i);
          setTimeout(tick, speed + (Math.random() < 0.2 ? 26 : 0));
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

  /* ---------- analog grain ---------- */
  const noiseCnv = $("#noise");
  let noiseCtx = null;
  function sizeNoise() {
    if (!noiseCnv) return;
    noiseCnv.width = Math.max(1, Math.floor(window.innerWidth / 2));
    noiseCnv.height = Math.max(1, Math.floor(window.innerHeight / 2));
  }
  function frameNoise() {
    if (noiseCtx) {
      const w = noiseCnv.width, h = noiseCnv.height;
      noiseCtx.clearRect(0, 0, w, h);
      const tiles = 80 + ((Math.random() * 50) | 0);
      for (let i = 0; i < tiles; i++) {
        const bw = 2 + ((Math.random() * 10) | 0);
        const bh = 2 + ((Math.random() * 8) | 0);
        const v = (Math.random() * 255) | 0;
        noiseCtx.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.16)";
        noiseCtx.fillRect(Math.random() * w, Math.random() * h, bw, bh);
      }
      if (Math.random() < 0.5) {
        const bandY = Math.random() * h;
        noiseCtx.fillStyle = "rgba(255,255,255,0.07)";
        noiseCtx.fillRect(0, bandY, w, 1 + ((Math.random() * 4) | 0));
      }
    }
    setTimeout(frameNoise, document.hidden ? 400 : 90);
  }
  window.addEventListener("resize", sizeNoise);

  /* ---------- drifting soot ---------- */
  const ashCnv = $("#ash");
  let ashCtx = null;
  let ashParticles = [];
  function makeSoot(w, h, spread) {
    return {
      x: Math.random() * w,
      y: spread ? Math.random() * h : h + 8,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(0.12 + Math.random() * 0.38),
      sway: 0.6 + Math.random() * 1.5,
      phase: Math.random() * 6.2832,
      size: 0.6 + Math.random() * 1.7,
      ember: Math.random() < 0.13,
    };
  }
  function sizeAsh() {
    if (!ashCnv) return;
    ashCnv.width = Math.max(1, Math.floor(window.innerWidth / 2));
    ashCnv.height = Math.max(1, Math.floor(window.innerHeight / 2));
    ashParticles = [];
    for (let i = 0; i < 36; i++) ashParticles.push(makeSoot(ashCnv.width, ashCnv.height, true));
  }
  function frameAsh() {
    if (ashCtx && !document.hidden) {
      const w = ashCnv.width, h = ashCnv.height;
      ashCtx.clearRect(0, 0, w, h);
      const t = performance.now() / 1000;
      for (let i = 0; i < ashParticles.length; i++) {
        const p = ashParticles[i];
        p.x += p.vx + Math.sin(t * p.sway + p.phase) * 0.35;
        p.y += p.vy;
        if (p.y < -6) { ashParticles[i] = makeSoot(w, h, false); continue; }
        if (p.x < -6) p.x = w + 6;
        else if (p.x > w + 6) p.x = -6;
        const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.8 + p.phase * 2));
        const r = Math.round((p.ember ? 255 : 200) * pulse);
        const g = Math.round((p.ember ? 150 : 200) * pulse);
        const b = Math.round((p.ember ? 95 : 218) * pulse);
        const rad = p.size * 3;
        const grad = ashCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        grad.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.9)");
        grad.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ashCtx.fillStyle = grad;
        ashCtx.beginPath();
        ashCtx.arc(p.x, p.y, rad, 0, 6.2832);
        ashCtx.fill();
      }
    }
    requestAnimationFrame(frameAsh);
  }
  window.addEventListener("resize", sizeAsh);

  /* ---------- event flash ---------- */
  const flashEl = $(".flash");
  function redFlash() {
    if (!flashEl) return;
    flashEl.classList.remove("go");
    void flashEl.offsetWidth;
    flashEl.classList.add("go");
  }

  /* ---------- static burst overlay ---------- */
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
    const w = Math.max(1, Math.floor(window.innerWidth / 2));
    const h = Math.max(1, Math.floor(window.innerHeight / 2));
    if (burstCnv.width !== w || burstCnv.height !== h) {
      burstCnv.width = w;
      burstCnv.height = h;
    }
    if (burstCtx) {
      burstCtx.clearRect(0, 0, w, h);
      const bands = Math.max(8, Math.floor(h / 3));
      for (let y = 0; y < h; y += 3) {
        const v = (Math.random() * 255) | 0;
        const skew = ((Math.random() * 40) | 0) - 20;
        burstCtx.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.55)";
        burstCtx.fillRect(skew, y, w, 1);
      }
      const splats = 90;
      for (let i = 0; i < splats; i++) {
        const v = (Math.random() * 255) | 0;
        burstCtx.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.4)";
        burstCtx.fillRect(Math.random() * w, Math.random() * h, 2 + ((Math.random() * 8) | 0), 2 + ((Math.random() * 8) | 0));
      }
    }
    burstCnv.style.opacity = "1";
    burstCnv.classList.add("go");
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      burstCnv.style.opacity = "0";
    }, ms || 90);
  }

  /* ---------- screen roll ---------- */
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
