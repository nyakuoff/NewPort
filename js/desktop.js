/* =====================================================================
   nyaku 7 — window manager, explorer, start menu, wmp, logon.
   content (works, games, song) lives in js/content.js
   ===================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(v, hi)); };
  var desktop = $("#desktop");
  var works = window.WORKS || [], games = window.GAMES || [];
  var coarse = matchMedia("(pointer: coarse)").matches;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;


  /* -------------------------------------------------------------
     CROSS-ORIGIN ISOLATION — some web games (SharedArrayBuffer) only run
     when the page around them is isolated. github pages can't send the
     COOP/COEP headers, so sw.js adds them. only in browsers that support
     credentialless iframes, otherwise isolation would block every game
     that doesn't opt in.
     ------------------------------------------------------------- */
  var canIsolate = "credentialless" in HTMLIFrameElement.prototype && "serviceWorker" in navigator && window.isSecureContext;
  if (canIsolate && !window.crossOriginIsolated) {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      var reloaded;
      try { reloaded = sessionStorage.getItem("coi-reload"); sessionStorage.setItem("coi-reload", "1"); } catch (e) { reloaded = "1"; }
      if (reloaded) return; // never loop if the headers still don't stick
      if (navigator.serviceWorker.controller) location.reload();
      else navigator.serviceWorker.addEventListener("controllerchange", function () { location.reload(); });
    }).catch(function () {});
  }

  // every click on anything clickable plays the click (text boxes and sliders stay quiet)
  var CLICKABLE = "button, a, [data-open], [data-goto], [data-play], [data-place], [data-sort], [data-genre], [data-page], .desk-icon, .file, .refresh, #slideshow, #balloon";
  document.addEventListener("click", function (e) {
    if (e.target.closest(CLICKABLE)) sfx("click");
  }, true);

  // win7 default sound scheme
  function sfx(name) {
    var a = new Audio("assets/sfx/" + name + ".mp3");
    a.volume = 0.6;
    a.play().catch(function () {});
  }

  /* -------------------------------------------------------------
     SCALING — logical canvas is at least 1536x864 (125% dpi at 1080p)
     ------------------------------------------------------------- */
  var wrap = $("#scale-wrap"), scale = 1;
  function fit() {
    scale = Math.min(innerWidth / 1536, innerHeight / 864);
    wrap.style.width = innerWidth / scale + "px";
    wrap.style.height = innerHeight / scale + "px";
    wrap.style.transform = "scale(" + scale + ")";
  }
  fit();
  addEventListener("resize", fit);

  // pointer drag with capture, so iframes can't swallow the move events
  function drag(handle, start, move, end) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || start(e) === false) return;
      var x0 = e.clientX, y0 = e.clientY;
      handle.setPointerCapture(e.pointerId);
      document.body.classList.add("dragging");
      function mv(ev) { move((ev.clientX - x0) / scale, (ev.clientY - y0) / scale); }
      function up(ev) {
        handle.removeEventListener("pointermove", mv);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        document.body.classList.remove("dragging");
        if (end) end(ev);
      }
      handle.addEventListener("pointermove", mv);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
      e.preventDefault();
    });
  }

  /* -------------------------------------------------------------
     WINDOWS
     ------------------------------------------------------------- */
  var wins = {}, z = 10;
  var taskBar = $("#task-buttons");
  var INTERACTIVE = "button, input, a, textarea, .crumb, .ie-address, .ie-tab, .searchbox";

  function bigIcon(el) { return el.dataset.bigicon || el.dataset.icon.replace(/-16\.png$/, ".png"); }

  function setMax(el, on) {
    el.classList.toggle("max", on);
    var b = $(".title-bar-controls [aria-label=Maximize], .title-bar-controls [aria-label=Restore]", el);
    if (b) b.setAttribute("aria-label", on ? "Restore" : "Maximize");
  }

  function navRow(el) {
    var parts = el.dataset.crumb.split(","), row = document.createElement("div");
    row.className = "ex-nav";
    row.innerHTML = '<button class="round back" disabled aria-label="Back">&#8592;</button><button class="round fwd" disabled aria-label="Forward">&#8594;</button>' +
      '<div class="crumb"><img src="' + esc(el.dataset.icon) + '" alt="">' +
      parts.map(function (p) { return '<span class="sep">&#9654;&#xFE0E;</span><a>' + esc(p) + "</a>"; }).join("") +
      '<span class="grow"></span><span class="refresh">&#8635;</span></div>' +
      '<div class="searchbox"><input type="search" placeholder="Search ' + esc(parts[parts.length - 1]) + '" aria-label="Search"><button aria-label="search"></button></div>';
    return row;
  }

  function register(el) {
    var key = el.id.slice(4), dialog = el.classList.contains("dialog");
    var bar = document.createElement("div");
    bar.className = "title-bar";
    bar.innerHTML = '<div class="title-bar-text">' +
      ("notext" in el.dataset ? "" : (el.dataset.icon ? '<img src="' + esc(el.dataset.icon) + '" alt="">' : "") + esc(el.dataset.title)) +
      '</div><div class="title-bar-controls">' +
      (dialog ? "" : '<button aria-label="Minimize"></button><button aria-label="Maximize"></button>') +
      '<button aria-label="Close"></button></div>';
    el.prepend(bar);
    if (el.dataset.crumb) bar.after(navRow(el));
    wins[key] = { el: el, btn: null, open: false, min: false };

    el.addEventListener("pointerdown", function () { focus(key); });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var act = b.getAttribute("aria-label");
      if (act === "Close") close(key);
      else if (act === "Minimize") minimize(key);
      else setMax(el, !el.classList.contains("max"));
    });
    if (!dialog) bar.addEventListener("dblclick", function (e) { if (!e.target.closest("button")) setMax(el, !el.classList.contains("max")); });
    $$("[data-close]", el).forEach(function (b) { b.addEventListener("click", function () { close(key); }); });

    // move from the title bar or any empty glass (ie bar, explorer nav row)
    [bar].concat($$(".ie-bar, .ex-nav", el)).forEach(function (h) {
      var ox, oy;
      drag(h, function (e) {
        if (e.target.closest(INTERACTIVE)) return false;
        if (el.classList.contains("max") || el._snap) {
          // win7: dragging a maximized/snapped window restores it under the cursor
          var px = e.clientX / scale, ratio = (px - el.offsetLeft) / el.offsetWidth, r = el._prev || {};
          setMax(el, false);
          el._snap = false;
          if (r.w) { el.style.width = r.w + "px"; el.style.height = r.h + "px"; }
          el.style.left = px - el.offsetWidth * ratio + "px";
          el.style.top = "0px";
        }
        ox = el.offsetLeft; oy = el.offsetTop;
      }, function (dx, dy) {
        el.style.left = clamp(ox + dx, 80 - el.offsetWidth, desktop.clientWidth - 80) + "px";
        el.style.top = clamp(oy + dy, 0, desktop.clientHeight - 30) + "px";
      }, function (ev) {
        if (dialog) return;
        // aero snap: top edge = maximize, side edges = half screen
        var x = ev.clientX / scale, y = ev.clientY / scale, W = desktop.clientWidth, H = desktop.clientHeight;
        if (y <= 2) { el._prev = { w: el.offsetWidth, h: el.offsetHeight }; setMax(el, true); }
        else if (x <= 2 || x >= W - 2) {
          el._prev = { w: el.offsetWidth, h: el.offsetHeight };
          el._snap = true;
          el.style.top = "0px"; el.style.height = H + "px"; el.style.width = W / 2 + "px";
          el.style.left = (x <= 2 ? 0 : W / 2) + "px";
        }
      });
    });

    // resize from any edge or corner
    if (!dialog) ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach(function (d) {
      var h = document.createElement("div"), r;
      h.className = "rz " + d;
      el.appendChild(h);
      drag(h, function () {
        if (el.classList.contains("max")) return false;
        el._snap = false;
        r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      }, function (dx, dy) {
        var minW = 320, minH = 200;
        if (d.indexOf("e") > -1) el.style.width = Math.max(minW, r.w + dx) + "px";
        if (d.indexOf("s") > -1) el.style.height = Math.max(minH, r.h + dy) + "px";
        if (d.indexOf("w") > -1) { var w = Math.max(minW, r.w - dx); el.style.width = w + "px"; el.style.left = r.x + r.w - w + "px"; }
        if (d.indexOf("n") > -1) { var hh = Math.max(minH, r.h - dy); el.style.height = hh + "px"; el.style.top = Math.max(0, r.y + r.h - hh) + "px"; }
      });
    });
  }

  function taskBtn(key) {
    var b = $('.task-btn[data-key="' + key + '"]', taskBar);
    if (!b) {
      b = document.createElement("button");
      b.className = "task-btn";
      b.dataset.key = key;
      b.title = wins[key].el.dataset.title;
      b.innerHTML = '<img src="' + esc(bigIcon(wins[key].el)) + '" alt="">';
      taskBar.appendChild(b);
    }
    return b;
  }

  function anim(el, kind, done) {
    if (reduce) { if (done) done(); return; }
    var frames = {
      open: [{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }],
      close: [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.95)" }],
      min: [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(35%) scale(.4)" }],
      restore: [{ opacity: 0, transform: "translateY(35%) scale(.4)" }, { opacity: 1, transform: "none" }]
    }[kind];
    var a = el.animate(frames, { duration: kind === "close" ? 120 : 170, easing: "ease-out" });
    if (done) a.onfinish = done;
  }

  function focus(key) {
    var w = wins[key];
    if (w && w.el.style.zIndex != z) w.el.style.zIndex = ++z;
    Object.keys(wins).forEach(function (k) {
      wins[k].el.classList.toggle("active", k === key);
      if (wins[k].btn) wins[k].btn.classList.toggle("on", k === key);
    });
  }
  // after a close/minimize, activate whatever is on top (like windows does)
  function focusTop() {
    var top = null;
    Object.keys(wins).forEach(function (k) {
      var w = wins[k];
      if (w.open && !w.min && (!top || +w.el.style.zIndex > +wins[top].el.style.zIndex)) top = k;
    });
    focus(top);
  }

  function open(key) {
    if (actions[key]) return actions[key]();
    if (folders[key]) { navigate(key); key = "explorer"; }
    var w = wins[key];
    if (!w) return;
    if (w.min) return restore(key);
    if (!w.open) {
      w.open = true;
      w.el.hidden = false;
      anim(w.el, "open");
      if (!w.el.classList.contains("dialog")) {
        w.btn = taskBtn(key);
        w.btn.classList.add("running");
      }
    }
    focus(key);
  }

  function minimize(key) {
    var w = wins[key];
    if (!w || !w.open || w.min) return;
    w.min = true;
    w.btn.classList.remove("on");
    anim(w.el, "min", function () { if (w.min) w.el.hidden = true; });
    focusTop();
  }

  function restore(key) {
    var w = wins[key];
    if (!w || !w.min) return;
    w.min = false;
    w.el.hidden = false;
    anim(w.el, "restore");
    focus(key);
  }

  function close(key) {
    var w = wins[key];
    if (!w || !w.open) return;
    w.open = false; w.min = false;
    if (w.btn) {
      if ("pinned" in w.btn.dataset) w.btn.classList.remove("running", "on");
      else w.btn.remove();
      w.btn = null;
    }
    if (w.onclose) w.onclose();
    if (key === "player") audio.pause();
    // temp windows leave the registry now, so reopening never finds a half-closed one
    if (w.el.dataset.temp) delete wins[key];
    anim(w.el, "close", function () {
      w.el.hidden = true;
      if (w.el.dataset.temp) w.el.remove();
    });
    focusTop();
  }

  // builds a throwaway window (work pages, games, dialogs) and opens it
  var cascade = 0;
  function spawn(key, title, icon, html, o) {
    if (wins[key]) { open(key); return null; }
    var el = document.createElement("div"), dw = desktop.clientWidth, dh = desktop.clientHeight;
    var w = Math.min(o.w, dw - 20), h = o.h && Math.min(o.h, dh - 20), c = cascade++ % 5;
    el.id = "win-" + key;
    el.className = "window glass " + (o.cls || "");
    el.dataset.title = title;
    el.dataset.icon = icon;
    el.dataset.temp = 1;
    if (o.notext) el.dataset.notext = "";
    if (o.bigIcon) el.dataset.bigicon = o.bigIcon;
    el.style.width = w + "px";
    if (h) el.style.height = h + "px";
    el.innerHTML = html;
    desktop.appendChild(el);
    register(el);
    var eh = el.offsetHeight, off = o.cls && o.cls.indexOf("dialog") > -1 ? 0 : c * 26 - 50;
    el.style.left = clamp((dw - w) / 2 + off, 0, dw - w) + "px";
    el.style.top = clamp((dh - eh) / 2 + off, 0, Math.max(0, dh - eh)) + "px";
    if (o.onclose) wins[key].onclose = o.onclose;
    open(key);
    return el;
  }

  $$("#desktop > .window").forEach(register);

  // clicking into an iframe doesn't bubble out, so catch it via blur
  addEventListener("blur", function () {
    setTimeout(function () {
      var f = document.activeElement, w = f && f.tagName === "IFRAME" && f.closest(".window");
      if (w) focus(w.id.slice(4));
    });
  });

  taskBar.addEventListener("click", function (e) {
    var b = e.target.closest(".task-btn");
    if (!b) return;
    var key = b.dataset.key, w = wins[key];
    if (key === "explorer" && !w.open) launch("works");
    else if (!w.open) launch(key);
    else if (w.min) open(key);
    else if (b.classList.contains("on")) minimize(key);
    else focus(key);
  });

  /* -------------------------------------------------------------
     DIALOGS
     ------------------------------------------------------------- */
  var msgN = 0;
  function msgbox(title, img, html, btns, sound) {
    var key = "msg" + msgN++;
    var el = spawn(key, title, "", '<div class="window-body" style="padding:0">' +
      '<div class="msg-body">' + img + "<div>" + html + "</div></div>" +
      '<div class="msg-btns">' + btns.map(function (b, i) { return '<button data-i="' + i + '"' + (i ? "" : ' class="default"') + ">" + esc(b.label) + "</button>"; }).join("") + "</div></div>",
      { w: 400, cls: "dialog" });
    $(".msg-btns", el).addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      close(key);
      if (btns[b.dataset.i].fn) btns[b.dataset.i].fn();
    });
    $(".msg-btns .default", el).focus();
    sfx(sound || "ding");
  }

  /* -------------------------------------------------------------
     EXPLORER — one window that navigates between my_works, Games and
     the Recycle Bin in place, with working back/forward
     ------------------------------------------------------------- */
  var TREE = [
    ["", "", "Favorites", 1],
    ["blog", "img/icons/ie-16.png", "nyaku's homepage"],
    ["contact", "img/icons/mail-16.png", "contact me"],
    ["", "img/icons/documents-16.png", "Libraries", 1],
    ["works", "img/icons/folder-16.png", "my_works"],
    ["games", "img/icons/games-16.png", "Games"],
    ["player", "img/icons/music-16.png", "Music"],
    ["computer", "img/icons/computer-16.png", "Computer", 1],
    ["recycle", "img/icons/recycle-16.png", "Recycle Bin", 1]
  ];
  var binFull = true;
  var folders = {
    works: {
      title: "my_works", icon: "img/icons/folder-16.png", crumb: ["nyaku", "my_works"],
      cmds: "<button>Organize &#9662;</button><button>Share with &#9662;</button><button>Slide show</button><button>New folder</button>",
      items: function () {
        return works.map(function (w, i) {
          return { name: w.title, img: w.thumb, thumb: true, open: function () { openWork(i); },
            rows: [["Role:", w.role], ["Platform:", w.where || "-"], ["Type:", "nyaku project"]] };
        });
      }
    },
    games: {
      title: "Games", icon: "img/icons/games-16.png", crumb: ["nyaku", "Games"],
      cmds: "<button>Organize &#9662;</button><button>Options</button><button>Tools &#9662;</button><button>Parental Controls</button>",
      items: function () {
        return games.map(function (g, i) {
          return { name: g.name, img: g.icon || "img/icons/app.png", shortcut: true, open: function () { openGame(i); },
            rows: [["Type:", "Shortcut"], ["Target:", g.url]] };
        });
      }
    },
    recycle: {
      title: "Recycle Bin", crumb: ["Recycle Bin"],
      icon: function () { return binFull ? "img/icons/recycle-full-16.png" : "img/icons/recycle-16.png"; },
      cmds: '<button>Organize &#9662;</button><button data-cmd="empty">Empty the Recycle Bin</button><button data-cmd="restore">Restore all items</button>',
      count: function () { return binFull ? 3 : 0; },
      table: function () {
        return '<table class="has-shadow"><thead><tr><th>Name</th><th>Original Location</th><th>Date Deleted</th><th>Size</th><th>Item type</th></tr></thead><tbody>' + (binFull ?
          '<tr><td><img src="img/icons/app-16.png" alt="">professionalism.dll</td><td>C:\\Users\\nyaku\\brain</td><td>8/14/2007 3:00 AM</td><td>1 KB</td><td>Application extension</td></tr>' +
          '<tr><td><img src="img/icons/text-16.png" alt="">sleep_schedule.bak</td><td>C:\\Users\\nyaku\\life</td><td>1/1/2019 4:12 AM</td><td>0 KB</td><td>BAK File</td></tr>' +
          '<tr><td><img src="img/icons/folder-16.png" alt="">67 unfinished projects</td><td>C:\\Users\\nyaku\\ideas</td><td>yesterday</td><td>6.7 GB</td><td>File folder</td></tr>' : "") +
          "</tbody></table>";
      }
    }
  };

  var exEl = $("#win-explorer"), exView = $("#ex-view"), exDetails = $("#ex-details"), exSearch = $("#ex-search");
  var exBack = $(".ex-nav .back", exEl), exFwd = $(".ex-nav .fwd", exEl);
  var exCur = null, exHist = [], exPos = -1;
  $("#ex-tree").innerHTML = TREE.map(function (t) {
    var ico = t[1] ? '<img src="' + t[1] + '" alt="">' : '<span class="star">&#9733;</span>';
    return "<a" + (t[0] ? ' data-open="' + t[0] + '"' : "") + ' class="' + (t[3] ? "top" : "") + '" data-node="' + t[0] + '">' + ico + t[2] + "</a>";
  }).join("");

  function iconOf(f) { return typeof f.icon === "function" ? f.icon() : f.icon; }
  function exIdle() {
    var f = folders[exCur], n = f.count ? f.count() : f.items().length;
    exDetails.innerHTML = '<div class="d-ico"><img src="' + bigIcon(exEl) + '" alt=""></div><div class="d-name">' + n + " item" + (n === 1 ? "" : "s") + "</div>";
  }

  function navigate(key, fromHistory) {
    var f = folders[key];
    if (!fromHistory && key !== exCur) {
      exHist = exHist.slice(0, exPos + 1).concat(key);
      exPos = exHist.length - 1;
    }
    exCur = key;
    exEl.dataset.title = f.title;
    exEl.dataset.icon = iconOf(f);
    var btn = wins.explorer && wins.explorer.btn;
    if (btn) { $("img", btn).src = bigIcon(exEl); btn.title = f.title; }
    $("#ex-crumb-ico").src = iconOf(f);
    $("#ex-crumb").innerHTML = f.crumb.map(function (p) { return '<span class="sep">&#9654;&#xFE0E;</span><a>' + esc(p) + "</a>"; }).join("");
    exSearch.value = "";
    exSearch.placeholder = "Search " + f.title;
    $("#ex-cmds").innerHTML = f.cmds + '<span class="grow"></span><button title="Change your view">&#9638; &#9662;</button>';
    $$("#ex-tree a").forEach(function (a) { a.classList.toggle("on", a.dataset.node === key); });
    exBack.disabled = exPos <= 0;
    exFwd.disabled = exPos >= exHist.length - 1;

    if (f.table) {
      exView.className = "ex-view details-view has-scrollbar";
      exView.innerHTML = f.table();
    } else {
      exView.className = "ex-view files has-scrollbar";
      exView.innerHTML = "";
      var items = f.items();
      if (!items.length) exView.innerHTML = '<div class="empty">This folder is empty.</div>';
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.className = "file" + (it.shortcut ? " shortcut" : "");
        b.innerHTML = '<span class="ico"><img src="' + esc(it.img) + '" alt=""' + (it.thumb ? ' class="thumb"' : "") + "></span><span>" + esc(it.name) + "</span>";
        function go() { it.open(); }
        b.addEventListener("click", function () {
          $$(".file.selected", exView).forEach(function (x) { x.classList.remove("selected"); });
          b.classList.add("selected");
          exDetails.innerHTML = '<div class="d-ico"><img src="' + esc(it.img) + '" alt=""' + (it.thumb ? ' class="thumb"' : "") + "></div>" +
            '<div><div class="d-name">' + esc(it.name) + '</div><div class="d-grid">' +
            it.rows.map(function (r) { return "<b>" + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span>"; }).join("") + "</div></div>";
          if (coarse) go();
        });
        b.addEventListener("dblclick", go);
        b.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
        exView.appendChild(b);
      });
    }
    exIdle();
  }

  exBack.addEventListener("click", function () { if (exPos > 0) { navigate(exHist[--exPos], true); } });
  $(".crumb .refresh", exEl).addEventListener("click", function () { if (exCur) { navigate(exCur, true); } });
  exFwd.addEventListener("click", function () { if (exPos < exHist.length - 1) { navigate(exHist[++exPos], true); } });
  exView.addEventListener("click", function (e) {
    if (e.target !== exView) return;
    $$(".file.selected", exView).forEach(function (x) { x.classList.remove("selected"); });
    exIdle();
  });
  // search box filters the current folder as you type
  exSearch.addEventListener("input", function () {
    var q = exSearch.value.trim().toLowerCase();
    $$(".file, tbody tr", exView).forEach(function (x) { x.hidden = q && x.textContent.toLowerCase().indexOf(q) < 0; });
  });
  $("#ex-cmds").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cmd]");
    if (!b) return;
    if (b.dataset.cmd === "restore") {
      msgbox("Recycle Bin", '<img class="big" src="img/icons/recycle-full.png" alt="">', "<p>nope. some things should stay deleted.</p>", [{ label: "OK" }]);
    } else if (binFull) {
      msgbox("Delete Multiple Items", '<img class="big" src="img/icons/recycle-full.png" alt="">',
        "<p>Are you sure you want to permanently delete these 3 items?</p><p>(nothing of value will be lost.)</p>",
        [{ label: "Yes", fn: function () {
          binFull = false;
          sfx("recycle");
          $$(".recycle-ico").forEach(function (i) { i.src = "img/icons/recycle.png"; });
          if (exCur === "recycle") navigate("recycle", true);
        } }, { label: "No" }], "notify");
    }
  });
  // a fresh window starts a fresh history
  wins.explorer.onclose = function () { exHist = []; exPos = -1; exCur = null; };

  /* -------------------------------------------------------------
     WORK PAGES (ie9) + GAMES (app windows)
     ------------------------------------------------------------- */
  var SITE = "http://www.nyakuverse.net/";
  // embedded third-party frames load "credentialless" so they still work when the page is cross-origin isolated
  var FRAME = (canIsolate ? " credentialless" : "");
  function ieBar(url, tab) {
    return '<div class="ie-bar"><button class="round back" disabled aria-label="Back">&#8592;</button><button class="round fwd" disabled aria-label="Forward">&#8594;</button>' +
      '<div class="ie-address"><img src="img/icons/ie-16.png" alt=""><span>' + esc(url) + '</span><button class="ie-refresh" aria-label="Refresh">&#8635;</button></div>' +
      '<div class="ie-tab"><img src="assets/nyaku_pixelartpfp.gif" alt=""><span>' + esc(tab) + "</span><i>&times;</i></div>" +
      '<div class="ie-tools"><a data-open="blog" title="Home">&#8962;</a><a title="Favorites">&#9734;</a><a title="Tools">&#9881;</a></div></div>';
  }

  function openWork(i) {
    var w = works[i], slug = w.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    var paras = String(w.desc || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    spawn("work" + i, w.title + " - Windows Internet Explorer", "img/icons/ie-16.png",
      ieBar(SITE + "works/" + slug + ".html", w.title + " - nyakuverse") +
      '<div class="window-body viewport has-scrollbar"><div class="aero permalink"><section class="panel">' +
      "<h2>" + esc(w.title) + '<a class="more" data-open="works">all works &raquo;</a></h2><div class="panel-body">' +
      '<img class="hero" src="' + esc(w.thumb) + '" alt="">' +
      '<div class="meta"><span class="pill">' + esc(w.role) + "</span>" + (w.where ? '<span class="pill green">' + esc(w.where) + "</span>" : "") + "</div>" +
      paras +
      (w.embed ? '<iframe class="embed" src="' + esc(w.embed) + '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen' + FRAME + "></iframe>" : "") +
      '<div class="actions">' + (w.link ? '<a class="gel green" href="' + esc(w.link) + '" target="_blank" rel="noopener">Visit &raquo;</a>' : "") + '<a class="gel" data-close data-open="blog">&laquo; Back to home</a></div>' +
      "</div></section></div></div>",
      { w: 900, h: 720, notext: true, bigIcon: "img/icons/ie.png" });
  }

  function openGame(i) {
    var g = games[i], icon = g.icon || "img/icons/app.png";
    // a normal 1280x720 window (or the game's own w/h), shrunk to fit if the screen is smaller
    var gw = g.w || 1280, gh = g.h || 720;
    var k = Math.min(1, (desktop.clientWidth - 40) / gw, (desktop.clientHeight - 60) / gh);
    gw = Math.round(gw * k); gh = Math.round(gh * k);
    var el = spawn("game" + i, g.name, icon,
      '<div class="window-body game-body"><iframe src="' + esc(g.url) + '" title="' + esc(g.name) + '"' +
      ' allow="autoplay; fullscreen; gamepad; clipboard-write; cross-origin-isolated" allowfullscreen' + FRAME + "></iframe></div>",
      { w: gw + 20, h: gh + 50, bigIcon: icon });
    if (!el) return;
    var frame = $("iframe", el);
    // size the window so the game area is exactly gw x gh, then re-center
    el.style.width = el.offsetWidth + gw - frame.clientWidth + "px";
    el.style.height = el.offsetHeight + gh - frame.clientHeight + "px";
    el.style.left = Math.max(0, (desktop.clientWidth - el.offsetWidth) / 2) + "px";
    el.style.top = Math.max(0, (desktop.clientHeight - el.offsetHeight) / 2) + "px";
  }

  /* -------------------------------------------------------------
     THE BLOG
     ------------------------------------------------------------- */
  var blogView = $("#blog-view"), ieUrl = $("#ie-url");
  function goto(id) {
    open("blog");
    var t = id === "top" ? null : document.getElementById(id);
    blogView.scrollTo({ top: t ? t.offsetTop - 20 : 0, behavior: reduce ? "auto" : "smooth" });
    ieUrl.textContent = SITE + (t ? "#" + id : "");
    }

  var set = $("#work-set");
  works.forEach(function (w, i) {
    var a = document.createElement("a");
    a.className = "work-card";
    a.innerHTML = '<img src="' + esc(w.thumb) + '" alt=""><b>' + esc(w.title) + '</b><span class="pill">' + esc(w.role) + "</span>";
    a.addEventListener("click", function () { openWork(i); });
    set.appendChild(a);
  });

  var RB = ["#ff0000", "#ff6600", "#cc9900", "#009900", "#0066ff", "#6600cc", "#cc0099"];
  $$(".rainbow").forEach(function (el) {
    el.innerHTML = el.textContent.split("").map(function (ch, i) { return '<i style="color:' + RB[i % RB.length] + '">' + esc(ch) + "</i>"; }).join("");
  });
  $("#last-updated").textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  $("#year").textContent = new Date().getFullYear();

  var heartSound;
  $("#heart").addEventListener("click", function () {
    heartSound = heartSound || new Audio("assets/bibuttonmeme.ogg");
    audio.pause();
    heartSound.currentTime = 0;
    heartSound.play();
  });

  $("#mail-send").addEventListener("click", function () {
    location.href = "mailto:nyakusfx@gmail.com?subject=" + encodeURIComponent($("#mail-subj").value) +
      "&body=" + encodeURIComponent($("#mail-body").value);
  });

  // slide show gadget
  var slides = $$("#slideshow img"), slide = 0;
  setInterval(function () {
    slides[slide].classList.remove("on");
    slide = (slide + 1) % slides.length;
    slides[slide].classList.add("on");
  }, 6000);
  $("#slideshow").addEventListener("dblclick", function () { goto("media-post"); });

  /* -------------------------------------------------------------
     DESKTOP, START MENU, TRAY
     ------------------------------------------------------------- */
  function deselect() { $$(".desk-icon.selected").forEach(function (n) { n.classList.remove("selected"); }); }
  function launch(key) { open(key); }
  $$(".desk-icon").forEach(function (ic) {
    ic.addEventListener("click", function () { deselect(); ic.classList.add("selected"); if (coarse) launch(ic.dataset.open); });
    ic.addEventListener("dblclick", function () { launch(ic.dataset.open); });
    ic.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); launch(ic.dataset.open); } });
  });
  desktop.addEventListener("pointerdown", function (e) {
    if (e.target === desktop || e.target.id === "icon-layer") { deselect(); focus(null); }
  });

  var startBtn = $("#start-btn"), startMenu = $("#start-menu"), smSearch = $("#sm-search");
  function startOpen(on) {
    startMenu.hidden = !on;
    startBtn.classList.toggle("on", on);
    if (!on && smSearch.value) { smSearch.value = ""; smFilter(); }
    if (on) smSearch.focus();
  }
  startBtn.addEventListener("click", function () { startOpen(startMenu.hidden); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") startOpen(false); });

  // start menu search: programs + every work and game
  var smIndex = $$("#sm-list .sm-item").map(function (b) {
    return { label: b.textContent, icon: $("img", b).getAttribute("src"), run: function () { launch(b.dataset.open); } };
  }).concat(
    [["Computer", "img/icons/computer.png", "computer"], ["Control Panel", "img/icons/computer.png", "computer"], ["Recycle Bin", "img/icons/recycle.png", "recycle"]]
      .map(function (x) { return { label: x[0], icon: x[1], run: function () { launch(x[2]); } }; }),
    works.map(function (w, i) { return { label: w.title, icon: w.thumb, run: function () { openWork(i); } }; }),
    games.map(function (g, i) { return { label: g.name, icon: g.icon || "img/icons/app.png", run: function () { openGame(i); } }; })
  );
  var smList = $("#sm-list"), smResults = $("#sm-results"), smHits = [];
  function smFilter() {
    var q = smSearch.value.trim().toLowerCase();
    smList.hidden = !!q;
    smResults.hidden = !q;
    if (!q) return;
    smHits = smIndex.filter(function (x) { return x.label.toLowerCase().indexOf(q) > -1; });
    smResults.innerHTML = smHits.length ? smHits.map(function (x, i) {
      return '<button class="sm-item' + (i ? "" : " first") + '" data-hit="' + i + '"><img src="' + esc(x.icon) + '" alt="">' + esc(x.label) + "</button>";
    }).join("") : '<div class="none">No items match your search.</div>';
  }
  smSearch.addEventListener("input", smFilter);
  smSearch.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && smHits.length && smSearch.value.trim()) { smHits[0].run(); startOpen(false); }
  });
  smResults.addEventListener("click", function (e) {
    var b = e.target.closest("[data-hit]");
    if (b) { smHits[b.dataset.hit].run(); startOpen(false); }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest("#start-menu, #start-btn")) startOpen(false);
    var t = e.target.closest("[data-open], [data-goto], [data-play]");
    if (!t || t.classList.contains("desk-icon")) return;
    e.preventDefault();
    if ("play" in t.dataset) togglePlay();
    else if (t.dataset.goto) goto(t.dataset.goto);
    else launch(t.dataset.open);
    if (t.closest("#start-menu")) startOpen(false);
  });

  // show desktop: minimize everything, click again to bring it back
  var peeked = null;
  $("#show-desktop").addEventListener("click", function () {
    if (peeked) { peeked.forEach(restore); peeked = null; return; }
    peeked = Object.keys(wins).filter(function (k) { return wins[k].open && !wins[k].min; });
    peeked.forEach(minimize);
  });

  var clockT = $("#clock-time"), clockD = $("#clock-date");
  function tick() {
    var d = new Date();
    clockT.textContent = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    clockD.textContent = d.toLocaleDateString("en-US");
    $("#clock").title = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  tick(); setInterval(tick, 10000);

  var balloonEl = $("#balloon");
  function balloon(title, text) {
    balloonEl.innerHTML = "<b>" + esc(title) + "</b>" + esc(text);
    balloonEl.hidden = false;
    sfx("balloon");
    clearTimeout(balloonEl._t);
    balloonEl._t = setTimeout(function () { balloonEl.hidden = true; }, 9000);
  }
  balloonEl.addEventListener("click", function () { balloonEl.hidden = true; });

  /* -------------------------------------------------------------
     ROBLOX — a games app that looks games up live.
     data comes from roproxy.com (a public mirror of roblox's api; roblox's
     own api doesn't allow other sites to read it). requests never carry
     cookies and nothing here ever asks anyone to log in.
     it's a desktop app (menu bar, toolbar, status bar), not a web page.
     roblox forbids being shown inside other sites (frame-ancestors 'none'),
     so "Play" asks first, then opens play.roblox.com in a game-sized popup
     window, which uses whatever roblox account the visitor is signed into.
     ------------------------------------------------------------- */
  var RBX = window.ROBLOX || {}, rbxIcon = RBX.icon || "img/icons/app.png";
  var rbxSession = window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
  var rbxThumbs = {}, rbxHist = [], rbxPos = -1, rbxEl = null, rbxSorts = null;
  $$("[data-rbx-icon]").forEach(function (i) { i.src = rbxIcon; });

  function rbxApi(sub, path) {
    return fetch("https://" + sub + ".roproxy.com" + path, { credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function num(n) { return n == null ? "-" : Number(n).toLocaleString("en-US"); }
  function day(d) { return d ? new Date(d).toLocaleDateString("en-US") : "-"; }
  function bg(el, url) { el.style.backgroundImage = "url(" + JSON.stringify(url) + ")"; }

  // wide thumbnails, one batched request per page, dropped into the grey tiles
  function rbxFillThumbs(root) {
    var want = [];
    $$("[data-u]", root).forEach(function (t) { var u = t.dataset.u; if (rbxThumbs[u]) bg(t, rbxThumbs[u]); else if (want.indexOf(u) < 0) want.push(u); });
    for (var i = 0; i < want.length; i += 50) {
      rbxApi("thumbnails", "/v1/games/multiget/thumbnails?universeIds=" + want.slice(i, i + 50).join(",") + "&size=384x216&format=Png&countPerUniverse=1")
        .then(function (d) {
          d.data.forEach(function (x) { var t = x.thumbnails && x.thumbnails[0]; if (t && t.imageUrl) rbxThumbs[x.universeId] = t.imageUrl; });
          $$("[data-u]", root).forEach(function (t) { if (rbxThumbs[t.dataset.u]) bg(t, rbxThumbs[t.dataset.u]); });
        }).catch(function () {});
    }
  }

  function fromList(x) { return { u: x.universeId, p: x.rootPlaceId, name: x.name, playing: x.playerCount, up: x.totalUpVotes || 0, down: x.totalDownVotes || 0, genre: x.genreL1 || x.genre }; }
  function rbxCard(g) {
    var votes = g.up + g.down;
    return '<div class="rbx-card"><a class="rbx-thumb" data-place="' + g.p + '" data-u="' + g.u + '" title="' + esc(g.name) + '"></a>' +
      '<a class="rbx-name" data-place="' + g.p + '">' + esc(g.name) + "</a>" +
      '<span class="rbx-online">' + num(g.playing) + " players online</span>" +
      (votes ? '<span class="rbx-rating">Rating: ' + Math.round(g.up / votes * 100) + "%</span>" : "") + "</div>";
  }
  function rbxMsg(html) { return '<div class="rbx-msg">' + html + "</div>"; }

  // place ids (the number in a roblox.com/games/... url) -> full game info
  function rbxPlaces(ids) {
    return Promise.all(ids.map(function (id) {
      return rbxApi("apis", "/universes/v1/places/" + id + "/universe").then(function (d) { return d.universeId; }).catch(function () { return null; });
    })).then(function (us) {
      us = us.filter(Boolean);
      return us.length ? rbxApi("games", "/v1/games?universeIds=" + us.join(",")).then(function (d) { return d.data; }) : [];
    });
  }
  function rbxLoadSorts() {
    if (rbxSorts) return Promise.resolve(rbxSorts);
    if (RBX.charts === false) return Promise.resolve(rbxSorts = []);
    return rbxApi("apis", "/explore-api/v1/get-sorts?sessionId=" + rbxSession).then(function (d) {
      return (rbxSorts = d.sorts.filter(function (s) { return s.contentType === "Games" && s.games && s.games.length; }));
    });
  }

  // the left "browse" column, like the old Games page
  // the left column of the old Games page: sorts, then genres for the current list
  function rbxSide(v, genres) {
    var link = function (attr, val, label, on) { return "<a " + attr + '="' + esc(val) + '"' + (on ? ' class="on"' : "") + ">" + esc(label) + "</a>"; };
    var sorts = ((RBX.picks || []).length ? link("data-sort", "picks", "nyaku's picks", v.sort === "picks") : "") +
      (rbxSorts || []).map(function (s) { return link("data-sort", s.sortId, s.sortDisplayName, v.sort === s.sortId); }).join("");
    var gen = genres && genres.length > 1 ? '<div class="rbx-box"><div class="rbx-box-h">Genre</div><div class="rbx-sorts">' +
      link("data-genre", "", "All Genres", !v.genre) + genres.map(function (g) { return link("data-genre", g, g, v.genre === g); }).join("") + "</div></div>" : "";
    return '<aside class="rbx-side"><div class="rbx-box"><div class="rbx-box-h">Sort</div><div class="rbx-sorts">' + sorts + "</div></div>" + gen +
      '<div class="rbx-box rbx-tip"><div class="rbx-box-h">Did you know?</div><p>No login needed here. When you press Play, Roblox uses whatever account you\'re already signed into in this browser.</p></div></aside>';
  }

  // 16 games a page with the old "Previous | Page x of y | Next" bar
  var RBX_PER_PAGE = 16;
  function rbxPaged(title, games, v) {
    var pages = Math.max(1, Math.ceil(games.length / RBX_PER_PAGE)), page = Math.min(v.page || 1, pages);
    v.page = page;
    var bar = pages > 1 ? '<div class="rbx-pager">' +
      (page > 1 ? '<a data-page="' + (page - 1) + '">&laquo; Previous</a>' : '<span>&laquo; Previous</span>') +
      "<b>Page " + page + " of " + pages + "</b>" +
      (page < pages ? '<a data-page="' + (page + 1) + '">Next &raquo;</a>' : "<span>Next &raquo;</span>") + "</div>" : "";
    return '<div class="rbx-box"><div class="rbx-box-h">' + esc(title) + "</div>" + bar +
      '<div class="rbx-grid">' + games.slice((page - 1) * RBX_PER_PAGE, page * RBX_PER_PAGE).map(rbxCard).join("") + "</div>" + bar + "</div>";
  }

  var rbxViews = {
    games: function (body, v) {
      return rbxLoadSorts().then(function (sorts) {
        // opens on Top Trending; falls back to the first chart, then the picks
        var trending = sorts.filter(function (s) { return s.sortId === "top-trending"; })[0] || sorts[0];
        var sort = v.sort || (trending ? trending.sortId : "picks");
        v.sort = sort;
        var list = sort === "picks"
          ? rbxPlaces(RBX.picks).then(function (d) {
              return { title: "nyaku's picks", games: d.map(function (g) { return { u: g.id, p: g.rootPlaceId, name: g.name, playing: g.playing, up: 0, down: 0, genre: g.genre_l1 || g.genre }; }) };
            })
          : Promise.resolve(sorts.filter(function (s) { return s.sortId === sort; }).map(function (s) { return { title: s.sortDisplayName, games: s.games.map(fromList) }; })[0] || { title: "", games: [] });
        return list.then(function (l) {
          var genres = [];
          l.games.forEach(function (g) { if (g.genre && genres.indexOf(g.genre) < 0) genres.push(g.genre); });
          genres.sort();
          var shown = v.genre ? l.games.filter(function (g) { return g.genre === v.genre; }) : l.games;
          body.innerHTML = '<div class="rbx-cols">' + rbxSide(v, genres) + '<div class="rbx-main">' +
            (shown.length ? rbxPaged(l.title + (v.genre ? " \u00b7 " + v.genre : ""), shown, v) : rbxMsg("nothing here yet. add place ids to ROBLOX.picks in js/content.js")) + "</div></div>";
        });
      });
    },
    search: function (body, v) {
      return Promise.all([rbxLoadSorts(), rbxApi("apis", "/search-api/omni-search?searchQuery=" + encodeURIComponent(v.q) + "&sessionId=" + rbxSession + "&pageType=all")]).then(function (r) {
        var games = [];
        r[1].searchResults.forEach(function (g) { if (g.contentGroupType === "Game") games = games.concat(g.contents); });
        body.innerHTML = '<div class="rbx-cols">' + rbxSide(v) + '<div class="rbx-main">' +
          (games.length ? rbxPaged('Search results for "' + v.q + '"', games.map(fromList), v) : rbxMsg("No games matched &ldquo;" + esc(v.q) + "&rdquo;.")) + "</div></div>";
      });
    },
    game: function (body, v) {
      return rbxPlaces([v.place]).then(function (d) {
        var g = d[0];
        if (!g) { body.innerHTML = rbxMsg("This place doesn't exist or isn't public."); return; }
        v.name = g.name;
        body.innerHTML = '<h1 class="rbx-title">' + esc(g.name) + "</h1>" +
          '<div class="rbx-place"><div class="rbx-place-l"><div class="rbx-shot" data-u="' + g.id + '"></div>' +
          '<a class="rbx-play" data-play-place="' + g.rootPlaceId + '">Play</a>' +
          '<div class="rbx-box"><div class="rbx-box-h">Description</div><p class="rbx-desc">' + esc(g.description || "No description.") + "</p></div></div>" +
          '<div class="rbx-place-r"><div class="rbx-box"><div class="rbx-box-h">Creator</div><p class="rbx-creator">' + esc(g.creator && g.creator.name) + "</p></div>" +
          '<div class="rbx-box"><div class="rbx-box-h">Statistics</div><dl class="rbx-statlist">' +
          "<dt>Players online:</dt><dd class=\"rbx-online\">" + num(g.playing) + "</dd>" +
          "<dt>Visited:</dt><dd>" + num(g.visits) + " times</dd>" +
          "<dt>Favorited:</dt><dd>" + num(g.favoritedCount) + " times</dd>" +
          "<dt>Max players:</dt><dd>" + num(g.maxPlayers) + "</dd>" +
          "<dt>Genre:</dt><dd>" + esc(g.genre_l1 || g.genre || "-") + "</dd>" +
          "<dt>Created:</dt><dd>" + day(g.created) + "</dd>" +
          "<dt>Updated:</dt><dd>" + day(g.updated) + "</dd></dl></div></div></div>";
        // the big shot wants a bigger thumbnail than the grid
        rbxApi("thumbnails", "/v1/games/multiget/thumbnails?universeIds=" + g.id + "&size=768x432&format=Png&countPerUniverse=1").then(function (t) {
          var th = t.data[0] && t.data[0].thumbnails[0];
          if (th && th.imageUrl) { rbxThumbs[g.id] = th.imageUrl; bg($(".rbx-shot", body), th.imageUrl); }
        }).catch(function () {});
      });
    }
  };

  function rbxStatus(text) { if (rbxEl) $(".rbx-status", rbxEl).textContent = text; }

  function rbxGo(v, fromHistory) {
    if (!rbxEl) return;
    if (!fromHistory) { rbxHist = rbxHist.slice(0, rbxPos + 1).concat(v); rbxPos = rbxHist.length - 1; }
    var body = $(".rbx-body", rbxEl);
    $(".back", rbxEl).disabled = rbxPos <= 0;
    $(".fwd", rbxEl).disabled = rbxPos >= rbxHist.length - 1;
    body.innerHTML = rbxMsg('<span class="spinner animate"></span> Loading...');
    $(".rbx-scroll", rbxEl).scrollTop = 0;
    rbxStatus("Loading...");
    rbxViews[v.type](body, v).then(function () {
      rbxFillThumbs(body);
      rbxStatus("Connected");
    }).catch(function () {
      body.innerHTML = rbxMsg('<b>Couldn\'t connect</b><p>roblox didn\'t answer. it might be down, or your connection is.</p><a class="rbx-btn" data-rv="retry">Try again</a>');
      rbxStatus("Offline");
    });
  }

  // a desktop app, not a web page: menu bar, toolbar, browse pane, status bar
  function openRoblox() {
    if (rbxEl && wins.rbxsite) return open("rbxsite");
    rbxEl = spawn("rbxsite", "Roblox", rbxIcon,
      '<div class="rbx-menu"><span><u>F</u>ile</span><span><u>V</u>iew</span><span><u>T</u>ools</span><span><u>H</u>elp</span></div>' +
      '<div class="rbx-tools">' +
      '<button class="round back" disabled aria-label="Back">&#8592;</button><button class="round fwd" disabled aria-label="Forward">&#8594;</button>' +
      '<button class="rbx-tool" data-rv="refresh" title="Refresh">&#8635;</button><button class="rbx-tool" data-rv="games" title="Home">&#8962; Home</button>' +
      '<a class="rbx-logo" data-rv="games">' + (RBX.logo ? '<img src="' + esc(RBX.logo) + '" alt="ROBLOX">' : "ROBLOX") + "</a>" +
      '<form class="rbx-search searchbox"><input type="search" placeholder="Search games" aria-label="Search games"><button type="submit" aria-label="search"></button></form>' +
      "</div>" +
      '<div class="window-body rbx-app"><div class="rbx-scroll has-scrollbar"><div class="rbx"><div class="rbx-body"></div></div></div>' +
      '<div class="rbx-join" hidden><div class="rbx-join-box"><b>Starting Roblox...</b><span class="rbx-join-name"></span><div role="progressbar" class="marquee"></div><small>the game opens in its own window</small></div></div></div>' +
      '<div class="status-bar"><p class="status-bar-field rbx-status">Ready</p><p class="status-bar-field">no login needed</p><p class="status-bar-field">fan-made &middot; not affiliated with Roblox</p></div>',
      { w: 1040, h: 760, bigIcon: rbxIcon, onclose: function () { rbxEl = null; rbxHist = []; rbxPos = -1; } });
    if (!rbxEl) return;
    $(".back", rbxEl).addEventListener("click", function () { if (rbxPos > 0) { rbxGo(rbxHist[--rbxPos], true); } });
    $(".fwd", rbxEl).addEventListener("click", function () { if (rbxPos < rbxHist.length - 1) { rbxGo(rbxHist[++rbxPos], true); } });
    $(".rbx-search", rbxEl).addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("input", this).value.trim();
      if (q) rbxGo({ type: "search", q: q });
    });
    rbxEl.addEventListener("click", function (e) {
      var place = e.target.closest("[data-place]"), sort = e.target.closest("[data-sort]"), nav = e.target.closest("[data-rv]"), play = e.target.closest("[data-play-place]");
      var genre = e.target.closest("[data-genre]"), pg = e.target.closest("[data-page]"), cur = rbxHist[rbxPos];
      if (genre && cur.type === "games") { rbxGo({ type: "games", sort: cur.sort, genre: genre.dataset.genre || "" }); }
      else if (pg) { rbxGo(Object.assign({}, cur, { page: +pg.dataset.page })); }
      else if (place) { rbxGo({ type: "game", place: place.dataset.place }); }
      else if (sort) { rbxGo({ type: "games", sort: sort.dataset.sort }); }
      else if (nav) { nav.dataset.rv === "retry" || nav.dataset.rv === "refresh" ? rbxGo(cur, true) : rbxGo({ type: "games" }); }
      else if (play) rbxPlay(play.dataset.playPlace, $(".rbx-title", rbxEl).textContent);
    });
    rbxGo({ type: "games" });
  }

  // explicit permission first. roblox can't be shown inside another site, so it
  // opens in a game-sized popup while the app shows its "starting" screen
  function rbxPlay(place, name) {
    msgbox("Roblox", '<img class="big" src="' + esc(rbxIcon) + '" alt="">',
      "<p>Play <b>" + esc(name) + "</b>?</p><p>The game opens in its own window and uses whichever Roblox account you're already signed into in this browser (or asks you itself). nyakuverse never sees your account and never asks you to log in.</p>",
      [{ label: "Play", fn: function () {
        // some browsers report a 0 screen size; fall back to the browser window's size
        var sw = screen.availWidth || outerWidth || 1320, sh = screen.availHeight || outerHeight || 800;
        var w = Math.max(640, Math.min(1280, sw - 40)), h = Math.max(360, Math.min(720, sh - 80));
        var x = (screen.availLeft || 0) + Math.max(0, Math.round((sw - w) / 2)), y = (screen.availTop || 0) + Math.max(0, Math.round((sh - h) / 2));
        window.open("https://play.roblox.com/games/start?placeId=" + encodeURIComponent(place), "_blank",
          "popup=yes,noopener,width=" + w + ",height=" + h + ",left=" + x + ",top=" + y);
        rbxJoining(name);
      } }, { label: "Cancel" }]);
  }

  // the app's own "starting" screen, purely for show
  function rbxJoining(name) {
    if (!rbxEl) return;
    var j = $(".rbx-join", rbxEl);
    $(".rbx-join-name", j).textContent = name;
    j.hidden = false;
    rbxStatus("Joining " + name + "...");
    setTimeout(function () { if (rbxEl) { j.hidden = true; rbxStatus("Playing in another window"); } }, 3500);
  }

  /* -------------------------------------------------------------
     EASTER EGGS + POWER (opened like windows via data-open)
     ------------------------------------------------------------- */
  var pets = 0;
  var actions = {
    roblox: function () { openRoblox(); },
    troll: function () {
      // user account control: dims the whole screen, taskbar included
      var dim = document.createElement("div");
      dim.id = "uac-dim";
      wrap.appendChild(dim);
      var el = spawn("uac", "User Account Control", "", '<div class="window-body">' +
        '<div class="uac-head">Do you want to allow the following program from an unknown publisher to make changes to this computer?</div>' +
        '<div class="uac-info"><img src="img/icons/app.png" alt=""><b>Program name:</b><span>do_not_open.exe</span><b>Publisher:</b><span><b>Unknown</b></span><b>File origin:</b><span>Hard drive on this computer</span></div>' +
        '<div class="uac-foot"><span class="grow">Show details</span><button data-uac="yes">Yes</button><button data-uac="no" class="default">No</button></div></div>',
        { w: 480, cls: "dialog uac", onclose: function () { dim.remove(); } });
      if (!el) return;
      $(".uac-foot", el).addEventListener("click", function (e) {
        var b = e.target.closest("[data-uac]");
        if (!b) return;
        close("uac");
        if (b.dataset.uac === "yes") whistle();
      });
    },
    bear: function () {
      pets++;
      var msg = pets === 1 ? "you pet the bear. the bear is pleased." :
        pets < 5 ? "the bear has been pet " + pets + " times. it purrs (?)." :
        pets < 10 ? "ok that's " + pets + " pets. the bear is now your friend for life." :
        "the bear has ascended. " + pets + " pets. you did this.";
      msgbox("bear.exe", '<img class="bear" src="assets/bear.png" alt="a bear">', "<p>" + msg + "</p>",
        [{ label: "Pet again", fn: actions.bear }, { label: "Close" }], pets === 10 ? "notify" : "ding");
    },
    shutdown: function () {
      var s = document.createElement("div");
      s.className = "power-screen";
      s.innerHTML = '<div class="msg"><span class="spinner animate"></span><span>Logging off...</span></div>';
      document.body.appendChild(s);
      audio.pause();
      sfx("logoff");
      setTimeout(function () {
        $(".msg span:last-child", s).textContent = "Shutting down...";
        sfx("shutdown");
      }, 1800);
      setTimeout(function () {
        s.className = "power-screen off";
        s.innerHTML = '<div class="msg">click anywhere to turn the computer back on &#9825;</div>';
        s.addEventListener("click", function () { s.remove(); boot(true); });
      }, 4200);
    }
  };

  function whistle() {
    audio.pause();
    var el = spawn("whistle", "can_you_blow_my_whistle.exe", "img/icons/app-16.png",
      '<div class="window-body video-body"><video src="assets/Josh%20Hutcherson%20Whistle.mp4" autoplay playsinline></video></div>',
      { w: 600, onclose: function () { $("video", el).pause(); } });
    if (el) $("video", el).volume = 0.25;
  }

  /* -------------------------------------------------------------
     WINDOWS MEDIA PLAYER
     ------------------------------------------------------------- */
  var audio = $("#mp-audio");
  var song = (window.SONG || "").replace(/\.[^.]+$/, "").split(/\s+-\s+/);
  var seek = $("#mp-seek"), vol = $("#mp-vol"), timeEl = $("#mp-time");
  var vis = $("#mp-vis"), vctx = vis.getContext("2d"), analyser, bins;
  $$(".song-title").forEach(function (n) { n.textContent = song[0] || "no song"; });
  $$(".song-artist").forEach(function (n) { n.textContent = song[1] || ""; });
  audio.src = "assets/medias/" + window.SONG;

  function setVol() { audio.volume = vol.value / 100; vol.style.setProperty("--p", vol.value + "%"); }
  setVol();
  vol.addEventListener("input", setVol);

  function initVis() {
    if (analyser) return;
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ac.createAnalyser();
      analyser.fftSize = 128;
      bins = new Uint8Array(analyser.frequencyBinCount);
      ac.createMediaElementSource(audio).connect(analyser);
      analyser.connect(ac.destination);
    } catch (e) { analyser = null; }
  }
  var grad = vctx.createLinearGradient(0, 48, 0, 0);
  grad.addColorStop(0, "#0b3a7a"); grad.addColorStop(0.6, "#3aa0ff"); grad.addColorStop(1, "#c8ecff");
  function drawVis() {
    vctx.clearRect(0, 0, 300, 48);
    if (!analyser || audio.paused) return;
    analyser.getByteFrequencyData(bins);
    vctx.fillStyle = grad;
    for (var i = 0; i < 30; i++) {
      var h = Math.round(bins[i + 1] / 255 * 46);
      vctx.fillRect(i * 10, 48 - h, 8, h);
    }
    requestAnimationFrame(drawVis);
  }

  function togglePlay() {
    if (audio.paused) { initVis(); audio.play(); } else audio.pause();
  }
  function fmt(s) { s = Math.floor(s || 0); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  $("#mp-stop").addEventListener("click", function () { audio.pause(); audio.currentTime = 0; });
  $("#mp-prev").addEventListener("click", function () { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  $("#mp-next").addEventListener("click", function () { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
  $("#mp-loop").addEventListener("click", function () { audio.loop = !audio.loop; this.classList.toggle("on", audio.loop); });
  $("#mp-mute").addEventListener("click", function () { audio.muted = !audio.muted; this.classList.toggle("on", audio.muted); });
  seek.addEventListener("input", function () { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; });

  audio.addEventListener("play", function () {
    $$("[data-play]").forEach(function (b) { b.innerHTML = "&#10074;&#10074;"; });
    drawVis();
  });
  audio.addEventListener("pause", function () {
    $$("[data-play]").forEach(function (b) { b.innerHTML = "&#9654;&#xFE0E;"; });
  });
  audio.addEventListener("timeupdate", function () {
    timeEl.textContent = fmt(audio.currentTime);
    if (audio.duration) {
      seek.value = audio.currentTime / audio.duration * 1000;
      seek.style.setProperty("--p", seek.value / 10 + "%");
    }
  });
  audio.addEventListener("error", function () { $$(".song-title").forEach(function (n) { n.textContent = "no song loaded"; }); });

  /* -------------------------------------------------------------
     BOOT → LOGON (once per session) + initial windows
     ------------------------------------------------------------- */
  var bootEl = $("#boot"), logonEl = $("#logon"), userTile = $("#logon-user"), waitEl = $(".logon-wait");
  function boot(force) {
    var seen;
    try { seen = sessionStorage.getItem("booted"); } catch (e) { seen = "1"; }
    if (seen && !force) return;
    bootEl.hidden = false;
    setTimeout(function () {
      bootEl.hidden = true;
      logonEl.hidden = false;
      userTile.hidden = false;
      waitEl.hidden = true;
      userTile.focus();
    }, reduce ? 300 : 2600);
  }
  userTile.addEventListener("click", function () {
    userTile.hidden = true;
    waitEl.hidden = false;
    try { sessionStorage.setItem("booted", "1"); } catch (e) {}
    sfx("logon");
    setTimeout(function () {
      logonEl.hidden = true;
      setTimeout(function () {
        balloon("Welcome to nyaku's PC", "Double-click the icons on the desktop to look around. My works are in my_works, games are in Games.");
      }, 900);
    }, 1600);
  });

  open("blog");
  var hash = location.hash.slice(1);
  if (wins[hash] && hash !== "blog") open(hash);
  boot(false);
})();
