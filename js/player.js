// playlist player. songs = assets/medias/songs.json (built by songs.py); state lives on the <audio> element.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var a = $("p-audio"), bar = $("p-bar"), wave = $("p-wave"), vol = $("p-vol"), cover = document.querySelector(".cover");
  var M = SITE.music;
  var tracks = [], idx = 0, shuffle = false, drag = false;
  var fmt = function (s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  var pct = function (el, v) { el.style.setProperty("--p", v + "%"); };

  // "Title - Artist.mp3" -> {title, artist}, lowercased to match the site
  function parse(file) {
    var n = file.replace(/\.[^.]+$/, ""), i = n.indexOf(" - ");
    return { file: file, title: (i < 0 ? n : n.slice(0, i)).toLowerCase(), artist: i < 0 ? "" : n.slice(i + 3).toLowerCase() };
  }

  // fake waveform: seeded noise under a slow envelope, different per song. ponytail: not real peaks.
  var N = 56, bars = [];
  for (var i = 0; i < N; i++) bars.push(wave.appendChild(document.createElement("i")));
  function shape(name) {
    var seed = 7;
    for (var i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 2147483647;
    var phase = seed % 7;
    bars.forEach(function (b, i) {
      seed = (seed * 16807) % 2147483647;
      b.style.height = 12 + (seed % 100) / 100 * 60 * (0.55 + 0.45 * Math.sin(i / 5.5 + phase) ** 2) + "%";
    });
  }

  function paint() {
    var p = a.duration ? a.currentTime / a.duration : 0;
    if (!drag) bar.value = p * 1000; // don't fight the thumb while it's being dragged
    pct(bar, bar.value / 10);
    $("p-cur").textContent = fmt(a.currentTime);
    $("p-dur").textContent = fmt(a.duration);
    bars.forEach(function (b, i) { b.classList.toggle("on", i / N < p); });
  }
  function toggle(btn) { btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") !== "true"); return btn; }
  function play() { var p = a.play(); if (p) p.catch(function () {}); }

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
    var t = tracks[idx], mine = idx;
    loading = null;
    a.src = M.folder + encodeURIComponent(t.file);
    $("p-title").textContent = t.title;
    $("p-artist").textContent = t.artist;
    shape(t.file);
    cover.style.background = "";
    art(t).then(function (u) {
      if (!u) return;
      var img = new Image();
      img.onload = function () { if (mine === idx) cover.style.background = "url(" + u + ") center / cover"; };
      img.src = u;
    });
    paint();
    if (autoplay) play();
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

  // volume
  function paintVol() {
    var v = a.muted ? 0 : a.volume * 100;
    vol.value = v; pct(vol, v);
    $("p-vol-n").textContent = Math.round(v) + "%";
    $("p-mute").firstChild.firstChild.setAttribute("href", "assets/icons.svg#" + (v ? "volume" : "mute"));
  }
  a.volume = M.volume / 100;
  a.onvolumechange = paintVol;
  vol.oninput = function () { a.muted = false; a.volume = vol.value / 100; };
  $("p-mute").onclick = function () { a.muted = !a.muted; };
  paintVol();

  $("p-play").onclick = function () { a.paused ? play() : a.pause(); };
  a.onplay = a.onpause = function () {
    var p = !a.paused;
    $("p-play").setAttribute("aria-label", p ? "pause" : "play");
    $("p-play").firstChild.firstChild.setAttribute("href", "assets/icons.svg#" + (p ? "pause" : "play"));
  };
  a.ontimeupdate = a.onloadedmetadata = a.ondurationchange = paint;
  a.onended = next; // with repeat on, <audio loop> never ends, so this only fires when repeat is off
  bar.onpointerdown = function () { drag = true; };
  addEventListener("pointerup", function () { drag = false; paint(); });
  bar.oninput = function () { pct(bar, bar.value / 10); if (a.duration) seekTo(bar.value / 1000 * a.duration); };
  $("p-prev").onclick = function () { a.currentTime > 3 ? seekTo(0) : load(idx - 1, true); };
  $("p-next").onclick = next;
  $("p-repeat").onclick = function () { a.loop = toggle(this).getAttribute("aria-pressed") === "true"; };
  $("p-like").onclick = function () { toggle(this); };
  $("p-shuffle").onclick = function () { shuffle = toggle(this).getAttribute("aria-pressed") === "true"; };

  fetch(M.folder + "songs.json").then(function (r) { return r.json(); }).then(function (list) {
    tracks = list.map(parse);
    if (!tracks.length) throw 0;
    load(0, false);
  }).catch(function () { $("p-title").textContent = "no songs"; });
})();
