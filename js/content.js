/* =====================================================================
   EDIT ME — everything you'd want to change lives in this file.
   ===================================================================== */

/* ---- the song in nyamp ----
   drop an mp3 in assets/medias/ and put its exact filename here.
   keep the "Title - Artist.mp3" format, the player reads it for the display */
var SONG = "Punkrocker - Teddybears.mp3";

/* ---- my_works ----
   each one becomes an item in the my_works folder + a card on the homepage.
   double-clicking opens its own page.
     title  : name shown everywhere
     role   : what you did on it
     where  : platform / studio, shown under the title
     thumb  : image path
     desc   : a paragraph or two (plain text, blank line = new paragraph)
     link   : optional — "Visit" button on its page (game page, store page...)
     embed  : optional — youtube/soundcloud EMBED url, shows a player on its page */
var WORKS = [
  {
    title: "Grand Piece Online",
    role: "Sound Design",
    where: "Roblox",
    thumb: "assets/works/gpo.jpg",
    desc: "Sound design for Grand Piece Online.",
    link: "",
    embed: ""
  },
  {
    title: "Abiotic Factor",
    role: "Sound Design",
    where: "PC",
    thumb: "assets/works/abf.jpg",
    desc: "Sound design for Abiotic Factor.",
    link: "",
    embed: ""
  },
  {
    title: "Golden Piece Adventure",
    role: "Front-End Scripting",
    where: "Roblox",
    thumb: "assets/works/gpa.jpg",
    desc: "Front-end scripting for Golden Piece Adventure.",
    link: "",
    embed: ""
  },
  {
    title: "RELL Seas",
    role: "Sound Design",
    where: "Roblox",
    thumb: "assets/works/rellseas.jpg",
    desc: "Sound design for RELL Seas.",
    link: "",
    embed: ""
  }
];

/* ---- games ----
   each one becomes an icon in the games folder. double-click opens
   the url inside a window.
     name : label under the icon + window title
     icon : any image, square works best (png/ico). leave "" for the default app icon
     url  : the page that IS the game (itch.io embed links, your own builds, etc)
     w, h : optional size of the game area, defaults to 1280 x 720
            (shrinks to fit smaller screens, and every window can be resized)

   heads up: some sites refuse to load inside a window (they block iframes).
   if one shows up blank, use its embed/"fullscreen" url instead — on itch.io
   that's the https://html-classic.itch.zone/html/... link.
   games that need "shared memory" (cross-origin isolation) work in chrome/edge.

   example:
   { name: "my cool game", icon: "img/game-icons/cool.png", url: "https://example.com/game/" },
*/
var GAMES = [
  { name: "Call of Duty: Black Ops",
    icon: "img/game-icons/blackops.png",
    url: "https://vel.gg/"
  },
  { name: "osu!",
    icon: "img/game-icons/osu.ico",
    url: "https://wosu.dino.icu/"
  },
];

/* ---- roblox ----
   the "Roblox" app on the desktop: a games site that looks games up live.
     picks  : place ids shown at the top as "nyaku's picks". a place id is
              the number in a game's link: roblox.com/games/1730877806/... -> 1730877806
     charts : true = also show roblox's live charts (top trending, top playing...)
     icon   : optional square icon for the app, "" = default app icon
     logo   : optional image for the site's header logo (e.g. "img/roblox-logo.png"),
              "" = plain "ROBLOX" text. keep it around 40-50px tall
   clicking Play asks first, then opens play.roblox.com in a popup window,
   which uses whatever roblox account the visitor is already signed into. */
var ROBLOX = {
  picks: [1730877806, 10449761463],
  charts: true,
  icon: "img/game-icons/roblox.ico",
  logo: "img/Roblox_logo.webp"
};
