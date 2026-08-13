(function () {
  "use strict";

  const cfg = CONFIG;
  const fx = FX;
  const $ = (s) => document.querySelector(s);

  const canvas = $("#game");
  const ctx = canvas.getContext("2d");
  const stage = $("#stage");
  const body = document.body;
  const menuAudio = $("#menuAudio");
  const cutsceneAudio = $("#cutsceneAudio");

  const RW = cfg.RENDER_W;
  const RH = cfg.RENDER_H;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));

  const touchDevice = window.matchMedia("(pointer: coarse)").matches;

  let logical = { x: 0, y: 0 };
  let hoverIndex = -1;

  function resize() {
    const s = Math.min(window.innerWidth / RW, window.innerHeight / RH);
    stage.style.width = (RW * s) + "px";
    stage.style.height = (RH * s) + "px";
  }

  function toLogical(e) {
    const r = stage.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * RW,
      y: (e.clientY - r.top) / r.height * RH,
    };
  }

  const images = {};
  function loadImage(key, src) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => { images[key] = img; res(); };
      img.onerror = () => { res(); };
      img.src = src;
    });
  }

  function loadAssets() {
    const jobs = [];
    const chars = cfg.FLASH_CHARACTERS.concat([cfg.EASTER_EGG_CHARACTER]);
    chars.forEach((c) => jobs.push(loadImage("char_" + c.name, c.file)));
    jobs.push(loadImage("office_bg", cfg.OFFICE_IMG_DIR + "/office_bg.png"));
    jobs.push(loadImage("door_left_closed", cfg.OFFICE_IMG_DIR + "/door_left_closed.png"));
    jobs.push(loadImage("door_left_ajar", cfg.OFFICE_IMG_DIR + "/door_left_open.png"));
    jobs.push(loadImage("door_right_closed", cfg.OFFICE_IMG_DIR + "/door_right_closed.png"));
    jobs.push(loadImage("door_right_ajar", cfg.OFFICE_IMG_DIR + "/door_right_open.png"));
    jobs.push(loadImage("glow_left_door", cfg.OFFICE_IMG_DIR + "/btn_glow_left_door.png"));
    jobs.push(loadImage("glow_right_door", cfg.OFFICE_IMG_DIR + "/btn_glow_right_door.png"));
    jobs.push(loadImage("glow_left_shock", cfg.OFFICE_IMG_DIR + "/btn_glow_left_light.png"));
    jobs.push(loadImage("glow_right_shock", cfg.OFFICE_IMG_DIR + "/btn_glow_right_light.png"));
    return Promise.all(jobs);
  }

  const save = {
    load() {
      try {
        const raw = localStorage.getItem(cfg.SAVE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { hasSeenIntro: false };
    },
    write(data) {
      try {
        localStorage.setItem(cfg.SAVE_KEY, JSON.stringify(data));
      } catch (e) {}
    },
  };
  const saveData = save.load();

  const OFFICE_SCALE = Math.min(RW / cfg.OFFICE_W, RH / cfg.OFFICE_H);
  const OFFICE_RECT = {
    x: (RW - cfg.OFFICE_W * OFFICE_SCALE) / 2,
    y: (RH - cfg.OFFICE_H * OFFICE_SCALE) / 2,
    w: cfg.OFFICE_W * OFFICE_SCALE,
    h: cfg.OFFICE_H * OFFICE_SCALE,
  };

  const MENU_BUTTON_RECT = { x: RW - 96, y: 12, w: 84, h: 32 };

  function toOffice(logicalPos) {
    const r = OFFICE_RECT;
    if (logicalPos.x < r.x || logicalPos.x > r.x + r.w ||
        logicalPos.y < r.y || logicalPos.y > r.y + r.h) return null;
    return {
      x: (logicalPos.x - r.x) / OFFICE_SCALE,
      y: (logicalPos.y - r.y) / OFFICE_SCALE,
    };
  }

  function hits(pos, center, halfSize) {
    return Math.abs(pos.x - center[0]) <= halfSize &&
           Math.abs(pos.y - center[1]) <= halfSize;
  }

  function drawOfficeImage(key) {
    const img = images[key];
    if (!img) return;
    ctx.drawImage(img, OFFICE_RECT.x, OFFICE_RECT.y, OFFICE_RECT.w, OFFICE_RECT.h);
  }

  class Door {
    constructor(ajarKey, closedKey, buttonPos) {
      this.ajarKey = ajarKey;
      this.closedKey = closedKey;
      this.buttonPos = buttonPos;
      this.isClosed = false;
      this.transitioning = false;
      this.timer = 0;
    }
    toggle() {
      this.isClosed = !this.isClosed;
      this.transitioning = true;
      this.timer = cfg.DOOR_FRAME_HOLD;
    }
    update(dt) {
      if (this.transitioning) {
        this.timer -= dt;
        if (this.timer <= 0) this.transitioning = false;
      }
    }
    draw() {
      if (!this.isClosed && !this.transitioning) return;
      drawOfficeImage(this.transitioning ? this.ajarKey : this.closedKey);
    }
    get glowIntensity() {
      return (this.isClosed || this.transitioning) ? 1 : 0;
    }
  }

  class ShockButton {
    constructor() {
      this.flashTimer = 0;
      this.cooldownTimer = 0;
    }
    get isFlashing() { return this.flashTimer > 0; }
    get onCooldown() { return this.cooldownTimer > 0; }
    fire() {
      if (this.onCooldown) return;
      this.flashTimer = cfg.SHOCK_FLASH_DURATION;
      this.cooldownTimer = cfg.SHOCK_COOLDOWN;
    }
    update(dt) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    draw() {
      if (this.flashTimer <= 0) return;
      const r = cfg.CENTER_HALLWAY_RECT;
      const alpha = cfg.SHOCK_FLASH_MAX_ALPHA * (this.flashTimer / cfg.SHOCK_FLASH_DURATION);
      ctx.fillStyle = "rgba(" + cfg.SHOCK_FLASH_COLOR[0] + "," +
        cfg.SHOCK_FLASH_COLOR[1] + "," + cfg.SHOCK_FLASH_COLOR[2] + "," +
        (alpha / 255) + ")";
      ctx.fillRect(
        OFFICE_RECT.x + r[0] * OFFICE_SCALE,
        OFFICE_RECT.y + r[1] * OFFICE_SCALE,
        r[2] * OFFICE_SCALE,
        r[3] * OFFICE_SCALE
      );
    }
  }

  class Office {
    constructor() {
      this.leftDoor = new Door("door_left_ajar", "door_left_closed", cfg.LEFT_DOOR_BUTTON_POS);
      this.rightDoor = new Door("door_right_ajar", "door_right_closed", cfg.RIGHT_DOOR_BUTTON_POS);
      this.shock = new ShockButton();
    }
    update(dt) {
      this.leftDoor.update(dt);
      this.rightDoor.update(dt);
      this.shock.update(dt);
    }
    handleTap(pos) {
      if (pos.x >= MENU_BUTTON_RECT.x && pos.x <= MENU_BUTTON_RECT.x + MENU_BUTTON_RECT.w &&
          pos.y >= MENU_BUTTON_RECT.y && pos.y <= MENU_BUTTON_RECT.y + MENU_BUTTON_RECT.h) {
        game.gotoMenu();
        return;
      }
      const officePos = toOffice(pos);
      if (!officePos) return;
      const hit = touchDevice ? 60 : cfg.DOOR_BUTTON_HALF_SIZE;
      const hitShock = touchDevice ? 60 : cfg.SHOCK_BUTTON_HALF_SIZE;
      if (hits(officePos, this.leftDoor.buttonPos, hit)) this.leftDoor.toggle();
      else if (hits(officePos, this.rightDoor.buttonPos, hit)) this.rightDoor.toggle();
      else if (hits(officePos, cfg.LEFT_SHOCK_BUTTON_POS, hitShock) ||
               hits(officePos, cfg.RIGHT_SHOCK_BUTTON_POS, hitShock)) this.shock.fire();
    }
    draw() {
      drawOfficeImage("office_bg");
      this.leftDoor.draw();
      this.rightDoor.draw();
      this.shock.draw();
      this._drawGlow("glow_left_door", this.leftDoor.glowIntensity, cfg.DOOR_GLOW_MAX_ALPHA);
      this._drawGlow("glow_right_door", this.rightDoor.glowIntensity, cfg.DOOR_GLOW_MAX_ALPHA);
      const shockGlow = this.shock.isFlashing ? 1 : 0;
      this._drawGlow("glow_left_shock", shockGlow, cfg.SHOCK_GLOW_MAX_ALPHA);
      this._drawGlow("glow_right_shock", shockGlow, cfg.SHOCK_GLOW_MAX_ALPHA);
      this._drawHint();
      this._drawMenuButton();
    }
    _drawGlow(key, intensity, maxAlpha) {
      if (intensity <= 0) return;
      ctx.globalAlpha = maxAlpha * clamp(intensity, 0, 1) / 255;
      drawOfficeImage(key);
      ctx.globalAlpha = 1;
    }
    _drawHint() {
      ctx.font = "13px Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(150,190,255,0.62)";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6;
      const verb = touchDevice ? "TAP" : "CLICK";
      ctx.fillText(verb + " — LEFT DOOR · RIGHT DOOR · SHOCK — [ MENU ]: TITLE", 14, RH - 18);
      ctx.shadowBlur = 0;
    }
    _drawMenuButton() {
      const r = MENU_BUTTON_RECT;
      ctx.fillStyle = "rgba(4,8,24,0.82)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(90,140,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(110,160,255,0.8)";
      ctx.shadowBlur = 8;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.shadowBlur = 0;
      ctx.font = "bold 14px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = cfg.TEXT_COLOR;
      ctx.fillText("MENU", r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
  }

  class Flasher {
    constructor() {
      this.weightedPool = [];
      cfg.FLASH_CHARACTERS.forEach((c) => {
        for (let i = 0; i < c.weight; i++) this.weightedPool.push(c.name);
      });
      this.currentName = this.weightedPool[Math.floor(Math.random() * this.weightedPool.length)];
      this.holdTimer = rand(cfg.FLASH_MIN_HOLD, cfg.FLASH_MAX_HOLD);
      this.inTransition = false;
      this.transitionTimer = 0;
      this.pendingName = null;
    }
    update(dt) {
      if (this.inTransition) {
        this.transitionTimer -= dt;
        if (this.transitionTimer <= 0) {
          this.currentName = this.pendingName;
          this.inTransition = false;
          this.holdTimer = rand(cfg.FLASH_MIN_HOLD, cfg.FLASH_MAX_HOLD);
        }
        return;
      }
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) this._beginTransition();
    }
    _beginTransition() {
      let nextName;
      if (Math.random() < cfg.EASTER_EGG_CHANCE) {
        nextName = cfg.EASTER_EGG_CHARACTER.name;
      } else {
        nextName = this.weightedPool[Math.floor(Math.random() * this.weightedPool.length)];
        let attempts = 0;
        while (nextName === this.currentName && attempts < 5) {
          nextName = this.weightedPool[Math.floor(Math.random() * this.weightedPool.length)];
          attempts++;
        }
      }
      this.pendingName = nextName;
      this.inTransition = true;
      this.transitionTimer = cfg.FLASH_TRANSITION_TIME;
      fx.staticBurst(100);
    }
    draw() {
      if (this.inTransition) return;
      const img = images["char_" + this.currentName];
      if (!img) return;
      const h = cfg.PORTRAIT_MAX_HEIGHT;
      const w = img.width * (h / img.height);
      ctx.drawImage(img, cfg.PORTRAIT_ANCHOR_X, cfg.PORTRAIT_ANCHOR_Y, w, h);
    }
  }

  const game = {
    state: "boot",
    t: 0,
    office: new Office(),
    flasher: new Flasher(),
    menuSelected: 0,
    overlay: null,
    menuVol: 0,
    menuTarget: 0,
    cutscene: {
      active: false,
      elapsed: 0,
      nextChangeAt: 6,
      charName: null,
    },
    ambientTimer: 8,

    init() {
      resize();
      window.addEventListener("resize", resize);

      fx.initNoise();
      fx.initAsh();

      stage.addEventListener("pointermove", (e) => {
        logical = toLogical(e);
        if (e.pointerType === "mouse") hoverIndex = game.menuHoverIndex(logical);
      });
      stage.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        logical = toLogical(e);
        game.handleTap();
      });
      window.addEventListener("contextmenu", (e) => e.preventDefault());
      window.addEventListener("keydown", (e) => game.handleKey(e));

      loadAssets().then(() => {
        game.runBoot();
      });
    },

    runBoot() {
      const boot = $("#boot");
      const bootLog = $("#bootLog");
      const bootPrompt = $("#bootPrompt");

      const BOOT_LINES = [
        ["INITIALIZING BAKUGO'S LOCATION v1.0", ""],
        ["CONNECTING TO OFFICE FEED ... OK", ""],
        ["CALIBRATING DOOR CONTROLS ... OK", ""],
        ["RECORDING NIGHT SHIFT ...", ""],
        ["", ""],
        ["IT KNOWS YOU'RE HERE.", "red"],
        ["DON'T LET ANYTHING IN.", "red"],
      ];

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener("keydown", onKey);
        boot.removeEventListener("pointerdown", onClick);
        boot.classList.add("done");
        document.body.classList.add("loaded");
        this.startRecTimer();
        this.startAmbient();
        if (saveData.hasSeenIntro) {
          this.gotoMenu();
        } else {
          this.startCutscene();
        }
      };
      const onKey = (e) => {
        if (e.key === "Enter") finish();
      };
      const onClick = () => finish();
      window.addEventListener("keydown", onKey);
      boot.addEventListener("pointerdown", onClick);

      (async () => {
        const skipHint = document.createElement("div");
        skipHint.className = "boot-skip";
        skipHint.textContent = "— CLICK TO SKIP —";
        for (const [line, cls] of BOOT_LINES) {
          if (finished) break;
          const span = document.createElement("div");
          if (cls) span.className = cls;
          bootLog.appendChild(span);
          if (line) await fx.typeNode(span, line, 24);
          else await fx.sleep(500);
          await fx.sleep(180);
          if (!bootLog.contains(skipHint)) bootLog.appendChild(skipHint);
        }
        if (!finished) bootPrompt.classList.remove("hidden");
      })();
    },

    startRecTimer() {
      const el = $("#recTime");
      const start = Date.now();
      const pad = (n) => String(n).padStart(2, "0");
      setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        el.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
      }, 1000);
    },

    startAmbient() {
      const sig = $("#sigStatus");
      const corrupt = () => {
        const states = ["STABLE", "WEAK", "UNSTABLE", "CORRUPT", "STABLE", "LOST"];
        const old = sig.textContent;
        sig.textContent = states[Math.floor(Math.random() * states.length)];
        sig.classList.add("sig-bad");
        setTimeout(() => {
          sig.textContent = old;
          sig.classList.remove("sig-bad");
        }, 2000);
      };
      setInterval(() => {
        if (document.hidden) return;
        if (Math.random() < 0.3) corrupt();
      }, 7000);
      setInterval(() => {
        if (document.hidden) return;
        if (Math.random() < 0.25) fx.redFlash();
      }, 14000);
    },

    gotoMenu() {
      this.state = "menu";
      body.className = "state-menu";
      this.overlay = null;
      this.menuTarget = 0.8;
      if (menuAudio.paused) menuAudio.play().catch(() => {});
    },

    gotoOffice() {
      this.state = "office";
      body.className = "state-office";
      this.menuTarget = 0;
    },

    startCutscene() {
      this.state = "cutscene";
      body.className = "state-cutscene";
      this.cutscene.active = true;
      this.cutscene.elapsed = 0;
      this.cutscene.nextChangeAt = rand(5, 8);
      this.cutscene.charName = this.flasher.weightedPool[Math.floor(Math.random() * this.flasher.weightedPool.length)];
      cutsceneAudio.currentTime = 0;
      cutsceneAudio.volume = 1;
      cutsceneAudio.play().catch(() => {});
      if (cfg.CUTSCENE_ECHO_ENABLED) {
        for (let i = 1; i <= cfg.CUTSCENE_ECHO_TAPS; i++) {
          const echo = new Audio(cfg.CUTSCENE_AUDIO);
          echo.volume = Math.pow(cfg.CUTSCENE_ECHO_DECAY, i);
          setTimeout(() => { echo.play().catch(() => {}); }, i * cfg.CUTSCENE_ECHO_DELAY * 1000);
        }
      }
    },

    finishCutscene() {
      this.cutscene.active = false;
      saveData.hasSeenIntro = true;
      save.write(saveData);
      this.gotoMenu();
    },

    menuHoverIndex(pos) {
      const items = cfg.MENU_ITEMS;
      for (let i = 0; i < items.length; i++) {
        const y = cfg.MENU_ANCHOR_Y + i * cfg.MENU_LINE_SPACING;
        if (pos.x >= cfg.MENU_ANCHOR_X - 10 && pos.x <= cfg.MENU_ANCHOR_X + 260 &&
            pos.y >= y - 8 && pos.y <= y + 34) {
          return i;
        }
      }
      return -1;
    },

    handleTap() {
      if (this.state === "menu") {
        if (this.overlay) {
          this.handleOverlayTap();
          return;
        }
        const idx = this.menuHoverIndex(logical);
        if (idx >= 0) {
          this.menuSelected = idx;
          this.confirmMenu(idx);
        }
        return;
      }
      if (this.state === "office") {
        this.office.handleTap(logical);
      }
    },

    confirmMenu(index) {
      const label = cfg.MENU_ITEMS[index];
      if (label === "NEW GAME" || label === "CONTINUE GAME") {
        this.gotoOffice();
      } else if (label === "EXIT") {
        this.overlay = {
          question: "TERMINATE TRANSMISSION?",
          buttons: [
            { label: "[ NO ]", x: 0, w: 110, action: () => { this.overlay = null; } },
            { label: "[ YES ]", x: 130, w: 110, action: () => { this.overlay = { ended: true }; } },
          ],
        };
      }
    },

    handleOverlayTap() {
      const o = this.overlay;
      if (!o) return;
      if (o.ended) {
        const bx = (RW - 320) / 2, by = (RH - 140) / 2;
        if (logical.x >= bx + 100 && logical.x <= bx + 220 &&
            logical.y >= by + 70 && logical.y <= by + 108) {
          this.overlay = null;
        }
        return;
      }
      const bx = (RW - 320) / 2, by = (RH - 140) / 2;
      for (const b of o.buttons) {
        if (logical.x >= bx + b.x && logical.x <= bx + b.x + b.w &&
            logical.y >= by + 52 && logical.y <= by + 90) {
          b.action();
          return;
        }
      }
    },

    handleKey(e) {
      if (this.state === "menu" && !this.overlay) {
        if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
          this.menuSelected = (this.menuSelected - 1 + cfg.MENU_ITEMS.length) % cfg.MENU_ITEMS.length;
        } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
          this.menuSelected = (this.menuSelected + 1) % cfg.MENU_ITEMS.length;
        } else if (e.key === "Enter" || e.key === " ") {
          this.confirmMenu(this.menuSelected);
        } else if (e.key === "Escape") {
          this.confirmMenu(cfg.MENU_ITEMS.length - 1);
        }
      } else if (this.state === "office") {
        if (e.key === "Escape") this.gotoMenu();
        else if (e.key.toLowerCase() === "q") this.office.leftDoor.toggle();
        else if (e.key.toLowerCase() === "e") this.office.rightDoor.toggle();
        else if (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "c" || e.key === " ") this.office.shock.fire();
      }
    },

    start() {
      let last = performance.now();
      const loop = (now) => {
        const dt = clamp((now - last) / 1000, 0, 0.05);
        last = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    update(dt) {
      this.t += dt;

      if (this.menuVol !== this.menuTarget) {
        this.menuVol += (this.menuTarget - this.menuVol) * Math.min(1, dt * 3);
        if (Math.abs(this.menuVol - this.menuTarget) < 0.01) this.menuVol = this.menuTarget;
        menuAudio.volume = this.menuVol;
        if (this.menuTarget === 0 && this.menuVol <= 0.01) menuAudio.pause();
      }

      if (this.state === "menu") {
        this.flasher.update(dt);
      } else if (this.state === "cutscene") {
        const c = this.cutscene;
        c.elapsed += dt;
        if (c.elapsed >= c.nextChangeAt) {
          c.nextChangeAt = c.elapsed + rand(5, 8);
          let name = this.flasher.weightedPool[Math.floor(Math.random() * this.flasher.weightedPool.length)];
          let attempts = 0;
          while (name === c.charName && attempts < 5) {
            name = this.flasher.weightedPool[Math.floor(Math.random() * this.flasher.weightedPool.length)];
            attempts++;
          }
          c.charName = name;
          fx.staticBurst(120);
        }
        if (c.elapsed >= cfg.CUTSCENE_DURATION) this.finishCutscene();
      } else if (this.state === "office") {
        this.office.update(dt);
      }

      if (this.state === "menu" && Math.random() < 0.08) {
        stage.style.transform = "translate(calc(-50% + " + rand(-cfg.JITTER_MAX_PX, cfg.JITTER_MAX_PX).toFixed(1) + "px), calc(-50% + " + rand(-cfg.JITTER_MAX_PX, cfg.JITTER_MAX_PX).toFixed(1) + "px))";
      } else if (this.state !== "menu") {
        stage.style.transform = "";
      }
    },

    draw() {
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, RW, RH);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      if (this.state === "cutscene") this._drawCutscene();
      else if (this.state === "menu") this._drawMenu();
      else if (this.state === "office") this.office.draw();

      ctx.restore();
    },

    _drawCutscene() {
      const c = this.cutscene;
      const img = images["char_" + c.charName];
      if (img) {
        const h = Math.min(RH * 0.85, img.height);
        const w = img.width * (h / img.height);
        ctx.drawImage(img, (RW - w) / 2, (RH - h) / 2, w, h);
      } else {
        ctx.font = "bold 20px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(80,100,140,0.9)";
        ctx.fillText("INTRO TRANSMISSION", RW / 2, RH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
      }

      const pct = clamp(c.elapsed / cfg.CUTSCENE_DURATION, 0, 1);
      ctx.fillStyle = "rgba(90,140,255,0.55)";
      ctx.fillRect(0, RH - 8, RW * pct, 4);

      let alpha = 1;
      if (c.elapsed < cfg.CUTSCENE_FADE_IN) alpha = c.elapsed / cfg.CUTSCENE_FADE_IN;
      else if (c.elapsed > cfg.CUTSCENE_DURATION - cfg.CUTSCENE_FADE_OUT) {
        alpha = Math.max(0, (cfg.CUTSCENE_DURATION - c.elapsed) / cfg.CUTSCENE_FADE_OUT);
      }
      if (alpha < 1) {
        ctx.fillStyle = "rgba(0,0,0," + (1 - alpha) + ")";
        ctx.fillRect(0, 0, RW, RH);
      }
    },

    _drawMenu() {
      this.flasher.draw();

      const items = cfg.MENU_ITEMS;
      const pulse = (Math.sin(this.t * cfg.MENU_PULSE_SPEED * Math.PI) + 1) / 2;
      ctx.font = "bold " + cfg.MENU_FONT_SIZE + "px Consolas, monospace";
      ctx.textBaseline = "top";

      for (let i = 0; i < items.length; i++) {
        const selected = (hoverIndex === i) || (this.overlay === null && this.menuSelected === i && hoverIndex < 0);
        const color = selected ? cfg.TEXT_COLOR_SELECTED : cfg.TEXT_COLOR;
        const label = (selected ? "> " : "  ") + items[i];
        const x = cfg.MENU_ANCHOR_X;
        const y = cfg.MENU_ANCHOR_Y + i * cfg.MENU_LINE_SPACING;

        ctx.shadowColor = "rgb(" + cfg.GLOW_COLOR.join(",") + ")";
        ctx.shadowBlur = selected ? 10 : 5;
        if (selected) ctx.globalAlpha = (200 + pulse * 55) / 255;

        ctx.fillStyle = "rgb(" + color.join(",") + ")";
        ctx.fillText(label, x, y);

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      this._drawTitle();
      if (this.overlay) this._drawOverlay();
    },

    _drawTitle() {
      const text = cfg.TITLE;
      ctx.font = "bold " + cfg.TITLE_FONT_SIZE + "px Consolas, monospace";
      ctx.textBaseline = "alphabetic";
      let total = 0;
      for (const ch of text) total += ctx.measureText(ch).width;
      let x = (RW - total) / 2;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const w = ctx.measureText(ch).width;
        const phase = i * 0.9 + this.t * cfg.TITLE_SWAY_SPEED;
        const dx = Math.sin(phase) * cfg.TITLE_SWAY_X_PX;
        const dy = Math.cos(phase * 0.8) * cfg.TITLE_SWAY_Y_PX;
        ctx.shadowColor = "rgb(" + cfg.GLOW_COLOR.join(",") + ")";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgb(" + cfg.TEXT_COLOR_SELECTED.join(",") + ")";
        ctx.fillText(ch, x + dx, cfg.TITLE_ANCHOR_Y + dy);
        x += w;
      }
      ctx.shadowBlur = 0;
      ctx.textBaseline = "top";
    },

    _drawOverlay() {
      const o = this.overlay;
      const pw = 320, ph = 140;
      const bx = (RW - pw) / 2, by = (RH - ph) / 2;
      ctx.fillStyle = "rgba(3,6,18,0.95)";
      ctx.fillRect(bx, by, pw, ph);
      ctx.strokeStyle = "rgba(90,140,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(110,160,255,0.7)";
      ctx.shadowBlur = 10;
      ctx.strokeRect(bx, by, pw, ph);
      ctx.shadowBlur = 0;

      ctx.font = "bold 16px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgb(" + cfg.TEXT_COLOR_SELECTED.join(",") + ")";
      ctx.fillText(o.ended ? "TRANSMISSION ENDED." : o.question, bx + pw / 2, by + 30);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      if (o.ended) {
        this._drawOverlayButton("BACK TO MENU", bx + pw / 2 - 60, by + 70, 120, 38, () => { this.overlay = null; });
        return;
      }

      o.buttons.forEach((b) => {
        this._drawOverlayButton(b.label, bx + b.x, by + 52, b.w, 38, b.action);
      });
    },

    _drawOverlayButton(label, x, y, w, h, action) {
      ctx.strokeStyle = "rgba(90,140,255,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.font = "bold 15px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hot = logical.x >= x && logical.x <= x + w && logical.y >= y && logical.y <= y + h;
      ctx.fillStyle = hot ? "rgb(235,245,255)" : "rgb(150,190,255)";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    },
  };

  window.__game = game;

  game.init();
  game.start();
})();
