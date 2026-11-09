/* ./ocarina.sh — a terminal ocarina. loaded on demand by js/terminal.js (it's the biggest file on the site).

   adapted from "Play the Ocarina" by Marlon Marcello (MIT license),
   https://codepen.io/marlonmarcello/pen/01a1adbe-9d6f-73e7-8aab-c8fa5a26117a
   the five notes, the twelve songs and the synth voice come from that pen; the controls are the same.
   the picture is the pen's ocarina render redrawn as half-block text (see ART at the bottom).
   when you play a song right, the soundtrack version of it (assets/ocarina/, see the README there) plays as the backing and the
   synth ocarina plays the phrase on top, like Link does in the game. no track = just the synth, with the game's own timings.
   unofficial fan thing, inspired by Ocarina of Time. */
window.Ocarina = (function () {
  const esc = UI.esc;
  const NOTES = {
    A: { sym: "A", pitch: "D4", f: 293.6648 },
    D: { sym: "↓", pitch: "F4", f: 349.2282 },
    R: { sym: "→", pitch: "A4", f: 440 },
    L: { sym: "←", pitch: "B4", f: 493.8833 },
    U: { sym: "↑", pitch: "D5", f: 587.3295 }
  };
  const ORDER = ["A", "D", "R", "L", "U"];
  const KEYS = { a: "A", ArrowDown: "D", ArrowRight: "R", ArrowLeft: "L", ArrowUp: "U" };
  // seq = how the game itself plays each song back: [button or "-" for a rest, length in 60 Hz frames, volume, vibrato].
  // taken from the Ocarina of Time decompilation (zeldaret/oot, src/audio/game/general.c, sOcarinaSongNotes).
  const SONGS = [
    { id: "zelda", name: "Zelda’s Lullaby", notes: "LURLUR", seq: [["L",51,84],["U",25,88],["R",78,80],["L",51,84],["U",25,88],["R",100,80]], desc: "a melody passed down through hyrule’s royal family." },
    { id: "epona", name: "Epona’s Song", notes: "ULRULR", seq: [["U",18,84],["L",18,88],["R",72,80],["U",18,84],["L",18,88],["R",144,80]], desc: "a familiar tune from the quiet pastures of lon lon ranch." },
    { id: "saria", name: "Saria’s Song", notes: "DRLDRL", seq: [["D",17,84],["R",17,88],["L",34,80],["D",17,84],["R",17,88],["L",136,80]], desc: "a song of friendship, deep in the lost woods." },
    { id: "sun", name: "Sun’s Song", notes: "RDURDU", seq: [["R",12,84],["D",13,88],["U",29,80,2],["-",9,84],["R",12,84],["D",13,88],["U",120,80,3]], desc: "a little melody to greet the dawn, or welcome the night." },
    { id: "time", name: "Song of Time", notes: "RADRAD", seq: [["R",32,84],["A",65,88],["D",33,80],["R",32,84],["A",65,88],["D",99,80]], desc: "let the echoes of the temple of time find you." },
    { id: "storms", name: "Song of Storms", notes: "ADUADU", seq: [["A",11,84],["D",11,88],["U",45,80],["A",11,84],["D",11,88],["U",90,80]], desc: "the windmill turns. a storm is on its way." },
    { id: "minuet", name: "Minuet of Forest", notes: "AULRLR", seq: [["A",18,86],["U",18,92],["L",72,86],["R",18,80],["L",18,88],["R",144,86]], desc: "find your way back to the heart of the forest." },
    { id: "bolero", name: "Bolero of Fire", notes: "DADARDRD", seq: [["D",15,80],["A",15,72],["D",15,84],["A",15,76],["R",15,84],["D",15,74],["R",15,78],["D",135,66]], desc: "a steady rhythm for the depths of death mountain." },
    { id: "serenade", name: "Serenade of Water", notes: "ADRRL", seq: [["A",36,60],["D",36,78],["R",33,82],["-",3,82],["R",36,84],["L",144,90]], desc: "a gentle refrain beneath the waters of lake hylia." },
    { id: "requiem", name: "Requiem of Spirit", notes: "ADARDA", seq: [["A",45,88],["D",23,86],["A",22,84],["R",45,86],["D",45,94],["A",180,94]], desc: "an ancient melody carried across the desert sands." },
    { id: "nocturne", name: "Nocturne of Shadow", notes: "LRRALRD", seq: [["L",36,88],["R",33,84],["-",3,84],["R",18,82],["A",18,60],["L",18,90],["R",18,88],["D",144,96]], desc: "a haunting passage into kakariko’s hidden shadows." },
    { id: "prelude", name: "Prelude of Light", notes: "URURLU", seq: [["U",15,84],["R",45,88],["U",15,88],["R",15,82],["L",15,86],["U",60,90],["-",75,90]], desc: "a guiding light, and a melody that brings you home." }
  ];
  const FRAME = 1000 / 60; // one frame of those lengths, in ms
  // per backing track: `lead` = seconds into the file where its ocarina phrase starts. the file is played from just
  // before that point, as if the song started there. `notes` = [start, length] in seconds after the lead, measured from the
  // recording itself (some tracks play the phrase faster than the game's frame data). without `notes` the game's timing is
  // used, stretched by `tempo`. found by listening to the files' note energy, not by ear: nudge any that feel off.
  const PRE = 0.25; // how much of the file plays before the first note
  const TRACK = {
    zelda:    { lead: .05, notes: [[0, .86], [.86, .43], [1.29, 1.2], [2.56, .87], [3.43, .44], [3.87, 1.1]] },
    epona:    { lead: .05, notes: [[0, .29], [.29, .32], [.61, 1.14], [1.79, .32], [2.11, .3], [2.41, 1.05]] },
    saria:    { lead: .05, notes: [[0, .18], [.18, .17], [.4, .46], [.86, .18], [1.07, .2], [1.29, .47]] },
    sun:      { lead: .05, notes: [[0, .2], [.2, .2], [.4, .36], [1.06, .21], [1.27, .21], [1.48, .36]] },
    time:     { lead: .05 },
    storms:   { lead: .05, notes: [[0, .19], [.19, .17], [.36, .71], [1.08, .23], [1.31, .18], [1.49, .73]] },
    minuet:   { lead: 3.6 },
    bolero:   { lead: .05, notes: [[0, .19], [.22, .22], [.45, .24], [.71, .22], [1, .17], [1.18, .23], [1.41, .26], [1.67, .48]] },
    serenade: { lead: 4, tempo: 1.1 },
    requiem:  { lead: 6.05 },
    nocturne: { lead: 5.35, tempo: 1.1 },
    prelude:  { lead: 4.03 }
  };
  const MAX_TRACK = 14000; // ms, longest a backing track plays after a song
  const TRACK_GAIN = 0.8; // the backing sits a little under the ocarina
  const FADE = 1500;      // ms of fade-out at the end of a track

  let host, tui, onExit, active = false;
  let audio, master, volume = 65, muted = false;
  let sel = 0, progress = 0, history = [], status = "", playingSong = null, playingIdx = -1;
  let demoRunning = false, demoTimers = [], wasPlaying = false, clip = null, clips = {}, gen = 0, fade = 0;
  const voices = new Map(), learned = new Set();
  const q = k => tui.querySelector('[data-o="' + k + '"]');

  /* ---------------- audio (the pen's voice: a soft pipe tone with vibrato) ---------------- */
  function updateVolume() {
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume / 100 * 0.28, audio.currentTime, 0.025);
    if (clip && !fade) clip.volume = muted ? 0 : volume / 100 * TRACK_GAIN;
  }
  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("no audio");
      audio = new Ctx();
      master = audio.createGain();
      master.connect(audio.destination);
      updateVolume();
    }
    if (audio.state === "suspended") audio.resume().catch(() => setStatus("sound is paused by your browser. press a note again."));
  }
  function createTone(note, opts) {
    try {
      ensureAudio();
      const now = audio.currentTime, osc = audio.createOscillator(), env = audio.createGain();
      const vib = audio.createOscillator(), vibDepth = audio.createGain();
      osc.setPeriodicWave(audio.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, .065, .025])));
      osc.frequency.value = NOTES[note].f;
      vib.frequency.value = 4.8;
      vibDepth.gain.setValueAtTime(0, now);
      vibDepth.gain.linearRampToValueAtTime(1.6 + (opts.vib || 0) * 1.6, now + .4); // the game marks a few held notes with extra vibrato
      vib.connect(vibDepth); vibDepth.connect(osc.frequency);
      env.gain.setValueAtTime(0, now);
      const g = opts.vol ? opts.vol / 90 : 1; // per-note volume from the game's data (~90 is the pen's normal level)
      env.gain.linearRampToValueAtTime(.85 * g, now + .035);
      env.gain.linearRampToValueAtTime(.65 * g, now + .15);
      osc.connect(env); env.connect(master);
      osc.start(); vib.start();
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        const end = audio.currentTime;
        env.gain.cancelScheduledValues(end);
        env.gain.setTargetAtTime(0, end, .035);
        osc.stop(end + .18); vib.stop(end + .18);
        osc.onended = () => { osc.disconnect(); env.disconnect(); vib.disconnect(); vibDepth.disconnect(); };
      };
    } catch (e) {
      setStatus("audio isn't available in this browser. you can still practice the notes.");
      return () => {};
    }
  }

  /* ---------------- rendering: only the changing parts are rewritten, the picture is built once ---------------- */
  function artHtml() {
    return ART.map(row => {
      let out = "";
      for (let i = 0; i < row.length; i += 9) {
        const ch = row[i], fg = row.substr(i + 1, 3), bg = row.substr(i + 4, 3), n = parseInt(row.substr(i + 7, 2), 16);
        const g = (ch === "t" ? "▀" : ch === "b" ? "▄" : " ").repeat(n);
        const st = (fg !== "---" ? "color:#" + fg + ";" : "") + (bg !== "---" ? "background:#" + bg : "");
        out += st ? '<span style="' + st + '">' + g + "</span>" : g;
      }
      return out;
    }).join("\n");
  }
  function setStatus(s) { status = s; if (tui) q("status").textContent = s; }
  function renderKeys() {
    const on = new Set([...voices.values()].map(v => v.note));
    q("keys").innerHTML = ORDER.map(n =>
      '<span class="key' + (on.has(n) ? " on" : "") + '" data-n="' + n + '"><b>' + NOTES[n].sym + "</b> <i>" + NOTES[n].pitch + "</i></span>").join("");
    q("state").textContent = on.size ? [...on].map(n => NOTES[n].pitch).join(" + ") : "ready to play";
    tui.classList.toggle("playing", on.size > 0);
  }
  function renderHist() {
    q("hist").innerHTML = history.length
      ? history.slice(-12).map(n => '<span class="pn">' + NOTES[n].sym + "</span>").join("")
      : '<span class="dim">every adventure begins with a note.</span>';
  }
  function renderSeq() {
    const s = SONGS[sel], hi = playingSong === s ? playingIdx : -1;
    q("seq").innerHTML = [...s.notes].map((n, i) =>
      '<span class="sn' + (i < progress || i < hi ? " played" : "") + (i === (hi >= 0 ? hi : progress) ? " next" : "") + '">' + NOTES[n].sym + "</span>").join("");
  }
  function renderSong() {
    const s = SONGS[sel];
    q("name").textContent = s.name;
    q("desc").textContent = s.desc;
    renderSeq();
  }
  function renderSongs() {
    q("learned").textContent = learned.size + " / " + SONGS.length + " learned";
    q("songs").innerHTML = SONGS.map((s, i) =>
      '<div class="song' + (i === sel ? " sel" : "") + '" data-s="' + i + '"><span>' + (i === sel ? "▸" : " ") + "</span><span class=\"dim\">" + (i + 1) + "</span><span>" +
      esc(s.name) + '</span><span class="dim">' + s.notes.length + ' notes</span><span class="x">' + (learned.has(s.id) ? "✓" : "") + "</span></div>").join("");
  }
  function renderFoot() {
    q("listen").textContent = demoRunning ? "[l] stop listening" : "[l] listen first";
    q("foot").innerHTML = "<span>a ↑ ↓ ← →</span> play · <span>tab</span> song · <span>l</span> listen · <span>r</span> restart · <span>m</span> " +
      (muted ? "unmute" : "mute") + " · <span>+ -</span> volume " + (muted ? "off" : volume + "%") + ' · <button data-act="quit">q quit</button>';
  }

  /* ---------------- the instrument ---------------- */
  function release(source) {
    const v = voices.get(source);
    if (!v) return;
    v.stop(); voices.delete(source);
    renderKeys();
  }
  function releaseAll() { [...voices.keys()].forEach(release); }
  function press(note, source, isDemo, opts) {
    if (voices.has(source)) return;
    if (!isDemo) { if (demoRunning || demoTimers.length) stopDemo(); recordNote(note); }
    voices.set(source, { note, stop: createTone(note, opts || {}) });
    renderKeys();
  }
  function recordNote(note) {
    const s = SONGS[sel];
    history.push(note);
    history = history.slice(-24);
    renderHist();
    if (progress === s.notes.length) progress = 0;
    if (note === s.notes[progress]) {
      progress++;
      setStatus(progress === s.notes.length ? "beautifully played. you learned " + s.name + "!" : progress + " of " + s.notes.length + " notes. keep going.");
    } else {
      // keep the longest played suffix that is also the opening of the selected melody
      progress = 0;
      for (let len = Math.min(history.length, s.notes.length - 1); len > 0; len--) {
        if (history.slice(-len).join("") === s.notes.slice(0, len)) { progress = len; break; }
      }
      setStatus(progress ? "a new beginning. " + progress + " of " + s.notes.length + " notes." : "not quite. try again from the first note.");
    }
    renderSeq();
    const hit = SONGS.find(x => history.slice(-x.notes.length).join("") === x.notes);
    if (hit) {
      learned.add(hit.id);
      renderSongs();
      if (hit !== s) setStatus("you played " + hit.name + "! pick it in the songbook to practice.");
      // the game plays the song back once you get it right
      demoTimers.push(setTimeout(() => { melody(hit); setStatus("♪ " + hit.name); }, 500));
    }
  }

  /* ---------------- playback: "listen first", and the song played back once you nail it. exact in-game timing ---------------- */
  // the synth plays the phrase `lead` ms from now: at the track's measured note times if we have them, else the game's own
  function schedule(song, lead, endMs, tempo) {
    const T = TRACK[song.id] || {};
    const steps = [];            // [button, start ms, length ms, vol, vib]
    if (T.notes) {
      let k = 0;
      song.seq.forEach(([b, , vol, vib]) => { if (b !== "-") { const [st, len] = T.notes[k++]; steps.push([b, st * 1000, len * 1000, vol, vib]); } });
    } else {
      let t = 0;
      song.seq.forEach(([b, frames, vol, vib]) => { const d = frames * FRAME * tempo; if (b !== "-") steps.push([b, t, d, vol, vib]); t += d; });
    }
    let end = 0;
    steps.forEach(([b, st, len, vol, vib], i) => {
      const src = "demo-" + i, at = lead + st;
      demoTimers.push(setTimeout(() => { playingSong = song; playingIdx = i; press(b, src, true, { vol, vib }); renderSeq(); }, at));
      demoTimers.push(setTimeout(() => release(src), at + Math.max(60, len - 20)));
      end = Math.max(end, at + len);
    });
    demoTimers.push(setTimeout(() => stopDemo(true), Math.max(end + 200, endMs || 0)));
  }
  function fadeOut(a, ms) {
    const steps = 15, v0 = a.volume;
    fade = 1;
    for (let i = 1; i <= steps; i++) demoTimers.push(setTimeout(() => { a.volume = v0 * (1 - i / steps); }, ms / steps * i));
  }
  // tracks are small, so each is fetched into memory first: that makes it seekable even on servers that ignore Range requests
  function getClip(id) {
    return clips[id] || (clips[id] = fetch("assets/ocarina/" + id + ".mp3")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => { const a = new Audio(URL.createObjectURL(b)); a.preload = "auto"; return a; }));
  }
  function melody(song) {
    stopDemo();
    demoRunning = true;
    renderFoot();
    const T = TRACK[song.id] || { lead: 0 }, my = gen;
    getClip(song.id).then(a => {
      if (my !== gen) return; // stopped while loading
      clip = a; a.currentTime = Math.max(0, T.lead - PRE); a.volume = muted ? 0 : volume / 100 * TRACK_GAIN; // start just before the notes
      let started = false;
      const go = withTrack => {
        if (my !== gen || clip !== a || started) return;
        started = true;
        if (!withTrack) return schedule(song, 0, 0, T.tempo || 1);
        const wait = Math.max(0, (T.lead - a.currentTime) * 1000); // normally PRE; longer only if the seek didn't take
        const left = Math.min(MAX_TRACK, ((a.duration || 0) - a.currentTime) * 1000);
        schedule(song, wait, left, T.tempo || 1);
        if (left > FADE * 2) demoTimers.push(setTimeout(() => fadeOut(a, FADE), left - FADE));
      };
      a.addEventListener("playing", () => go(true), { once: true });
      const p = a.play();
      if (p) p.catch(() => go(false)); // autoplay blocked, ...
    }, () => { if (my === gen) schedule(song, 0, 0, T.tempo || 1); }); // no track: the synth plays alone
  }
  function stopDemo(announce) {
    gen++; // invalidates any clip that is still waiting to start
    fade = 0;
    if (clip) { clip.pause(); clip = null; }
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    [...voices.keys()].filter(k => k.startsWith("demo-")).forEach(release);
    const was = demoRunning;
    demoRunning = false; playingSong = null; playingIdx = -1;
    if (announce && was) setStatus("your turn. follow the notes from left to right.");
    if (tui) { renderSeq(); renderFoot(); }
  }
  function listen() {
    if (demoRunning) return stopDemo(true);
    reset();
    try { ensureAudio(); } catch (e) { setStatus("audio isn't available in this browser. follow the highlighted notes instead."); }
    melody(SONGS[sel]);
    setStatus("listen to the melody, then give it a try.");
  }
  function reset() {
    stopDemo(); releaseAll();
    progress = 0; history = [];
    renderHist(); renderSeq();
    setStatus("follow the notes from left to right.");
  }
  function warm() { getClip(SONGS[sel].id).catch(() => {}); } // start loading the selected song's track so it's ready
  function select(i) { sel = (i + SONGS.length) % SONGS.length; reset(); renderSong(); renderSongs(); warm(); }
  function vol(d) { volume = Math.max(0, Math.min(100, volume + d)); muted = false; updateVolume(); renderFoot(); }

  /* ---------------- input ---------------- */
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); if (!e.repeat) press(KEYS[k], "key-" + k); return; }
    if (k === "Tab") { e.preventDefault(); select(sel + (e.shiftKey ? -1 : 1)); return; }
    if (e.repeat) return;
    if (k === "q" || k === "Escape") { e.preventDefault(); stop(); }
    else if (k === "l") listen();
    else if (k === "r") reset();
    else if (k === "m") { muted = !muted; updateVolume(); renderFoot(); }
    else if (k === "+" || k === "=") vol(5);
    else if (k === "-" || k === "_") vol(-5);
    else if (/^[1-9]$/.test(k)) select(+k - 1);
  }
  function onKeyUp(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (KEYS[k]) release("key-" + k); }
  function onPointerUp(e) { release("ptr-" + e.pointerId); }
  function onBlur() { stopDemo(); releaseAll(); }
  function onClick(e) {
    const s = e.target.closest("[data-s]"), b = e.target.closest("[data-act]");
    if (s) select(+s.dataset.s);
    else if (b) ({ listen: listen, restart: reset, quit: stop })[b.dataset.act]();
  }
  function onPointerDown(e) {
    const k = e.target.closest("[data-n]");
    if (k && e.button === 0) { e.preventDefault(); press(k.dataset.n, "ptr-" + e.pointerId); }
  }

  function start(opts) {
    if (active) return;
    active = true; host = opts.host; onExit = opts.onExit;
    wasPlaying = !!(window.PlayerAPI && PlayerAPI.playing());
    if (wasPlaying) PlayerAPI.pause(); // the site music would fight the ocarina
    host.classList.add("app");
    tui = document.createElement("div");
    tui.className = "tui";
    tui.innerHTML =
      '<div class="tui-main">' +
        '<div class="tui-hd"><b>THE OCARINA OF TIME</b><span data-o="state"></span></div>' +
        '<pre class="tui-art">' + artHtml() + "</pre>" +
        '<div class="tui-keys" data-o="keys"></div>' +
        '<div class="tui-line"><span class="dim">your melody</span><span data-o="hist"></span></div>' +
        '<div class="tui-prac"><div class="dim">YOUR SELECTED MELODY</div><div class="tui-name" data-o="name"></div><div class="dim" data-o="desc"></div>' +
        '<div class="tui-seq" data-o="seq"></div><div class="tui-status" data-o="status"></div>' +
        '<div class="tui-acts"><button data-act="listen" data-o="listen"></button><button data-act="restart">[r] start over</button></div></div>' +
      "</div>" +
      '<div class="tui-side"><div class="tui-hd"><b>THE SONGBOOK</b><span data-o="learned"></span></div><div class="tui-songs" data-o="songs"></div>' +
        '<div class="dim">play a song’s notes in order and the game plays it back.</div></div>' +
      '<div class="tui-foot dim" data-o="foot"></div>';
    host.appendChild(tui);
    addEventListener("keydown", onKeyDown);
    addEventListener("keyup", onKeyUp);
    addEventListener("pointerup", onPointerUp);
    addEventListener("pointercancel", onPointerUp);
    addEventListener("blur", onBlur);
    tui.addEventListener("pointerdown", onPointerDown);
    tui.addEventListener("click", onClick);
    renderKeys(); renderHist(); renderSong(); renderSongs(); renderFoot(); warm();
    setStatus("follow the notes from left to right.");
    host.scrollTop = 0;
  }
  function stop(silent) {
    if (!active) return;
    active = false;
    stopDemo(); releaseAll();
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    removeEventListener("pointerup", onPointerUp);
    removeEventListener("pointercancel", onPointerUp);
    removeEventListener("blur", onBlur);
    if (audio) { audio.close().catch(() => {}); audio = master = null; }
    clips = {};
    tui.remove();
    host.classList.remove("app");
    if (wasPlaying && window.PlayerAPI) PlayerAPI.resume();
    if (onExit) onExit(silent === true);
  }

  /* the ocarina, 96x30 cells of half blocks: [char t/b/s][fg rgb nibbles][bg rgb nibbles][run length hex] per run, "---" = none */
  const ART = [
  "s------49b8bf---01tadf7cf01t9dfadf01t9df48c01t9cf69d01tbef7ae01b8bf---01bbdf---01s------0f",
  "s------48tcef8be01t5af47b01teff8ad01t9cf37b01t37b47b01t57a57a01t47a78b01t68c9ad01t79e79c01t9be68c01s------0e",
  "s------46beff---01tbdf7af01t37c37b01t47b58d01t36936901t36935901t47a46a01t57a67a01t79b89b01t9ad9ac01t78b67a01t68a67a01s------0e",
  "s------45bdef---01tbdf69d01t37c37b01t47c48d01t47b37c01t36937b01t35836a01t35846901t78b8ac01t9ac8ac01t8ac89b01t56945801t57957901s------0e",
  "s------44bcef---01tadf47c01t26b26b01t59d6ae01t69d48d01t37b26b01t36b36a01t36a57a01t69c79c01t8ad8ad01t8ac8ad01t89b79b01t34734701t57957901s------0e",
  "s------41bccc---01tfffccc01teeeaaa01tdee99901teefbbb01tcdefff01tacecbb01t79daaa01t47b99901t36bbbc01t58cabc01t8ad9bd02t8ad8ad01t78b68b01t24714701t67957a01s------0e",
  "s------40bcbc---01teeebbb01tbbbbbb01tcccaaa01tbbbccc01t888bbb01teee88901teee99901t888ddd01tcccdee01tcccbbb01tbbabbb01t98899901t77765501t77788801t778ccc01t56866501t79b99901bfff---01s------0d",
  "s------3ebfff---01tcccfff01tdddaaa01tccc99901tabbbbb01tddd88801tfff88801taaa99901t999eee01tddedde01tddeba901tba9ff701tdc7ff701tccccb801tdddccd01t77788801tfff55501taaa44401t44444401t44466601taaa88801s------0d",
  "s------3cbfff---01tfffddd01teee99901t8899aa01t889ddd01tdddfff01teeebbb01taab99901taabfff01teeedde01tcdddc901ta99dc901tec688701tff797501tff7ba601tfe7ca501taaa88801t888ddd01t44455501t88865501t55576601t44455501t99977701bbbb---01s------0c",
  "s------3bbbbb---01tcccbbb01t999bbb01taabedd01teeeddd01tfff88801t999aaa01t888fff01teeeccd01tddda9801tedbfe801tff9ff701tfe8ff701t889ba901t66689901t778a9901tb98fe701ta96dc601tccc88901t777aaa01t44455502t65544401taaa88801t999bbb01s------0c",
  "s------39b9ab---01tccbabc01tdddabb01teee99901tfff88801tddd99901t777cbc01t888ccc01tbbb77801tfff66601tddd77701tccc77801ta9799a01t974aab01tb9599901tcb977701t99977601tec576401tff676401tff6a9301ta9898601taabbbb01t66688801t77755501t55577701t66655501tccc99901s------0c",
  "s------25bdef---01bcef---01bbdf---04bbef---01bbff---01baff---01tbff7cf01taff7df01taff6df01taff8ff01tbffaff01tbff8ff01tcff8cf01tcff8af01tdff8ad01teff8ad02tdff8ad01tacf8ae01t69c9bf01t2478be01t02579d01t23447a01t77703701tccc02401tddd12301taab33401t88855501t76777701t88888801tcccaaa01tcbbaaa01t66666601t77888801t778baa01t77755501t98966601t77766601tddd99901tdddddd01t44444401t77766601t55577701t77766601s------0c",
  "s------18bbdf---01bacf---01b9bf---02b8be---02tcdf8ae01tbdf79d01tbcf79d01tacf69c01tabe68c01t9be68c01t9be69d01t9bf6bf01t8ae6cf01t7ad6bf01t79c69d01t79d69d01t7ae6bf01t8cf6cf01t9cf7df01t2586ad01t04658b01t13558b01t02559d01t58b7bf01t9ef6bf01t6cf6bf01t6ae6ae01t59d69d01t58d69d01t69d69d01t58c69d01t58b68c02t68c68c01t69c68c01t79c68c01t68c68c02t57b68c01t36968c01t14768c01t13658c01t12447c01t22337b01t33325801t44413601t66612401t77711201tbbb11201t66644401t55555501t55576601t444aaa01t33399901t44465501t54455501t77777701t77788801s------0c",
  "s------0fbbdf---01bacf---01b9be---01b8be---01tbdf8bf01tadf7ae01tacf69d01t9bf58c01t8ae68c01t79d6ae01t69d8cf01t69e8df01t69d7bf01t69d6ae01t68c58c01t68c57a01t68c58b01t69c57b01t69c58d01t6bf6cf01t6cf7df01t7df7be01taff35701t9ef23501t7ef47a01t6cf7bf01t69d58b01t6bf57b01t6bf58c01t6bf57b01t7bf57a01t7bf57b02t7bf58c01t69d57b01t69d68c01t6ae58b01t69d58c02t68c58b01t68c58c01t68c68c01t68c58b01t68c58c01t68c68c06t68c58c01t69d58c01t69d69d01t69d59d01t6ae6ae02t49d59d01t48d69d01t36a69e01t25859d01t14859d01t13659d01t02347c01t12336a01t33313701t33302401t33302501t66612401taaa78801s------0c",
  "s------07b9cf---01b8be---01b7ad---01b79d---01tacf68c01t9be57a01t8ad57a01t7ad57b01t68c9ad01t58bbce01t57bcdf01t57bcef01t47cbdf01t57beef01t8adfff01t9be9ef01t9df6bf01tcff36801tbef12401taef13501taff7be01t6bf6cf01t6aeadf01t57bfff02t8adfff01tceffff01tbfffff01t7df9df01t25826901t12400001t00100001t12457901t6bf6bf01t69c9be01t79bdef01t47abdf01t46a8ae01t4697ae01t46a58c01t37b58d01t37b48c01t47b48c01t47b37a01t46a36a01t46a36901t36a36a01t36a36901t46a35901t47b35901t47a35901t47b36a01t57a36901t57b36902t57b37b01t58c37b01t58c36a01t58b36a01t58c47a01t69d47b01t69d48c01t69e58c01t6ae59e01t59d59d01t58c58c01t59d69d01t69d59d01t58c69e01t59d59e01t69d59d01t69d59e01t79d69e01t79d69d01t8ad79c01t8ae8ad01tbceabe01tfffcdf01bdef---01beff---01s------09",
  "s------02badf---01b8be---01tbdf59d01t8bf48c01t7ae47a01t69d35901t57b35801t46935801t46835801t46936a01t47a58d01t58c9df01t9df8ce01tcff7cf01tdff6cf01tfff5cf01tfff4ae01tfff59e01teff6bf01t8df8ef01t7ef7ce01t25713501t02300001t01100001t00100001t24512301t6cf6bf01t6bf37c01tbdf36a01tace36a01t9bd25901tcdf36a01tfff79d01tfff9be01tadfdef01t7abcef01t8be6bf01t8cf58c01t6af24701t48d48c01t36a49d01t46a36a01t47a36a01t58c37b01t48c37c03t37c36b01t37b37c02t35936a01t35935901t35825801t35824802t35925901t36935901t36a36a03t36b36a01t36a36a07t37c36a01t47c36b01t47b36a01t58c36a01t58c37c01t59d48c02t58b47a01t59d47a01t5ae48c01t59d47b01t57b46a01t57a46901t68c46a01t79c47a01t89c67a01tacf68b01tcff89c01bcdf---01bdff---01s------06",
  "b7ad---01t8bf26a01t48d25901t36a25801t25924801t25824701t24845801t24756902t35856901t35857a01t47b7ad01t8cfadf01t57901301t00100001t11200001t6ae56801t6cf8df01t4af6cf01t5ae5af01t6ae59e01t7df5bf01taff8ef01t1239de01t00046602t0008ad01t59b6ae01t4ae58b01t47a57a01t35956901t35856901t35957a01t35946901t35857a01t25957a01t35957a01t26a47a01t4ae37c01t48b6ae01t00069a01t2575bf01t5bf49d01t36b47a01t35935801t36936901t37b36a01t37c37c01t37c38c01t37b37c01t37c37c01t37b37b01t26a26a01t25925901t25825903t25926a01t36b36b01t37b36b01t36a36a01t36a36b01t36a36a01t36b35901t36a36a01t36b36a01t36a36a01t36b36a01t36a47b01t36a46a01t36a46901t36b57a01t36957a01t36a68b01t47b79c01t37b79c02t36a69c01t25968b01t36a57b01t36946901t35936901t35835901t35835801t35935801t46936901t57a35901t57a46901t78a57901tbdf67a01tdffbcf01bdff---01s------04",
  "t57a89b01t15836901t26914701t25814801t14714701t13613501t34702501t56813601t57924701t67a45701t68b57a01t7ad68c01tbefadf01t023abc01t00056601t0009bc01t9cd8ef01t7cf6ae01t6af68c01t58c57a01t58c57901t58c57a01t59e58b01t7cf57b01t9ef57b01t9df57b01t6ae57b01t57b68b01t68b67a01t67a67a02t67a68a01t57a67a01t67a68b01t68b68b01t67a67a02t57b67a01t47b67a01t47b57a01t7bf46901t49d57a01t58c58b01t58b58b01t57957a01t57a57a01t57b58b01t58c58c01t58c58b01t47b58b01t37b47a01t36a36901t25925801t25925901t25926a02t25925902t36b26a01t37b36901t37b36a02t36b35801t35925801t36a35902t36935801t36946901t47a46901t46a46902t68b68b01t78b79b01t8ac89c01t8ad8ad01t8ad89c01t9ad8ac02t9ad89c02t89c89c01t68a8ac01t57a89c01t35968b01t35846901t35925801t35824802t45834701t57945801t67956901tbcf67a01bbcf---01s------03",
  "s------01t78b---01t357---01t13546801t13623501t13502401t02412403t02512401t14602501t35813601t37a14801t7bf16a01t8ef26a01t7df26a01t5bf37a01t69d37b01t57a36901t57945801t56946901t57957a01t57a57a01t57a57901t57a57a01t67a57a01t68b57a01t67a57a02t67a67a01t68b67a02t68b58b01t68c58c01t68c68c01t68c58c01t68b68c01t67a67b01t67a57a03t57a57a01t57a57903t58b57a01t58c58b01t58b58c01t58c59d01t47b47b01t37b36a01t36936a01t25825801t25924801t26a24801t26925901t26a25901t25925801t25824701t25825801t25925801t25925901t24725801t24724701t25824801t24835801t34735801t35836901t46946901t35835901t35824801t68b36a01t79c79c01t89c79b01t79c79b01t89c79b01t89c78b03t79b78a02t89b78b01t79b78b01t89c79b01t78b79b01t45867a01t24735801t24724702t34724701t45724701t56845801t89b56901tcdf9bd01s------02",
  "s------04t679---01t346---01t12356801t01334501t12412301t12401301t12412302t13612501t14712501t14712401t14713501t13613601t14713601t14713501t13613601t24713601t24814701t36914801t36914701t46914701t57a25802t57935801t56934702t56924701t57a35801t57b36a01t58b47b01t58c58c01t58c47a01t58b57a01t58c58c01t58b58c01t57a57a02t57a56901t57a57a01t57a57b01t57946901t56946901t47a46901t47b46901t58c46a01t47b37b01t26a36a01t26a26a01t25925901t24825901t24824703t24724702t24824601t24724601t25824702t24824801t35835901t36969c01t57a57a01t46900001t57a23401t47a58c01t25937b01t25925901t57b46a01t79c68b01t68b67a01t68b57a01t68a57a01t67a57a01t67957901t67956902t67957901t78a67902t78a67a02t45856901t24624601t24623601t24724601t24724701t35824701t46946901t67a57a01tbbd9ad01s------01",
  "s------08t568---01t2459ac01t01356801t01323401t12401301t12402401t02412501t12413501t13602401t13512501t13502501t13612501t13512501t13613501t14813601t14713601t13613601t14713501t13613601t14713601t13613501t13613602t14714601t25814701t25914702t25813601t25913601t36914702t36a14701t46924801t46824701t47a25801t47b25801t35924701t35814701t35813601t25813601t26a25901t37b27b01t26a25801t25924802t25925801t25825901t24724801t24725801t24724702t24624601t23623601t24724603t34734701t58b35801t79c8be01t0008bc01t1237ad01t7af49d01t37b37b01t27b27b01t37b36a01t57b48c01t57947b01t56947b01t46938c01t46a38c01t46969c01t58b68901t58b68a01t46a68b01t46946a01t56846901t56845801t56945801t56946801t34734701t13613601t23613601t24724601t24824701t35925801t47a46a01t8ad79c01tccebce01",
  "s------0bt9ac---01t568---01t235abc01t02467901t02434501t12301301t12401301t02412402t12512501t12413501t12412501t12412401t12402401t02402401t12502402t12512401t13513501t13613603t14713602t13613601t13513501t13613501t14713601t13613604t14713602t13613602t13513501t14714601t25814701t14613601t14713601t14714801t25927a01t26a27b01t25938c01t25837b01t24725801t24714701t23613604t23623601t24725801t25868b01t68b34501t8bd00001t7ad00001t49d35801t39d4af01t38c3ae01t27b38c01t37b37b01t47b36a01t38c38c01t39d4af01t7cf6ad01t45500001t00000002t45713401t7ac8ad01t36947a01t35734701t34734601t34724601t24623601t13613501t13513501t13613501t24713601t24724701t46945801t68b67a01tabdabd01",
  "s------0ftabd---01t779---01t345bce01t01378901t01334501t12411301t12501301t12412401t12413501t12412401t02412402t12412403t12512401t13512401t13512502t13502502t12512501t02512401t12502401t13512403t13613501t12512502t13513501t13613501t13613602t13613501t14713601t14725801t26926a01t38b47a01t47a00001t24500002t46901101t25845801t13624701t13613601t13512501t13613501t13613601t47b47b01t57934501t00000004t6ad6ac01t4bf4ae01t28b27b01t26a25901t26a26a01t38b37b01t4bf39e01t69b8cf01t00011101t00000002t24558b01t7be8bf01t47a25901t24713601t13512503t12502402t12412401t12512501t23624601t45745701t67978a01tabcabc01",
  "s------13tbce---01t88a---01t457ddf01t1349ab01t02467801t02424501t12401301t12402401t12412401t12312301t12412402t12412301t12412404t02402401t02412401t02412501t12412401t12512501t12412501t12412401t12512401t13512501t13612501t13613501t13613601t12512502t13613501t14713601t37b47a01t34657901t00000004t23434501t35835801t13513501t13613501t12512501t13613601t36a25801t5796ad01t00056701t00011101t00023301t0129cd01t9df6be01t39d27b01t26a26a01t14725801t25915801t27b25801t28c27a01t4ae28c01t69c38c01t44569d01t79a7ad01tadf36901t46a14801t24713601t13512501t12402401t02402405t13523501t34645701t56756801t89a9ac01tbbd---01",
  "s------18tabc---01t779---01t346bcd01t12488a01t01356701t12423401t12402301t12402401t12312401t12412401t12512401t12412406t12412301t12412401t12413501t12513501t13513602t13512401t12412302t12402301t12512401t24713501t9ce37a01t467adf01t0018bd01t0007ac01t2459ce01t7ac46901t24713601t13513501t12412402t12412301t14613501t26914701t6ad15801t6be27a01t8cf15901t7ad14701t16914701t26914701t25814601t14814701t14714701t14713601t15813501t26913602t15825801t14724701t14612401t14612501t13512401t12412401t02412402t02402403t12423501t34645701t45745701t67a9ac01tbbdddf01s------01",
  "s------1ctddf---01taab---01t778---01t346bbd01t12388901t01255701t12323401t12411301t12402301t12412303t12312302t12412401t13524601t11201201t00100001t12300001t12412301t12413501t01302302t01301301t12402301t13612401t24712401t36902501t46902501t24712501t03512501t13512401t12512401t12412404t13512401t14712501t15813501t14713501t13612501t13613502t13612502t13613602t13613502t12512501t13612501t13512401t12412404t12412302t12312401t12412501t13523501t34645601t45756701t679abc01tbcd---01s------02",
  "s------22t99a---01t667---01t345bbc01t12388901t01256701t11234501t11322301t12311201t12301201t24612301t35713501t23524601t13435701t24624601t13513401t12412401t02302302t02312301t02302301t12402301t12412302t12412409t12401301t12402301t12412301t12402302t12412301t12412401t12512401t12512501t12512401t1241240bt12513401t13534501t34656701t557abc01taacdef01tcdf---01s------03",
  "s------27tbbd---01t99b---01t789---01t557ddf01t234abc01t01388901t01366701t02344501t12423401t12412301t12401301t12301201t12311301t12312401t02312301t01312302t01311301t12311302t12411301t12412304t12412402t01302301t12312301t12302301t12312301t12312402t12412501t12412406t12312401t12312301t02312301t12412303t12423501t12478901t345bbd01t889def01tbcd---01s------06",
  "s------2etbcd---01taab---01t89a---01t778---01t556ddf01t345bcd01t234aac01t12399a01t01288a01t01267801t01245601t01334501t11322401t11312301t12311202t12301301t12302301t12301301t12412302t12312302t12311201t12311301t12401301t12402303t12401303t12412301t02323401t01345601t01388a01t123bcd01t446ddf01t88aeff01tbcd---01tdef---01s------09",
  "s------37tdef---01tcde---01tbbd---01taab---01t99a---01t889---01t778---01t667ddf01t567cde01t456cce01t445ccd01t345bcd03t334ccd01t345ccd01t345cce01t456dde01t557dde01t567ddf01t678eef01t889eff01t9abfff01tabc---01tccd---01tdef---01teff---01s------0e"
];
  return { start, stop };
})();
