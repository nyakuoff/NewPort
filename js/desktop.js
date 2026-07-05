/* =====================================================================
   NYAKU95 — desktop window manager + chaos engine
   ===================================================================== */
(function () {
  "use strict";

  var desktop   = document.getElementById("desktop");
  var taskBtns  = document.getElementById("task-buttons");
  var startBtn  = document.getElementById("start-btn");
  var startMenu = document.getElementById("start-menu");
  var zTop = 100;

  // fixed 1440x900 design canvas — everything inside #scale-wrap is laid
  // out against these, not the real window size (see CSS for why)
  var DESIGN_W = 1920, DESIGN_H = 1080;

  /* -------------------------------------------------------------
     RESOLUTION SCALING
     ------------------------------------------------------------- */
  var scaleWrap = document.getElementById("scale-wrap");
  var currentScale = 1;
  function applyScale() {
    if (!scaleWrap) return;
    // scale purely by width so the UI actually grows with the screen; the
    // logical canvas height flexes to match whatever that leaves for the
    // real viewport height, so top/bottom-anchored UI (taskbar, icons)
    // always lands exactly on the real edges — never cropped, never barred
    currentScale = window.innerWidth / DESIGN_W;
    DESIGN_H = window.innerHeight / currentScale;
    scaleWrap.style.height = DESIGN_H + "px";
    scaleWrap.style.transform = "translate(-50%, -50%) scale(" + currentScale + ")";
  }
  applyScale();
  window.addEventListener("resize", applyScale);

  // real (post-scale) viewport rect -> logical 1440x900 canvas coordinates
  function toLogical(rect) {
    var w = scaleWrap.getBoundingClientRect();
    return { left: (rect.left - w.left) / currentScale, top: (rect.top - w.top) / currentScale };
  }

  /* -------------------------------------------------------------
     WINDOW REGISTRY
     ------------------------------------------------------------- */
  var windows = {}; // id -> {el, taskBtn, min, prevRect}

  function idFor(key) { return "win-" + key; }

  function registerWindow(el) {
    var key = el.id.replace(/^win-/, "");
    windows[key] = { el: el, taskBtn: null, minimized: false, maximized: false, prevRect: null };
    el.addEventListener("mousedown", function () { focusWindow(key); });
    var titleBar = el.querySelector(".title-bar");
    if (titleBar) {
      // wire control buttons
      el.querySelectorAll(".title-bar-controls button").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          var act = b.getAttribute("data-act");
          if (act === "close") closeWindow(key);
          else if (act === "min") minimizeWindow(key);
          else if (act === "max") toggleMax(key);
        });
      });
      makeDraggable(el, titleBar, key);
      // double-click titlebar = maximize
      titleBar.addEventListener("dblclick", function () { toggleMax(key); });
    } else {
      // chromeless window (e.g. the ipod) — drag from its own graphic, no min/max/close
      makeDraggable(el, el.firstElementChild, key);
    }
  }

  function openWindow(key) {
    var w = windows[key];
    if (!w) return;
    w.el.style.display = "flex";
    w.minimized = false;
    // spawn slightly offset if never positioned yet handled by CSS
    ensureTaskButton(key);
    focusWindow(key);
    // little open "pop"
    w.el.animate(
      [{ transform: "scale(.94)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 120, easing: "ease-out" }
    );
  }

  function closeWindow(key) {
    var w = windows[key];
    if (!w) return;
    w.el.style.display = "none";
    if (w.taskBtn) { w.taskBtn.remove(); w.taskBtn = null; }
  }

  function minimizeWindow(key) {
    var w = windows[key];
    if (!w) return;
    w.el.style.display = "none";
    w.minimized = true;
    if (w.taskBtn) w.taskBtn.classList.remove("active");
  }

  function toggleMax(key) {
    var w = windows[key], el = w.el;
    if (!w.maximized) {
      w.prevRect = { left: el.style.left, top: el.style.top, right: el.style.right,
                     width: el.style.width, height: el.style.height };
      el.style.left = "0px"; el.style.top = "0px"; el.style.right = "auto";
      el.style.width = DESIGN_W + "px"; el.style.height = (DESIGN_H - 34) + "px";
      w.maximized = true;
    } else {
      var r = w.prevRect || {};
      el.style.left = r.left || "120px"; el.style.top = r.top || "60px";
      el.style.right = r.right || "auto";
      el.style.width = r.width || "500px"; el.style.height = r.height || "auto";
      w.maximized = false;
    }
    focusWindow(key);
  }

  function focusWindow(key) {
    var w = windows[key];
    if (!w) return;
    if (w.minimized) { w.el.style.display = "flex"; w.minimized = false; }
    zTop += 1;
    w.el.style.zIndex = zTop;
    w.el.classList.remove("just-focused");
    void w.el.offsetWidth;
    w.el.classList.add("just-focused");
    // active states
    Object.keys(windows).forEach(function (k) {
      var ww = windows[k];
      ww.el.classList.toggle("inactive", k !== key);
      if (ww.taskBtn) ww.taskBtn.classList.toggle("active", k === key);
    });
  }

  /* -------------------------------------------------------------
     TASKBAR BUTTONS
     ------------------------------------------------------------- */
  function ensureTaskButton(key) {
    var w = windows[key];
    if (w.taskBtn) return;
    var el = w.el;
    var title = el.getAttribute("data-title") || key;
    var iconAttr = el.getAttribute("data-icon") || "🗔";
    var btn = document.createElement("div");
    btn.className = "task-btn active";
    var icoHtml = /\.(png|gif|jpg)/i.test(iconAttr)
      ? '<img src="' + iconAttr + '" alt="">'
      : '<span>' + iconAttr + '</span>';
    btn.innerHTML = icoHtml + '<span class="txt">' + title + '</span>';
    btn.addEventListener("click", function () {
      var ww = windows[key];
      if (ww.minimized || ww.el.style.display === "none") { openWindow(key); }
      else if (btn.classList.contains("active")) { minimizeWindow(key); }
      else { focusWindow(key); }
    });
    taskBtns.appendChild(btn);
    w.taskBtn = btn;
  }

  /* -------------------------------------------------------------
     DRAGGING
     ------------------------------------------------------------- */
  function makeDraggable(el, handle, key) {
    if (!handle) return;
    var sx, sy, ox, oy, dragging = false;
    handle.addEventListener("mousedown", function (e) {
      if (e.target.closest(".title-bar-controls, .click-wheel-area, .next-button, .back-button, .menu-button")) return;
      if (windows[key].maximized) return;
      dragging = true;
      el.classList.add("dragging");
      // normalize to left/top positioning, in logical canvas coordinates
      var pos = toLogical(el.getBoundingClientRect());
      el.style.left = pos.left + "px";
      el.style.top = pos.top + "px";
      el.style.right = "auto";
      sx = e.clientX; sy = e.clientY; ox = pos.left; oy = pos.top;
      focusWindow(key);
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - sx) / currentScale;
      var ny = oy + (e.clientY - sy) / currentScale;
      ny = Math.max(0, Math.min(ny, DESIGN_H - 60));
      nx = Math.max(-el.offsetWidth + 80, Math.min(nx, DESIGN_W - 60));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    });
    document.addEventListener("mouseup", function () {
      if (dragging) { dragging = false; el.classList.remove("dragging"); }
    });
  }

  /* -------------------------------------------------------------
     INIT WINDOWS
     ------------------------------------------------------------- */
  document.querySelectorAll(".window").forEach(function (el) {
    if (!/^win-/.test(el.id)) return;
    registerWindow(el);
    // give already-visible windows a taskbar button
    if (getComputedStyle(el).display !== "none") ensureTaskButton(el.id.replace(/^win-/, ""));
  });
  focusWindow("paint");

  // deep-link: #works etc opens that window on load; #sec-xxx scrolls the paint canvas
  var hashKey = location.hash.replace(/^#/, "");
  if (hashKey && windows[hashKey]) openWindow(hashKey);
  if (/^sec-/.test(hashKey)) {
    setTimeout(function () {
      var c = document.getElementById("paint-canvas"), t = document.getElementById(hashKey);
      if (c && t) c.scrollTop = t.offsetTop - 10;
    }, 60);
  }

  /* -------------------------------------------------------------
     PAINT: toolbox + palette + menu scroll
     ------------------------------------------------------------- */
  // real MS Paint tool strip (jspaint classic sprite, 16 tools x 16px)
  var tg = document.getElementById("tool-grid");
  if (tg) {
    for (var ti = 0; ti < 16; ti++) {
      var b = document.createElement("div");
      b.className = "tool" + (ti === 6 ? " on" : "");
      var ic = document.createElement("i");
      ic.style.backgroundPosition = (-ti * 16) + "px 0";
      b.appendChild(ic);
      b.addEventListener("click", (function (btn) {
        return function () {
          tg.querySelectorAll(".tool.on").forEach(function (t) { t.classList.remove("on"); });
          btn.classList.add("on");
        };
      })(b));
      tg.appendChild(b);
    }
  }

  var PAL = ["#000000","#808080","#800000","#808000","#008000","#008080","#000080","#800080",
             "#808040","#004040","#0080ff","#0040a0","#8000ff","#804000",
             "#ffffff","#c0c0c0","#ff0000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff",
             "#ffff80","#00ff80","#80ffff","#8080ff","#ff0080","#ff8040"];
  var sw = document.getElementById("swatches");
  if (sw) {
    PAL.forEach(function (c) {
      var i = document.createElement("i");
      i.style.background = c;
      i.title = c;
      i.addEventListener("click", function () {
        var pc = document.querySelector(".pal-current");
        if (pc) pc.style.background = c;
      });
      sw.appendChild(i);
    });
  }

  // rainbow text = solid web-safe letters (renders on a 256-colour display)
  var RB = ["#ff0000", "#ff6600", "#ffcc00", "#009900", "#0066ff", "#6600cc", "#cc0099"];
  document.querySelectorAll(".rainbow-txt").forEach(function (el) {
    var txt = el.textContent, out = "";
    for (var i = 0; i < txt.length; i++) {
      out += '<i style="color:' + RB[i % RB.length] + '">' + txt[i] + '</i>';
    }
    el.innerHTML = out;
  });

  // menu bar / in-canvas anchor scrolling
  document.querySelectorAll("[data-scroll]").forEach(function (n) {
    n.addEventListener("click", function (e) {
      e.preventDefault();
      var canvas = document.getElementById("paint-canvas");
      var target = document.getElementById(n.getAttribute("data-scroll"));
      if (canvas && target) {
        openWindow("paint");
        canvas.scrollTo({ top: target.offsetTop - 10, behavior: "smooth" });
      }
    });
  });

  /* -------------------------------------------------------------
     OPEN TRIGGERS  (icons, start menu, in-page links)
     ------------------------------------------------------------- */
  function bindOpeners(scope) {
    scope.querySelectorAll("[data-open]").forEach(function (node) {
      if (node.__bound) return; node.__bound = true;
      var handler = function (e) {
        e.preventDefault();
        openWindow(node.getAttribute("data-open"));
        closeStart();
      };
      // desktop icons open on dblclick, everything else on click
      if (node.classList.contains("desk-icon")) {
        node.addEventListener("dblclick", handler);
        node.addEventListener("click", function () { selectIcon(node); });
      } else {
        node.addEventListener("click", handler);
      }
    });
    scope.querySelectorAll("[data-url]").forEach(function (node) {
      if (node.__bound) return; node.__bound = true;
      node.addEventListener("dblclick", function () { spawnPopup(node.getAttribute("data-url")); });
      node.addEventListener("click", function () { selectIcon(node); });
    });
  }
  bindOpeners(document);

  var trollIcon = document.getElementById("troll-icon");
  if (trollIcon) {
    trollIcon.addEventListener("dblclick", function () { spawnTroll(); });
    trollIcon.addEventListener("click", function () { selectIcon(trollIcon); });
  }

  function selectIcon(node) {
    document.querySelectorAll(".desk-icon.selected").forEach(function (n) { n.classList.remove("selected"); });
    node.classList.add("selected");
  }
  desktop.addEventListener("mousedown", function (e) {
    if (e.target === desktop || e.target.id === "icon-layer") {
      document.querySelectorAll(".desk-icon.selected").forEach(function (n) { n.classList.remove("selected"); });
      closeStart();
    }
  });

  /* -------------------------------------------------------------
     START MENU
     ------------------------------------------------------------- */
  function closeStart() { startMenu.classList.remove("open"); startBtn.classList.remove("active"); }
  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    startMenu.classList.toggle("open");
    startBtn.classList.toggle("active");
  });
  document.addEventListener("click", function (e) {
    if (!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)) closeStart();
  });
  document.getElementById("sm-pet").addEventListener("click", function () { petBear(); closeStart(); });
  document.getElementById("sm-shutdown").addEventListener("click", function () { closeStart(); shutdown(); });

  /* -------------------------------------------------------------
     CLOCK
     ------------------------------------------------------------- */
  var clock = document.getElementById("clock");
  function tick() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    clock.textContent = h + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }
  tick(); setInterval(tick, 15000);

  /* -------------------------------------------------------------
     POPUPS  (fake virus warning + image viewer)
     ------------------------------------------------------------- */
  var popupN = 0;
  function spawnPopup(url) {
    var el = document.createElement("div");
    el.className = "window popup";
    el.style.left = (180 + popupN * 26) + "px";
    el.style.top = (140 + popupN * 26) + "px";
    popupN++;
    el.innerHTML =
      '<div class="title-bar"><div class="title-bar-text">⚠ Image Viewer</div>' +
      '<div class="title-bar-controls"><button class="tb-close"></button></div></div>' +
      '<div class="window-body" style="background:#000;text-align:center;padding:4px;">' +
      '<img src="' + url + '" alt="" style="max-width:420px;max-height:60vh;display:block;margin:auto;"></div>';
    desktop.appendChild(el);
    el.style.width = "auto";
    el.querySelector(".tb-close").addEventListener("click", function () { el.remove(); });
    var h = el.querySelector(".title-bar");
    simpleDrag(el, h);
    zTop += 1; el.style.zIndex = zTop;
  }

  /* -------------------------------------------------------------
     DO_NOT_OPEN  (troll — you were warned)
     ------------------------------------------------------------- */
  var trollVideoEl = null;
  function spawnTroll() {
    if (mpAudio && !mpAudio.paused) mpAudio.pause();
    var el = document.createElement("div");
    el.className = "window popup";
    el.style.left = (DESIGN_W / 2 - 210) + "px";
    el.style.top = (DESIGN_H / 2 - 160) + "px";
    el.innerHTML =
      '<div class="title-bar"><div class="title-bar-text">⚠ can_you_blow_my_whistle.exe</div>' +
      '<div class="title-bar-controls"><button class="tb-close"></button></div></div>' +
      '<div class="window-body" style="background:#000;text-align:center;padding:4px;">' +
      '<video src="assets/Josh%20Hutcherson%20Whistle.mp4" autoplay style="width:520px;height:auto;display:block;margin:auto;"></video></div>';
    desktop.appendChild(el);
    el.style.width = "auto";
    var vid = el.querySelector("video");
    vid.volume = 0.25;
    trollVideoEl = vid;
    el.querySelector(".tb-close").addEventListener("click", function () {
      vid.pause(); el.remove(); trollVideoEl = null;
    });
    simpleDrag(el, el.querySelector(".title-bar"));
    zTop += 1; el.style.zIndex = zTop;
  }

  function simpleDrag(el, handle) {
    var sx, sy, ox, oy, on = false;
    handle.addEventListener("mousedown", function (e) {
      if (e.target.closest(".title-bar-controls")) return;
      on = true;
      var pos = toLogical(el.getBoundingClientRect());
      el.style.left = pos.left + "px"; el.style.top = pos.top + "px"; el.style.right = "auto";
      sx = e.clientX; sy = e.clientY; ox = pos.left; oy = pos.top;
      zTop += 1; el.style.zIndex = zTop; e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!on) return;
      el.style.left = (ox + (e.clientX - sx) / currentScale) + "px";
      el.style.top = Math.max(0, oy + (e.clientY - sy) / currentScale) + "px";
    });
    document.addEventListener("mouseup", function () { on = false; });
  }

  /* -------------------------------------------------------------
     PET THE BEAR  (easter egg)
     ------------------------------------------------------------- */
  var pets = 0;
  function petBear() {
    pets++;
    var b = document.createElement("div");
    b.className = "window popup";
    b.style.left = (DESIGN_W / 2 - 150) + "px";
    b.style.top = (DESIGN_H / 2 - 120) + "px";
    var msg = pets === 1 ? "you pet the bear. the bear is pleased. 🐻"
            : pets < 5 ? "the bear has been pet " + pets + " times. it purrs (?)."
            : pets < 10 ? "ok that's " + pets + " pets. the bear is now your friend for life."
            : "the bear has ascended. " + pets + " pets. you did this. 🐻✨";
    b.innerHTML =
      '<div class="title-bar"><div class="title-bar-text">🐻 bear.exe</div>' +
      '<div class="title-bar-controls"><button class="tb-close"></button></div></div>' +
      '<div class="window-body center"><img src="assets/bear.png" alt="" style="width:120px;" class="wob">' +
      '<p>' + msg + '</p><button class="btn again">pet again</button></div>';
    desktop.appendChild(b);
    b.style.width = "300px";
    zTop += 1; b.style.zIndex = zTop;
    b.querySelector(".tb-close").addEventListener("click", function () { b.remove(); });
    b.querySelector(".again").addEventListener("click", function () { b.remove(); petBear(); });
    simpleDrag(b, b.querySelector(".title-bar"));
  }

  /* -------------------------------------------------------------
     SHUT DOWN
     ------------------------------------------------------------- */
  function shutdown() {
    var s = document.createElement("div");
    s.style.cssText = "position:fixed;inset:0;background:#000;z-index:99999;color:#fff;" +
      "display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;" +
      "font-family:'PixelOperator',monospace;font-size:22px;cursor:pointer;";
    s.innerHTML = "<div style='color:#ffb000'>It's now safe to turn off<br>your computer.</div>" +
      "<div style='font-size:13px;margin-top:24px;color:#888'>(jk. click anywhere to come back ♡)</div>";
    document.body.appendChild(s);
    s.addEventListener("click", function () {
      s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = function () { s.remove(); };
    });
  }

  /* -------------------------------------------------------------
     MEDIA PLAYER  (one song, hardcoded by nyaku — no visitor choice)
     to swap the song: drop the new mp3 in assets/medias/ and rename
     MP_FILENAME below to match it exactly (keep "Title - Artist.mp3"
     so the cover-art lookup keeps working)
     ------------------------------------------------------------- */
  var MP_FILENAME = "Punkrocker - Teddybears.mp3";
  var mpAudio = document.getElementById("mp-audio");
  if (mpAudio) {
    var mpPlay = document.getElementById("mp-play");
    var mpStop = document.getElementById("mp-stop");
    var mpNext = document.getElementById("mp-next");
    var mpPrev = document.getElementById("mp-prev");
    var mpPlayIcon = document.getElementById("play-icon");
    var mpTrack = document.getElementById("mp-track");
    var mpArtist = document.getElementById("mp-artist");
    var mpCover = document.getElementById("mp-cover-img");
    var mpCur = document.getElementById("mp-cur");
    var mpDur = document.getElementById("mp-dur");
    var mpFill = document.getElementById("mp-progress-fill");
    var mpProgress = document.getElementById("mp-progress");
    var mpVolHud = document.getElementById("mp-vol-hud");
    var ipodEl = document.querySelector("#win-player .ipod-container");

    function fmtTime(s) {
      if (!isFinite(s) || s < 0) s = 0;
      var m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return m + ":" + (sec < 10 ? "0" + sec : sec);
    }

    var mpBase = MP_FILENAME.replace(/\.[^.]+$/, "");
    var mpParts = mpBase.split(/\s*-\s*/);
    mpTrack.textContent = mpParts[0] || mpBase;
    mpArtist.textContent = mpParts[1] || "";
    mpAudio.src = "assets/medias/" + MP_FILENAME;
    mpAudio.volume = 0.15;

    // scroll the wheel to adjust volume, real-iPod style — shows a brief HUD
    var volHudTimer;
    if (ipodEl && mpVolHud) {
      ipodEl.addEventListener("wheel", function (e) {
        e.preventDefault();
        mpAudio.volume = Math.min(1, Math.max(0, mpAudio.volume + (e.deltaY < 0 ? 0.05 : -0.05)));
        mpVolHud.textContent = "VOLUME " + Math.round(mpAudio.volume * 100) + "%";
        mpVolHud.classList.add("show");
        clearTimeout(volHudTimer);
        volHudTimer = setTimeout(function () { mpVolHud.classList.remove("show"); }, 1500);
      }, { passive: false });
    }

    mpAudio.addEventListener("error", function () {
      mpTrack.textContent = "no song loaded yet";
    });

    // fetch real cover art via iTunes Search (JSONP, no key/CORS needed)
    (function fetchCover(term) {
      var cbName = "mpCoverCb" + Date.now();
      var script = document.createElement("script");
      window[cbName] = function (data) {
        delete window[cbName];
        script.remove();
        if (data && data.resultCount > 0 && data.results[0].artworkUrl100) {
          mpCover.src = data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
        }
      };
      script.onerror = function () { delete window[cbName]; script.remove(); };
      script.src = "https://itunes.apple.com/search?media=music&limit=1&callback=" + cbName +
        "&term=" + encodeURIComponent(term);
      document.body.appendChild(script);
    })(mpBase.replace(/-/g, " "));

    // click-wheel-area = play/pause, next/back = seek 10s, menu = stop
    mpPlay.addEventListener("click", function () {
      if (mpAudio.paused) mpAudio.play(); else mpAudio.pause();
    });
    mpStop.addEventListener("click", function () {
      mpAudio.pause(); mpAudio.currentTime = 0;
    });
    mpNext.addEventListener("click", function () {
      mpAudio.currentTime = Math.min(mpAudio.duration || 0, mpAudio.currentTime + 10);
    });
    mpPrev.addEventListener("click", function () {
      mpAudio.currentTime = Math.max(0, mpAudio.currentTime - 10);
    });

    mpAudio.addEventListener("play", function () { mpPlayIcon.textContent = "❚❚"; });
    mpAudio.addEventListener("pause", function () { mpPlayIcon.textContent = "▶"; });
    mpAudio.addEventListener("loadedmetadata", function () {
      mpDur.textContent = "-" + fmtTime(mpAudio.duration);
    });
    mpAudio.addEventListener("timeupdate", function () {
      mpCur.textContent = fmtTime(mpAudio.currentTime);
      mpDur.textContent = "-" + fmtTime(mpAudio.duration - mpAudio.currentTime);
      var pct = mpAudio.duration ? (mpAudio.currentTime / mpAudio.duration) * 100 : 0;
      mpFill.style.width = pct + "%";
    });
    mpProgress.addEventListener("click", function (e) {
      if (!mpAudio.duration) return;
      var r = mpProgress.getBoundingClientRect();
      var pct = (e.clientX - r.left) / r.width;
      mpAudio.currentTime = pct * mpAudio.duration;
    });
  }

  /* -------------------------------------------------------------
     BI HEART  (click to play the meme sound)
     ------------------------------------------------------------- */
  var heartBtn = document.getElementById("lgbt-heart-btn");
  if (heartBtn) {
    var heartSound = new Audio("assets/bibuttonmeme.ogg");
    heartBtn.addEventListener("click", function () {
      if (trollVideoEl && !trollVideoEl.paused) trollVideoEl.pause();
      if (mpAudio && !mpAudio.paused) mpAudio.pause();
      heartSound.currentTime = 0;
      heartSound.play();
    });
  }

  /* -------------------------------------------------------------
     CURSOR-TRAIL SPARKLES
     ------------------------------------------------------------- */
  var lastTrail = 0;
  document.addEventListener("mousemove", function (e) {
    var now = Date.now();
    if (now - lastTrail < 55) return;
    lastTrail = now;
    var t = document.createElement("div");
    t.className = "trail";
    t.style.left = (e.clientX - 5) + "px";
    t.style.top = (e.clientY - 5) + "px";
    document.body.appendChild(t);
    t.animate(
      [{ opacity: 1, transform: "scale(1) rotate(0deg)" },
       { opacity: 0, transform: "scale(.2) rotate(90deg)" }],
      { duration: 650, easing: "ease-out" }
    ).onfinish = function () { t.remove(); };
  });

  /* -------------------------------------------------------------
     APP SPARKLES  (real sparkle gif twinkles on open app title bars)
     ------------------------------------------------------------- */
  function spawnSparkle(container, x, y) {
    var spark = document.createElement("img");
    spark.src = "assets/littlesparkle.gif";
    spark.className = "app-sparkle";
    spark.style.left = x + "px";
    spark.style.top = y + "px";
    container.appendChild(spark);
    setTimeout(function () { spark.remove(); }, 1300);
  }

  setInterval(function () {
    var bars = document.querySelectorAll(".window .title-bar");
    bars.forEach(function (bar) {
      var win = bar.closest(".window");
      if (!win || win.style.display === "none") return;
      spawnSparkle(bar, 8 + Math.random() * Math.max(0, bar.clientWidth - 60), -6);
    });
    document.querySelectorAll(".desk-icon").forEach(function (icon) {
      if (Math.random() > 0.25) return;
      spawnSparkle(icon, 4 + Math.random() * (icon.clientWidth - 32), Math.random() * 20);
    });
  }, 1400);

})();
