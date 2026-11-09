// a fake shell for terminal.html: in-memory filesystem + a handful of commands.
// everything lives at module level, so it survives the page swaps done by js/nav.js.
// the site commands (quote, fastfetch, status, ./interests.sh) read their text from SITE (js/content.js).
(function () {
  const T = SITE.terminal, H = SITE.home, A = SITE.about, E = SITE.elsewhere;
  const user = T.user, host = T.host, HOME = ["home", user];
  const esc = UI.esc;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const when = new Date().toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");

  /* ---------------- filesystem: dir = {c:{...}}, file = {t:"text"}; run = script name, bin = binary ---------------- */
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mine = { c: {
    "about.txt": { t: [A.lead, ""].concat(A.info.map(i => i.label.padEnd(10) + i.text)).join("\n") + "\n" },
    "interests.sh": { run: "interests", t: [
      "#!/bin/bash", "# what i'm into",
      "tags=(" + SITE.tags.map(t => (/\s/.test(t) ? '"' + t + '"' : t)).join(" ") + ")",
      'for t in "${tags[@]}"; do printf "[%s] " "$t"; done; echo'
    ].join("\n") + "\n" },
    "ocarina.sh": { run: "ocarina", t: "#!/bin/bash\n# a tiny ocarina. a + arrow keys play, q quits.\nexec ocarina --notes=A,D,R,L,U --songbook=12\n" },
    "links.txt": { t: E.links.map(l => l.title.padEnd(10) + l.href).join("\n") + "\n" },
    projects: { c: {} },
    music: { c: {} },
    ".bashrc": { t: "# ~/.bashrc\nalias ll='ls -l'\nexport EDITOR=nvim\n" },
    ".secret": { t: "you found it.\nthere's nothing here but a sleeping cat. zzz\n" }
  } };
  H.work.forEach(w => { mine.c.projects.c[slug(w.title) + ".md"] = { t: "# " + w.title + "\n\n" + w.desc + "\n\n" + w.year + "  " + w.href + "\n" }; });
  const fs = { c: {
    home: { c: { [user]: mine } },
    etc: { c: { hostname: { t: host + "\n" }, "os-release": { t: 'NAME="CachyOS Linux"\nID=cachyos\nID_LIKE=arch\n' } } },
    tmp: { c: {} }
  } };
  fetch(SITE.music.folder + "songs.json").then(r => r.json()).then(list => {
    list.forEach(f => { mine.c.music.c[f.replace(/ /g, "_")] = { bin: true }; });
  }).catch(() => {});

  const S = { cwd: HOME.slice(), prev: HOME.slice(), hist: [], out: "" };
  let root, outEl, bodyEl, inEl, psEl, hi = 0, draft = "";

  const resolve = p => {
    if (p === "~" || p.startsWith("~/")) p = "/home/" + user + p.slice(1);
    const out = p[0] === "/" ? [] : S.cwd.slice();
    p.split("/").forEach(s => { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); });
    return out;
  };
  const node = parts => parts.reduce((n, k) => (n && n.c && has(n.c, k) ? n.c[k] : null), fs);
  const pretty = parts => {
    const h = HOME.join("/"), s = parts.join("/");
    return s === h ? "~" : s.startsWith(h + "/") ? "~" + s.slice(h.length) : "/" + s;
  };
  const ps = () => "<b>" + esc(user + "@" + host) + "</b> <i>" + esc(pretty(S.cwd)) + "</i> $";

  const print = html => { outEl.insertAdjacentHTML("beforeend", '<div class="ln">' + html + "</div>"); };
  const text = s => print(esc(s));
  const item = (name, n) => '<span class="' + (n.c ? "d" : n.run ? "x" : "") + '">' + esc(name) + "</span>";
  const perm = n => (n.c ? "drwxr-xr-x" : n.run ? "-rwxr-xr-x" : "-rw-r--r--");
  const size = n => (n.c ? 4096 : n.bin ? 4194304 : (n.t || "").length);
  // split into [parent dir node, name] for creating / removing things; null if the parent doesn't exist
  const parentOf = p => { const parts = resolve(p), dir = node(parts.slice(0, -1)); return dir && dir.c && parts.length ? [dir, parts[parts.length - 1]] : null; };

  /* ---------------- scripts you can run with ./name ---------------- */
  // the ocarina is big, so it's only fetched the first time you run it
  const loadOcarina = () => new Promise((ok, no) => {
    if (window.Ocarina) return ok();
    const el = document.createElement("script");
    el.src = "js/ocarina.js"; el.onload = ok; el.onerror = no;
    document.head.appendChild(el);
  });
  const SCRIPTS = {
    interests() { text(SITE.tags.map(t => "[" + t + "]").join(" ")); },
    ocarina() {
      loadOcarina().then(() => {
        if (!bodyEl || !bodyEl.isConnected) return; // you left the page while it was loading
        inEl.blur();
        Ocarina.start({ host: bodyEl, onExit: silent => { if (silent) return; inEl.focus({ preventScroll: true }); refresh(); } });
      }, () => text("bash: ./ocarina.sh: failed to load (are you offline?)"));
    }
  };

  /* ---------------- commands: s = shown in the "site" group of help, d = description, u = usage ---------------- */
  const C = {
    help: { s: 1, d: "list the commands", f() {
      const row = (c, u, d) => '<b>' + esc(u || c) + "</b><span>" + esc(d) + "</span>";
      const group = (title, s) => Object.keys(C).filter(k => C[k].d && !!C[k].s === s).map(k => row(k, C[k].u, C[k].d)).join("");
      print('<span class="dim">site</span>\n<div class="help">' + group("site", true) + '<b>./interests.sh</b><span>what i\'m into (it\'s in ~)</span><b>./ocarina.sh</b><span>play the ocarina (a + arrow keys)</span></div>');
      print('\n<span class="dim">shell</span>\n<div class="help">' + group("shell", false) + "</div>");
      print('\n<span class="dim">tip: tab completes, ↑ ↓ browse history. try</span> ls <span class="dim">then</span> cat about.txt');
    } },
    quote: { s: 1, d: "a line i like", f() {
      const who = (H.terminal.prompt.match(/-\s*(.+)$/) || [])[1];
      text(H.terminal.lines.join(" "));
      if (who) print('<span class="dim">— ' + esc(who) + "</span>");
    } },
    fastfetch: { s: 1, d: "my setup", f() {
      const logo = ["      /\\      ", "     /  \\     ", "    /    \\    ", "   /  /\\  \\   ", "  /  /  \\  \\  ", " /__/    \\__\\ "].join("\n");
      const head = user + "@" + host;
      const lines = A.setup.lines.map(l => { const i = l.indexOf(": "); return '<span class="k">' + esc(l.slice(0, i)) + "</span>: " + esc(l.slice(i + 2)); });
      const pal = ["#555", "#e5484d", "#28c840", "#febc2e", "#7aa2f7", "#c678dd", "#56b6c2", "#ddd"].map(c => '<span style="background:' + c + '"></span>').join("");
      print('<div class="ff"><pre>' + esc(logo) + '</pre><div><span class="k">' + esc(head) + "</span>\n" + "-".repeat(head.length) + "\n" + lines.join("\n") + '\n\n<span class="pal">' + pal + "</span></div></div>");
    } },
    status: { s: 1, d: "what i'm up to", f() { E.status.lines.forEach(text); } },

    ls: { u: "ls [-al] [dir]", d: "list files (ll = ls -l)", f(a) {
      const flags = a.filter(x => x[0] === "-").join(""), paths = a.filter(x => x[0] !== "-");
      const all = flags.includes("a"), long = flags.includes("l");
      (paths.length ? paths : ["."]).forEach((p, i, arr) => {
        const n = node(resolve(p));
        if (!n) return text("ls: cannot access '" + p + "': No such file or directory");
        if (arr.length > 1) text((i ? "\n" : "") + p + ":");
        const entries = n.c ? Object.keys(n.c).filter(k => all || k[0] !== ".").sort().map(k => [k, n.c[k]]) : [[p, n]];
        if (long) entries.forEach(([k, e]) => print(esc(perm(e) + " 1 " + user + " " + user + " " + String(size(e)).padStart(7) + " " + when + " ") + item(k, e)));
        else if (entries.length) print('<div class="ls">' + entries.map(([k, e]) => item(k, e)).join("") + "</div>");
      });
    } },
    cd: { u: "cd [dir]", d: "change directory", f(a) {
      const t = a[0] || "~", parts = t === "-" ? S.prev : resolve(t), n = node(parts);
      if (!n) return text("bash: cd: " + t + ": No such file or directory");
      if (!n.c) return text("bash: cd: " + t + ": Not a directory");
      S.prev = S.cwd; S.cwd = parts;
      if (t === "-") text(pretty(parts));
    } },
    pwd: { d: "where am i", f() { text("/" + S.cwd.join("/")); } },
    cat: { u: "cat <file>", d: "print a file", f(a) {
      if (!a.length) return text("cat: give me a file (try cat about.txt)");
      a.forEach(p => {
        const n = node(resolve(p));
        if (!n) text("cat: " + p + ": No such file or directory");
        else if (n.c) text("cat: " + p + ": Is a directory");
        else if (n.bin) text("cat: " + p + ": binary file (there's a player for that, up in the nav)");
        else text((n.t || "").replace(/\n$/, ""));
      });
    } },
    tree: { u: "tree [dir]", d: "directory tree", f(a) {
      const p = a.find(x => x[0] !== "-") || ".", all = a.includes("-a"), n = node(resolve(p));
      if (!n) return text(p + " [error opening dir]");
      let dirs = 0, files = 0;
      const lines = [item(p, n)];
      (function walk(d, pre) {
        if (!d.c) return;
        const ks = Object.keys(d.c).filter(k => all || k[0] !== ".").sort();
        ks.forEach((k, i) => {
          const last = i === ks.length - 1, c = d.c[k];
          lines.push(pre + (last ? "└── " : "├── ") + item(k, c));
          c.c ? dirs++ : files++;
          walk(c, pre + (last ? "    " : "│   "));
        });
      })(n, "");
      print(lines.join("\n") + "\n\n" + dirs + " directories, " + files + " files");
    } },
    echo: { u: "echo <text> [> file]", d: "print text, or write it to a file", f(a) {
      const i = a.findIndex(t => t === ">" || t === ">>");
      if (i < 0) return text(a.join(" "));
      const target = a[i + 1], at = target && parentOf(target);
      if (!target) return text("bash: syntax error near unexpected token `newline'");
      if (!at) return text("bash: " + target + ": No such file or directory");
      const old = has(at[0].c, at[1]) ? at[0].c[at[1]] : null;
      if (old && (old.c || old.bin)) return text("bash: " + target + ": cannot write to it");
      at[0].c[at[1]] = Object.assign(old || {}, { t: (a[i] === ">>" && old ? old.t : "") + a.slice(0, i).join(" ") + "\n" });
    } },
    mkdir: { u: "mkdir <dir>", d: "new directory", f(a) {
      a.filter(x => x[0] !== "-").forEach(p => {
        const at = parentOf(p);
        if (!at) text("mkdir: cannot create directory '" + p + "': No such file or directory");
        else if (has(at[0].c, at[1])) text("mkdir: cannot create directory '" + p + "': File exists");
        else at[0].c[at[1]] = { c: {} };
      });
    } },
    touch: { u: "touch <file>", d: "new empty file", f(a) {
      a.forEach(p => {
        const at = parentOf(p);
        if (!at) text("touch: cannot touch '" + p + "': No such file or directory");
        else if (!has(at[0].c, at[1])) at[0].c[at[1]] = { t: "" };
      });
    } },
    rm: { u: "rm [-r] <path>", d: "remove (in this fake fs only, promise)", f(a) {
      const flags = a.filter(x => x[0] === "-").join(""), force = flags.includes("f"), rec = flags.includes("r") || flags.includes("R");
      a.filter(x => x[0] !== "-").forEach(p => {
        const at = parentOf(p);
        if (!at) return text(resolve(p).length ? "rm: cannot remove '" + p + "': No such file or directory" : "rm: it is dangerous to operate recursively on '/'");
        const n = has(at[0].c, at[1]) ? at[0].c[at[1]] : null;
        if (!n) return force || text("rm: cannot remove '" + p + "': No such file or directory");
        if (n.c && !rec) return text("rm: cannot remove '" + p + "': Is a directory");
        delete at[0].c[at[1]];
        while (!node(S.cwd)) S.cwd = S.cwd.slice(0, -1); // you deleted the dir you were standing in
      });
    } },
    play: { u: "play [n|name]", d: "play a song from ~/music (no args lists them)", f(a) {
      const P = window.PlayerAPI, list = P ? P.list() : [];
      if (!list.length) return text("play: no songs found in ~/music");
      const now = () => list[P.index()];
      const marker = i => (i === P.index() && P.playing() ? '<span class="x">▶</span>' : " ");
      const arg = a.join(" ").trim();
      if (!arg) {
        list.forEach((t, i) => print(marker(i) + ' <span class="dim">' + (i + 1) + "</span> " + esc(t.title) + ' <span class="dim">— ' + esc(t.artist) + "</span>"));
        return print('<span class="dim">play &lt;n&gt; or play &lt;name&gt; to start one</span>');
      }
      const norm = x => x.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[\s_]+/g, " ").trim();
      const needle = norm(arg.split("/").pop());
      let i = /^\d+$/.test(arg) ? +arg - 1 : list.findIndex(t => norm(t.file) === needle);
      if (i < 0 || isNaN(i)) i = list.findIndex(t => norm(t.file).includes(needle) || t.title.includes(needle));
      if (!list[i]) return text("play: no such song: " + arg + " (try play with no arguments)");
      P.play(i);
      print('<span class="x">▶</span> now playing: ' + esc(list[i].title) + ' <span class="dim">— ' + esc(list[i].artist) + "</span>");
    } },
    pause: { d: "pause the music", f() { if (window.PlayerAPI) PlayerAPI.pause(); text("paused"); } },
    next: { d: "next song", f() { if (!window.PlayerAPI || !PlayerAPI.list().length) return text("next: nothing to play"); PlayerAPI.next(); const t = PlayerAPI.list()[PlayerAPI.index()]; print('<span class="x">▶</span> now playing: ' + esc(t.title) + ' <span class="dim">— ' + esc(t.artist) + "</span>"); } },
    prev: { d: "previous song", f() { if (!window.PlayerAPI || !PlayerAPI.list().length) return text("prev: nothing to play"); PlayerAPI.prev(); const t = PlayerAPI.list()[PlayerAPI.index()]; print('<span class="x">▶</span> now playing: ' + esc(t.title) + ' <span class="dim">— ' + esc(t.artist) + "</span>"); } },
    clear: { d: "clear the screen (ctrl+l)", f() { outEl.innerHTML = ""; } },
    whoami: { d: "who am i", f() { text(user); } },
    hostname: { d: "this machine", f() { text(host); } },
    uname: { u: "uname [-a]", d: "system info", f(a) { text(a.includes("-a") ? "Linux " + host + " 7.3.1-1-cachyos #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux"); } },
    date: { d: "the date", f() { text(new Date().toString().replace(/ GMT.*/, "")); } },
    history: { d: "what you typed", f() { text(S.hist.map((h, i) => String(i + 1).padStart(5) + "  " + h).join("\n")); } },
    sudo: { f() { text(user + " is not in the sudoers file. This incident will be reported."); } },
    exit: { f() { text("logout\n(not really. use the nav up top)"); } }
  };
  C.ll = { d: "", f(a) { C.ls.f(["-l"].concat(a)); } };

  function exec(cmd) {
    const n = node(resolve(cmd));
    if (!n) return text("bash: " + cmd + ": No such file or directory");
    if (n.c) return text("bash: " + cmd + ": Is a directory");
    if (!n.run) return text("bash: " + cmd + ": Permission denied");
    SCRIPTS[n.run]();
  }
  // unquoted * and ? expand against the directory, like a real shell (no match = left as typed)
  function glob(t) {
    if (!/[*?]/.test(t)) return [t];
    const i = t.lastIndexOf("/"), dir = t.slice(0, i + 1), pat = t.slice(i + 1), n = node(resolve(dir || "."));
    const re = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    const hit = n && n.c ? Object.keys(n.c).filter(k => re.test(k) && (k[0] !== "." || pat[0] === ".")).sort().map(k => dir + k) : [];
    return hit.length ? hit : [t];
  }
  function run(line) {
    const toks = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].flatMap(m => (m[3] !== undefined ? glob(m[3]) : [m[1] !== undefined ? m[1] : m[2]]));
    if (!toks.length) return;
    const cmd = toks[0], args = toks.slice(1);
    if (has(C, cmd)) C[cmd].f(args);
    else if (cmd.includes("/")) exec(cmd);
    else text("bash: " + cmd + ": command not found");
  }

  /* ---------------- input handling ---------------- */
  function refresh() {
    psEl.innerHTML = ps();
    root.querySelector(".term-bar span").textContent = user + "@" + host + ": " + pretty(S.cwd);
    S.out = outEl.innerHTML;
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
  function submit() {
    const line = inEl.value;
    print('<span class="ps">' + ps() + "</span> " + esc(line));
    inEl.value = "";
    if (line.trim()) S.hist.push(line);
    hi = S.hist.length; draft = "";
    try { run(line); } catch (e) { text("bash: something broke: " + e.message); }
    refresh();
  }
  function complete() {
    const v = inEl.value, m = v.match(/^(.*?)(\S*)$/), head = m[1], word = m[2];
    let cands;
    if (!head.trim() && !word.includes("/")) cands = Object.keys(C).filter(k => k.startsWith(word) && k !== "ll" || k === word);
    else {
      const i = word.lastIndexOf("/"), dir = word.slice(0, i + 1), base = word.slice(i + 1), n = node(resolve(dir || "."));
      if (!n || !n.c) return;
      cands = Object.keys(n.c).filter(k => k.startsWith(base) && (base || k[0] !== ".")).sort().map(k => dir + k + (n.c[k].c ? "/" : ""));
    }
    if (!cands.length) return;
    if (cands.length === 1) { inEl.value = head + cands[0] + (cands[0].endsWith("/") ? "" : " "); return; }
    let p = cands[0];
    cands.forEach(c => { while (!c.startsWith(p)) p = p.slice(0, -1); });
    if (p.length > word.length) inEl.value = head + p;
    else { print('<span class="ps">' + ps() + "</span> " + esc(v)); print('<div class="ls">' + cands.map(c => "<span>" + esc(c) + "</span>").join("") + "</div>"); refresh(); }
  }
  function keydown(e) {
    if (e.key === "Enter") submit();
    else if (e.key === "Tab") { e.preventDefault(); complete(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (hi === S.hist.length) draft = inEl.value;
      hi = Math.max(0, Math.min(S.hist.length, hi + (e.key === "ArrowUp" ? -1 : 1)));
      inEl.value = hi === S.hist.length ? draft : S.hist[hi];
    } else if (e.ctrlKey && e.key === "l") { e.preventDefault(); C.clear.f(); refresh(); }
    else if (e.ctrlKey && e.key === "u") { e.preventDefault(); inEl.value = ""; }
    else if (e.ctrlKey && e.key === "c") { e.preventDefault(); print('<span class="ps">' + ps() + "</span> " + esc(inEl.value) + "^C"); inEl.value = ""; refresh(); }
  }

  // called on first load and after every page swap (js/nav.js)
  window.TermMount = function () {
    if (window.Ocarina) Ocarina.stop(true); // the page was swapped out from under it
    root = document.querySelector("[data-shell]");
    if (!root) return;
    root.innerHTML = UI.bar({ title: "" }) +
      '<div class="term-body sh"><div class="sh-out"></div><div class="sh-line"><span class="ps"></span>' +
      '<input class="sh-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="terminal input"></div></div>';
    outEl = root.querySelector(".sh-out"); bodyEl = root.querySelector(".sh");
    inEl = root.querySelector(".sh-in"); psEl = root.querySelector(".ps");
    if (S.out) outEl.innerHTML = S.out;
    else print(esc(T.welcome).replace(/\bhelp\b/, "<b>help</b>") + "\n");
    hi = S.hist.length;
    inEl.addEventListener("keydown", keydown);
    root.addEventListener("click", () => { if (!getSelection().toString()) inEl.focus(); });
    refresh();
    if (matchMedia("(hover: hover)").matches) inEl.focus({ preventScroll: true });
  };
  TermMount();
})();
