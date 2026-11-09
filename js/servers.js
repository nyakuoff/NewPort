// fake remote servers for the terminal's `ssh` command. loaded the first time you connect (see js/terminal.js).
//
// built from what the show actually shows (the pilot):
//  - the "Dulles internal map" EVSERFL12-347: cs20 at the top, cs30 under it, ~20 cs## machines in all (the host list in ~/.ssh/config)
//  - E Corp's admin terminal, "eterm##$:", with `locate server <id>`, `astsu -info -backup -short`, `ps aux|grep root`,
//    `astu -ls ./root/fsociety/ -a` and `more readme.txt`. the server is WBKUW300PS345672, its backup is BKUW300PS345672
//  - ./root/fsociety/ holds fsociety00.dat and readme.txt ("LEAVE ME HERE"). on screen it's on the BACKUP server, reached through eterm,
//    so it lives only inside eterm's own filesystems below, not on cs30's disk
// everything else (the rest of the filesystem, logs, which hosts refuse you) is invented to make it feel like a real machine.
window.Servers = (function () {
  const f = (t, o) => Object.assign({ t }, o);
  const d = (c, o) => Object.assign({ c, ro: true }, o);      // dirs are read-only unless you're root, or the dir says otherwise
  const rw = c => d(c, { ro: false });
  const pad = (n, w, ch) => String(n).padStart(w, ch || "0");
  const stamp = (n, h, m, s) => { // syslog-style "Nov  9 03:12:41", n days ago
    const t = new Date(Date.now() - n * 864e5);
    return t.toLocaleString("en-US", { month: "short" }) + " " + pad(t.getDate(), 2, " ") + " " + [h, m, s].map(x => pad(x, 2)).join(":");
  };
  const last = () => {
    const t = new Date(Date.now() - 864e5);
    return t.toLocaleString("en-US", { weekday: "short" }) + " " + t.toLocaleString("en-US", { month: "short" }) + " " + pad(t.getDate(), 2, " ") + " 22:41:07 " + t.getFullYear();
  };
  const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeFakeFakeFakeFakeFakeFakeFakeFakeFakeKey";

  const NETMAP = [
    "# EVSERFL12-347    Dulles internal map", "",
    "  [ level 4 ]  [ level 5 ]", "        |", "      cs20", "        |",
    "        +-- cs30   cs51   cs46   cs52",
    "        +-- cs76   cs50   cs23   ded/1   cs47   cs36   cs49",
    "        |   cs22   cs71   cs29   cs34   cs35   cs32",
    "        |     cs47 -> cs59",
    "        |     cs22 -> cs39",
    "        +-- cs33     [!] link flagged", ""
  ].join("\n");

  const cs30 = () => d({
    bin: d({}), boot: d({}), dev: d({}), lib: d({}), tmp: rw({}),
    usr: d({ bin: d({}), lib: d({}), local: d({ bin: d({ eterm: { bin: true, mode: "-rwxr-xr-x" } }) }) }),
    // root's home. only root can look inside (sudo works). this is where the show's ./root/fsociety/ lives
    root: d({ ".bash_history": f("eterm\nless /var/log/ecorp/netwatch.log\nexit\n") }, { deny: true, mode: "drwx------" }),
    etc: d({
      hostname: f("cs30\n"),
      hosts: f("127.0.0.1\tlocalhost\n127.0.1.1\tcs30.ecorp.com cs30\n\n10.30.0.20\tcs20.ecorp.com cs20\n10.30.0.30\tcs30.ecorp.com cs30\n10.30.0.51\tcs51.ecorp.com cs51\n10.30.0.46\tcs46.ecorp.com cs46\n10.30.0.52\tcs52.ecorp.com cs52\n"),
      issue: f("Ubuntu 20.04.6 LTS \\n \\l\n"),
      "os-release": f('NAME="Ubuntu"\nVERSION="20.04.6 LTS (Focal Fossa)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 20.04.6 LTS"\nVERSION_ID="20.04"\n'),
      passwd: f([
        "root:x:0:0:root:/root:/bin/bash", "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin", "bin:x:2:2:bin:/bin:/usr/sbin/nologin",
        "sys:x:3:3:sys:/dev:/usr/sbin/nologin", "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin", "sshd:x:110:65534::/run/sshd:/usr/sbin/nologin",
        "ecorp-svc:x:1000:1000:E Corp service account:/srv/ecorp:/usr/sbin/nologin", "elliot:x:1001:1001:Elliot Alderson,,,:/home/elliot:/bin/bash"
      ].join("\n") + "\n"),
      crontab: f("# m h dom mon dow user  command\n17 *  * * *  root  cd / && run-parts --report /etc/cron.hourly\n30 2  * * *  ecorp-svc  /opt/ecorp/bin/ledgerd --snapshot\n0  4  * * *  ecorp-svc  /opt/ecorp/bin/ledgerd --ship-backup\n"),
      ssh: d({ sshd_config: f("Port 22\nPermitRootLogin no\nPubkeyAuthentication yes\nPasswordAuthentication no\nAllowUsers elliot ecorp-ops\nLogLevel INFO\n") }),
      sudoers: f("", { deny: true, mode: "-r--r-----" }),
      ecorp: d({
        netmap: f(NETMAP),
        "cs30.conf": f("# cs30: E Corp services node\nsection       = sectionus34567\nupstream      = cs20.ecorp.com\nadmin_tool    = /usr/local/bin/eterm\nserver        = WBKUW300PS345672\nbackup_server = BKUW300PS345672\nsnapshot_at   = 02:30\nnetwatch      = on\n")
      })
    }),
    home: d({ elliot: rw({
      ".bash_history": f([
        "cat /etc/ecorp/cs30.conf", "cat /var/log/ecorp/netwatch.log", "cat /opt/ecorp/README", "ls /usr/local/bin", "eterm", "exit"
      ].join("\n") + "\n", { own: "elliot" }),
      ".eterm_history": f([                 // eterm keeps its own history. these are the commands from the pilot
        "Map sectionus34567", "Locate server WBKUW300PS345672", "astsu - info -backup -short", "ps aux|grep root",
        "astu trace -pid 244 -", "locate server BKUW300PS345672", "astu -ls ./root/fsociety/ -a", "more readme.txt"
      ].join("\n") + "\n", { own: "elliot" }),
      ".bashrc": f("# ~/.bashrc\nalias ll='ls -alF'\nPS1='\\u@\\h:\\w\\$ '\n", { own: "elliot" }),
      ".profile": f("# ~/.profile\n[ -n \"$BASH_VERSION\" ] && . ~/.bashrc\n", { own: "elliot" }),
      ".ssh": rw({ authorized_keys: f(KEY + " elliot@allsafe\n", { own: "elliot", mode: "-rw-------" }) })
    }) }),
    opt: d({ ecorp: d({ bin: d({ ledgerd: { bin: true, mode: "-rwxr-xr-x" } }), README: f("E CORP / CS30\nledgerd is the only thing that should touch /srv/ecorp.\n\nserver and backup state are not on this box. use eterm (admin terminal):\n  eterm  ->  locate server <id>  ->  astsu / astu\nserver ids: see /etc/ecorp/cs30.conf\nquestions: ops@ecorp.com\n") }) }),
    srv: d({ ecorp: d({
      README: f("CS30: consumer ledger node.\nDo not edit these files by hand. Changes go through ledgerd.\n"),
      ledger: d({ "q2.csv": f("account_id,type,balance_usd,status\nEC-0048211,credit,-4120.55,open\nEC-0048212,credit,-318.00,open\nEC-0048213,savings,1204.10,open\nEC-0048214,credit,-9981.42,delinquent\nEC-0048215,savings,52.00,open\n", { own: "ecorp-svc" }) }),
      snapshots: d({})
    }) }),
    var: d({
      backups: d({}),
      log: d({
        "auth.log": f([
          stamp(1, 22, 41, 7) + " cs30 sshd[1843]: Accepted publickey for elliot from 10.30.0.14 port 50412 ssh2: ED25519 SHA256:Zk3q0fAkEfAkEfAkEfAkEfAkEfAkEfAkEfAkEfAkEfA",
          stamp(1, 22, 41, 7) + " cs30 sshd[1843]: pam_unix(sshd:session): session opened for user elliot by (uid=0)",
          stamp(0, 3, 8, 51) + " cs30 sshd[2190]: Failed publickey for invalid user admin from 203.0.113.77 port 40118 ssh2",
          stamp(0, 3, 9, 2) + " cs30 sshd[2192]: Connection closed by authenticating user root 203.0.113.77 port 40122 [preauth]",
          stamp(0, 3, 12, 41) + " cs30 sshd[2209]: Accepted publickey for elliot from 10.30.0.14 port 51022 ssh2: ED25519 SHA256:Zk3q0fAkEfAkEfAkEfAkEfAkEfAkEfAkEfAkEfAkEfA",
          stamp(0, 3, 12, 41) + " cs30 sshd[2209]: pam_unix(sshd:session): session opened for user elliot by (uid=0)",
          stamp(0, 3, 14, 5) + " cs30 sudo:   elliot : TTY=pts/0 ; PWD=/home/elliot ; USER=root ; COMMAND=/bin/ls -a /root/fsociety"
        ].join("\n") + "\n"),
        ecorp: d({ "netwatch.log": f([
          "[" + stamp(0, 3, 9, 12) + "] WARN   eth0 inbound SYN rate 41k/s (threshold 5k/s)",
          "[" + stamp(0, 3, 9, 40) + "] ALERT  14,832 distinct sources, top range 203.0.113.0/24",
          "[" + stamp(0, 3, 11, 3) + "] INFO   mitigation: rate limit engaged",
          "[" + stamp(0, 3, 12, 2) + "] WARN   rate limit ineffective, bypass suspected below the filter",
          "[" + stamp(0, 3, 12, 30) + "] ALERT  integrity check: unexpected process 'cpuset ./01dat' (pid 24) on WBKUW300PS345672",
          "[" + stamp(0, 3, 12, 31) + "] ALERT  unexpected directory on backup BKUW300PS345672: /root/fsociety",
          "[" + stamp(0, 3, 12, 31) + "] ALERT  cannot clear locally. escalate to security (allsafe)"
        ].join("\n") + "\n") }),
        syslog: f(stamp(0, 3, 12, 29) + " cs30 kernel: [412801.2] TCP: request_sock_TCP: Possible SYN flooding on port 443. Sending cookies.\n")
      })
    })
  });

  /* ---------------- eterm: E Corp's admin terminal, as seen on screen in the pilot ---------------- */
  const MAIN = "WBKUW300PS345672", BACKUP = "BKUW300PS345672";
  const PS = [ // `ps aux|grep root`, as shown (the cpuset line with ./01dat is the odd one)
    "1744 root      20    0  89320   14m   11m S  0.0  3.0   0:00.55 terminal",
    "   1 root      20    0   3648  2016  1312 S  0.0  0.4   0:00.72 init",
    "  24 root       0  -20      0     0     0 S  0.0  0.0   0:00.00 cpuset    ./01dat",
    "2452 root      20    0      0     0     0 S  0.0  0.5   0:00.00 evilscorpwbthread",
    "  36 root      20    0      0     0     0 S  0.0  0.0   0:00.00 evilscorpwbthread/0:0",
    "5985 root      20    0      0     0     0 S  0.0  0.1   0:00.28 evilscorpwbworker/u:0"
  ];
  const INFO = [
    "server: " + MAIN, "status: Online", "server: [23.234.45.66]", "server: default gateway: [23.234.45.1]",
    "server: domain: EVDBUSRG32U", "server: DNS: 45.85.123.10; 45.85.124.10; 45.85.125.10", "server: DNS gateway: 145.23.12.11", "bkup: " + BACKUP
  ];
  // what eterm sees on each server. the show's ./root/fsociety/ is on the backup one
  const dir = c => ({ c });
  const ETFS = {
    [MAIN]: dir({ bin: dir({}), etc: dir({ hostname: f(MAIN + "\n") }), home: dir({}), opt: dir({}), root: dir({ ".bash_history": f("") }), srv: dir({}), var: dir({}) }),
    [BACKUP]: dir({
      etc: dir({ hostname: f(BACKUP + "\n") }),
      root: dir({ fsociety: dir({ "fsociety00.dat": { bin: true }, "readme.txt": f("LEAVE ME HERE\n") }) }),
      var: dir({})
    })
  };
  // api = { print, esc, start(app), quit() } from js/terminal.js
  function eterm(api) {
    let ctx = null, cwd = [];
    const pre = () => "eterm##$:" + (ctx ? ctx + ":" : "");
    const tag = () => '<span class="et">' + api.esc(pre()) + "</span>";
    const out = line => api.print(tag() + "  " + api.esc(line));   // eterm echoes its answers behind the prompt, like on screen
    const plain = line => api.print(api.esc(line));
    const find = at => at.reduce((n, k) => (n && n.c && Object.prototype.hasOwnProperty.call(n.c, k) ? n.c[k] : null), ETFS[ctx]);
    const parts = p => { const o = p.startsWith("/") ? [] : cwd.slice(); p.split("/").forEach(s => { if (s === "..") o.pop(); else if (s && s !== ".") o.push(s); }); return o; };
    // paths are relative to where you last listed; if that finds nothing, try them from / (so the show's own commands always work)
    const where = p => { const a = parts(p); if (find(a)) return a; const b = []; p.split("/").forEach(x => { if (x === "..") b.pop(); else if (x && x !== ".") b.push(x); }); return find(b) ? b : a; };
    const run = line => {
      const t = line.trim().replace(/\s+/g, " "), L = t.toLowerCase();
      let m;
      if (!t) return;
      if (L === "exit" || L === "quit") { api.quit(); return plain("eterm: session closed"); }
      if (L === "help") return ["servers                       list the servers in this section", "locate server <id>           pick a server", "astsu - info -backup -short", "ps aux|grep root", "astu -ls [path] [-a]         list a directory on the server", "astu trace -pid <n> -", "more <file>", "exit                          back to the shell"].forEach(plain);
      if (L === "servers" || L === "locate" || L === "locate server") { plain("section sectionus34567:"); return [MAIN, BACKUP].forEach(id => plain("  " + id + (id === BACKUP ? "   (backup of " + MAIN + ")" : ""))); }
      if (/^(sudo|su|ls|ll|cd|cat|pwd|whoami|hostname|uname|ssh|echo|rm|mkdir|touch|tree|history|clear|date|play|quote|status)\b/.test(L))
        return plain("eterm: this is eterm, not the shell. type exit to go back.");
      if (/^map \S+/.test(L)) return;                       // nothing printed here on screen
      if ((m = t.match(/^locate server (\S+)/i))) {
        const id = m[1].toUpperCase();
        if (id !== MAIN && id !== BACKUP) return plain("eterm: server " + m[1] + " not found");
        ctx = id; cwd = []; return;
      }
      if (!ctx) return plain("eterm: no server selected. type servers to list them, then: locate server <id>");
      if (/^astsu\s*-?\s*info/.test(L)) return (ctx === MAIN ? INFO : ["server: " + BACKUP, "status: Online", "mirror of: " + MAIN]).forEach(out);
      if (/^ps aux\s*(\|\s*grep root)?$/.test(L)) return PS.forEach(out);
      if (/^astu trace -pid \d+/.test(L)) return;           // cut off on screen, no answer shown
      if ((m = t.match(/^astu\s*-ls\b\s*(.*)$/i))) {
        const args = m[1].split(" ").filter(Boolean), all = args.includes("-a"), path = args.find(x => x[0] !== "-") || ".";
        const at = where(path), n = find(at);
        if (!n || !n.c) return plain("astu: " + path + ": no such directory");
        cwd = at;
        return out(Object.keys(n.c).filter(k => all || k[0] !== ".").sort().join("   "));
      }
      if ((m = t.match(/^more\s+(\S+)/i))) {
        const at = where(m[1]), n = find(at);
        if (!n || n.c) return plain("more: " + m[1] + ": no such file");
        const name = at[at.length - 1];
        if (n.bin) return plain("more: " + name + ": binary file");
        plain("--------- " + name + " ----------"); plain("");
        (n.t || "").replace(/\n$/, "").split("\n").forEach(l => plain("     " + l));
        plain(""); return plain("-".repeat(31));
      }
      plain("eterm: " + t.split(" ")[0] + ": unknown command (try help)");
    };
    api.print(api.esc("eterm :: E Corp admin terminal. type help for commands, exit to leave."));
    api.start({ ps: () => tag(), run });
  }

  const made = {};
  return {
    eterm,
    // returns the session for a host: its filesystem, who you are, and the login banner
    connect(name) {
      if (made[name]) return made[name];
      return (made[name] = {
        fs: cs30(), user: "elliot", host: "cs30", fqdn: "cs30.ecorp.com", HOME: ["home", "elliot"], owner: "root",
        uname: "Linux cs30 5.15.0-91-generic #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux",
        banner: [
          "Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 5.15.0-91-generic x86_64)", "",
          " * E CORP / CS30. authorized use only. activity on this system is monitored and logged.",
          " * server admin: eterm   (see /opt/ecorp/README)", "",
          "Last login: " + last() + " from 10.30.0.14"
        ]
      });
    }
  };
})();
