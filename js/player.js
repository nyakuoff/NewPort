// playlist player that survives page changes (js/nav.js swaps pages without reloading).
// the <audio> lives here, outside the page content. every [data-p="..."] element on the current
// page (the full player on work, a mini player everywhere else) just mirrors this state.
(function () {
  var M = SITE.music;
  var a = new Audio(), tracks = [], idx = 0, shuffle = false, dragP = null, started = false, dismissed = false;
  a.preload = "metadata";
  a.volume = M.volume / 100;

  var each = function (k, f) { document.querySelectorAll('[data-p="' + k + '"]').forEach(f); };
  var txt = function (k, v) { each(k, function (e) { e.textContent = v; }); };
  var pct = function (el, v) { el.style.setProperty("--p", v + "%"); };
  var icon = function (el, n) { el.querySelector("use").setAttribute("href", "assets/icons.svg#" + n); };
  var fmt = function (s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  var btn = function (k, label, ico, cls) {
    return '<button class="' + (cls || "ic") + '" data-p="' + k + '" aria-label="' + label + '"><svg class="i"><use href="assets/icons.svg#' + ico + '"/></svg></button>';
  };

  var mini = document.createElement("div");
  mini.className = "mini"; mini.hidden = true;
  mini.innerHTML = '<div class="cover" data-p="cover" aria-hidden="true"></div><div class="info"><b data-p="title"></b><small data-p="artist"></small></div>' +
    btn("prev", "previous", "prev") + btn("play", "play", "play", "play") + btn("next", "next", "next") + btn("close", "close player", "close", "ic close") +
    '<div class="mini-line" data-p="line"></div>';
  document.body.appendChild(mini);

  // "Title - Artist.mp3" -> {title, artist}, lowercased to match the site
  function parse(file) {
    var n = file.replace(/\.[^.]+$/, ""), i = n.indexOf(" - ");
    return { file: file, title: (i < 0 ? n : n.slice(0, i)).toLowerCase(), artist: i < 0 ? "" : n.slice(i + 3).toLowerCase() };
  }

  // fake waveform: seeded noise under a slow envelope, different per song. ponytail: not real peaks.
  function shape(wave, name) {
    var n = Math.max(24, Math.floor(wave.clientWidth / 5)); // as many bars as fit (~3px bar + 2px gap)
    while (wave.children.length < n) wave.appendChild(document.createElement("i"));
    while (wave.children.length > n) wave.lastChild.remove();
    var seed = 7;
    for (var i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 2147483647;
    var phase = seed % 7;
    [].forEach.call(wave.children, function (b, i) {
      seed = (seed * 16807) % 2147483647;
      b.style.height = 12 + (seed % 100) / 100 * 60 * (0.55 + 0.45 * Math.sin(i / 5.5 + phase) ** 2) + "%";
    });
  }

  // time-based bits, run on every timeupdate
  function paint() {
    var p = dragP !== null ? dragP : a.duration ? a.currentTime / a.duration : 0; // while scrubbing, show where the finger is
    each("line", function (e) { pct(e, p * 100); });
    txt("cur", fmt(a.currentTime));
    txt("dur", fmt(a.duration));
    each("wave", function (w) {
      w.setAttribute("aria-valuenow", Math.round(p * 100));
      [].forEach.call(w.children, function (b, i) { b.classList.toggle("on", i / w.children.length < p); });
    });
  }

  // everything else; call after any state change or page swap
  function sync() {
    var t = tracks[idx] || { title: "no songs", artist: "", file: "" };
    mini.hidden = !!document.querySelector(".player") || !started || dismissed; // (before the bars are sized, hidden things have no width) the full player replaces the mini one
    document.body.classList.toggle("has-mini", !mini.hidden);
    txt("title", t.title);
    txt("artist", t.artist);
    each("wave", function (w) { shape(w, t.file); });
    each("cover", function (c) { c.style.background = t.url ? "url(" + t.url + ") center / cover" : ""; });
    each("play", function (b) { icon(b, a.paused ? "play" : "pause"); b.setAttribute("aria-label", a.paused ? "play" : "pause"); });
    each("shuffle", function (b) { b.setAttribute("aria-pressed", shuffle); });
    each("repeat", function (b) { b.setAttribute("aria-pressed", a.loop); });
    var v = a.muted ? 0 : a.volume * 100;
    each("vol", function (e) { e.value = v; pct(e, v); });
    txt("volnum", Math.round(v) + "%");
    each("mute", function (b) { icon(b, v ? "volume" : "mute"); });
    paint();
  }
  window.PlayerSync = sync;

  function play() { dismissed = false; var p = a.play(); if (p) p.catch(function () {}); }

  // cover = first itunes hit for "title artist", cached per song; the gradient stays if there's none
  function art(t) {
    return t.art || (t.art = fetch("https://itunes.apple.com/search?media=music&entity=song&limit=1&term=" + encodeURIComponent(t.title + " " + t.artist))
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.results[0] && d.results[0].artworkUrl100.replace("100x100", "400x400"); })
      .catch(function () {}));
  }

  var loading, want;
  function load(i, autoplay) {
    idx = (i + tracks.length) % tracks.length;
    var t = tracks[idx];
    loading = null;
    a.src = M.folder + encodeURIComponent(t.file);
    art(t).then(function (u) {
      if (!u || t.url) return;
      var img = new Image();
      img.onload = function () { t.url = u; if (tracks[idx] === t) sync(); };
      img.src = u;
    });
    if (autoplay) play();
    sync();
  }
  function next() { load(shuffle && tracks.length > 1 ? idx + 1 + Math.floor(Math.random() * (tracks.length - 1)) : idx + 1, true); }

  // seeking: some servers (python http.server) ignore Range requests, so the audio isn't seekable
  // and currentTime snaps back to 0. when that happens, swap to a blob copy of the file once.
  function seekTo(t) {
    if (a.seekable.length && a.seekable.end(0) >= a.duration - 1) { a.currentTime = t; return; }
    want = t;
    if (loading) return;
    var resume = !a.paused, at = idx;
    loading = fetch(a.src).then(function (r) { return r.blob(); }).then(function (b) {
      if (at !== idx) return; // song changed while downloading
      a.src = URL.createObjectURL(b);
      a.addEventListener("loadedmetadata", function () { a.currentTime = want; if (resume) play(); loading = null; }, { once: true });
    }, function () { loading = null; });
  }

  var act = {
    play: function () { a.paused ? play() : a.pause(); },
    prev: function () { a.currentTime > 3 ? seekTo(0) : load(idx - 1, true); },
    next: next,
    shuffle: function () { shuffle = !shuffle; sync(); },
    repeat: function () { a.loop = !a.loop; sync(); },
    mute: function () { a.muted = !a.muted; },
    close: function () { dismissed = true; a.pause(); sync(); }
  };
  // delegated, so it keeps working after every page swap
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]");
    if (b && act[b.dataset.p]) act[b.dataset.p]();
  });
  document.addEventListener("input", function (e) {
    if (e.target.dataset && e.target.dataset.p === "vol") { a.muted = false; a.volume = e.target.value / 100; }
  });

  // the waveform is the seek bar: click or drag on it; arrow keys when focused
  var scrub;
  function at(e) { var r = scrub.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
  function scrubTo(e) { dragP = at(e); if (a.duration) seekTo(dragP * a.duration); paint(); }
  document.addEventListener("pointerdown", function (e) {
    scrub = e.target.closest('[data-p="wave"]');
    if (!scrub) return;
    scrub.setPointerCapture(e.pointerId);
    scrubTo(e);
  });
  document.addEventListener("pointermove", function (e) { if (dragP !== null) scrubTo(e); });
  addEventListener("pointerup", function () { dragP = null; scrub = null; paint(); });
  document.addEventListener("keydown", function (e) {
    var k = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
    if (k && e.target.dataset && e.target.dataset.p === "wave" && a.duration) { e.preventDefault(); seekTo(Math.max(0, Math.min(a.duration, a.currentTime + k))); }
  });

  // used by the terminal page (js/terminal.js, js/ocarina.js)
  window.PlayerAPI = {
    list: () => tracks.map(t => ({ file: t.file, title: t.title, artist: t.artist })),
    index: () => idx,
    playing: () => !a.paused,
    play: i => { if (i === idx && a.currentTime > 0 && a.paused) play(); else load(i, true); },
    resume: play,
    pause: () => a.pause(),
    next: () => next(),
    prev: () => load(idx - 1, true)
  };

  a.onplay = function () { started = true; sync(); };
  a.onpause = a.onvolumechange = sync;
  a.ontimeupdate = a.onloadedmetadata = a.ondurationchange = paint;
  a.onended = next; // with repeat on, <audio loop> never ends, so this only fires when repeat is off

  addEventListener("resize", sync); // bar count depends on the waveform width
  sync();
  fetch(M.folder + "songs.json").then(function (r) { return r.json(); }).then(function (list) {
    tracks = list.map(parse);
    if (!tracks.length) throw 0;
    load(Math.floor(Math.random() * tracks.length), false); // random song each visit
  }).catch(function () {});
})();
