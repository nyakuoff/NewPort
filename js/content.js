/* =====================================================================
   EDIT ME — all the text on the site lives in this file.
   save, refresh the page, done. (no build step)

   an "icon" can also be an image path, e.g. "assets/projects/snowify.png"
   (white-on-transparent png looks best).
   icons you can use (the "icon" fields):
     github discord youtube roblox x lastdotfm jellyfin
     pin gamepad cube layers sparkle music
   want another? add a <symbol> to assets/icons.svg.

   every list below: copy a line, change it, or delete it to remove it.
   ===================================================================== */

/* ---- your links (used in the footer, the elsewhere page, and project rows) ---- */
var LINKS = {
  github:  "https://github.com/nyakuoff",
  discord: "https://discord.gg/ey5e5aWcVW",
  email:   "mailto:nyakusfx@gmail.com",
  roblox:  "https://www.roblox.com/users/2452944056/profile",
  x:       "https://x.com/realnyaku"
};

var SITE = {
  name: "nyaku",                 // logo + copyright
  status: "probably coding",     // the little green dot in the header

  /* interests tags: shown on the work page and the about page.
     the green "+ more" tag is added for you; set moreTag to "" to hide it. */
  tags: ["gamedev", "roblox", "linux", "self-hosting", "sound design", "ai", "tech", "cinema"],
  moreTag: "+ more",

  /* the music player on the work page.
     folder: every song in here shows up in the player. after adding or removing
             songs run  python3 songs.py  (it rebuilds songs.json in that folder).
             name files "Title - Artist.mp3" — that's what the player displays, and
             what the cover art is looked up with (iTunes).
     volume: starting volume, 0-100. */
  music: { folder: "assets/medias/", volume: 30 },

  /* ---------------- work page ---------------- */
  home: {
    prompt: "whoami",
    title: "hey, i'm nyaku.",
    lead: "i make things, break things, and occasionally finish them.",

    doPrompt: "i doooo",
    doText: "i mainly build games, tools and things that just feel good to use. i like keeping it simple, efficient, and a bit personal.",

    workPrompt: "work",
    /* icon / title / desc / year / href */
    work: [
      { icon: "assets/projects/snowify.png", title: "Snowify", desc: "Free desktop music app that streams from YouTube Music.", year: "2026", href: "https://github.com/nyakuoff/Snowify" },
      { icon: "assets/projects/rivals.png", title: "Rivals Swapper", desc: "Marvel Rivals skin swapper written in rust.", year: "2026", href: "https://github.com/nyakuoff/Rivals-Swapper" },
      { icon: "assets/projects/cinelog.png", title: "Cinelog", desc: "self-hosted Letterboxd alternative for show and movie reviews.", year: "2026", href: "https://github.com/nyakuoff/Cinelog" }
    ],

    nowPrompt: "currently",
    now: "probably building something i'll never finish.",

    /* the little terminal window in the sidebar */
    terminal: { title: "kitty", prompt: "quote - Tyrell Wellick", lines: ["Life is so much easier when you’re numb."] },
    interestsPrompt: "interests"
  },

  /* ---------------- about page ---------------- */
  about: {
    prompt: "about",
    title: "a bit about me.",
    lead: "i’m Nyaku — a developer, designer, sound designer, and builder of systems and experiences.",

    infoPrompt: "quick info",
    /* icon / label / text */
    info: [
      { icon: "pin",      label: "location",  text: "Morocco." },
      { icon: "gamepad",  label: "focus",     text: "game dev — building games, tools, and playful systems." },
      { icon: "cube",     label: "tools",     text: "Lua, C/C++, Rust, and a mix of creative tools." },
      { icon: "layers",   label: "systems",   text: "engineering comfortable, simple, and reusable systems." },
      { icon: "sparkle",  label: "interests", text: "music, audio, sound design, emulation, and retro tech." }
    ],

    setup: { title: "fastfetch", prompt: "my setup", lines: [
      "os: CachyOS x86_64",
      "desktop: KDE Plasma",
      "wm: Wayland",
      "cpu: 12th Gen Intel(R) Core(TM) i7-12700K",
      "gpu: AMD Radeon RX 7800 XT",
      "memory: 32GB"
    ] },
    /* the interests window shows the same tags as above */
    interestsWindow: { title: "interests.sh", prompt: "interests" }
  },
  
  /* ---------------- elsewhere page ---------------- */
  elsewhere: {
    prompt: "elsewhere",
    title: "find me elsewhere.",
    lead: "these are the places where Nyaku posts updates, code, projects, or random things.",
    /* icon / title / desc / href */
    links: [
      { icon: "github",    title: "GitHub",  desc: "code, projects, and other things i build.",        href: LINKS.github },
      { icon: "discord",   title: "Discord", desc: "hang out, chat, or follow small updates.",         href: LINKS.discord },
      { icon: "roblox",    title: "Roblox",  desc: "my Roblox profile, games, and experiments.",       href: LINKS.roblox },
      { icon: "x",         title: "X",       desc: "quick updates, progress, and random thoughts.",    href: LINKS.x }
    ],
    status: { title: "kitty", prompt: "status", lines: ["usually coding, listening to music, or working on something new."] }
  },

  /* footer: label + url, in order */
  footer: [
    ["github", LINKS.github],
    ["discord", LINKS.discord],
    ["email", LINKS.email]
  ]
};
