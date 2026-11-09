// fills the pages from SITE (js/content.js). html only holds layout + [data-t] / [data-render] hooks.
window.renderPage = (function () {
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var get = function (path) { return path.split(".").reduce(function (o, k) { return o && o[k]; }, SITE); };
  // icon = a sprite name, or an image path (anything with a "/")
  var icon = function (n) {
    return /\//.test(n || "") ? '<img class="i" src="' + esc(n) + '" alt="">'
      : '<svg class="i"><use href="assets/icons.svg#' + esc(n || "sparkle") + '"/></svg>';
  };
  var go = icon("arrow-ur").replace('class="i"', 'class="i go"');
  var tags = function () {
    return SITE.tags.concat(SITE.moreTag ? [null] : []).map(function (t) {
      return t === null ? '<li class="more">' + esc(SITE.moreTag) + "</li>" : "<li>" + esc(t) + "</li>";
    }).join("");
  };
  var bar = function (t) { return '<div class="term-bar"><span>' + esc(t.title) + '</span><div class="wm" aria-hidden="true"><i class="min"></i><i class="max"></i><i class="cls"></i></div></div>'; };

  var R = {
    logo: function () { return esc(SITE.name) + "<b>.</b>"; },
    tags: tags,
    work: function () {
      return get("home.work").map(function (w) {
        return '<li><a href="' + esc(w.href) + '"><span class="tile">' + icon(w.icon) + '</span><span class="txt"><b>' + esc(w.title) +
          "</b><small>" + esc(w.desc) + '</small></span><span class="meta">' + esc(w.year) + "</span>" + go + "</a></li>";
      }).join("");
    },
    links: function () {
      return get("elsewhere.links").map(function (w) {
        return '<li><a href="' + esc(w.href) + '"><span class="tile">' + icon(w.icon) + '</span><span class="txt"><b>' + esc(w.title) +
          "</b><small>" + esc(w.desc) + "</small></span>" + go + "</a></li>";
      }).join("");
    },
    info: function () {
      return get("about.info").map(function (w) {
        return '<li><span class="tile">' + icon(w.icon) + '</span><span class="txt"><b>' + esc(w.label) + "</b><small>" + esc(w.text) + "</small></span></li>";
      }).join("");
    },
    // a terminal window: data-src points at {title, prompt, lines}. no lines = show the tags instead.
    term: function (el) {
      var t = get(el.dataset.src), n = (t.lines || []).length;
      var body = t.lines
        ? t.lines.map(function (l, i) { return '<p class="out">' + esc(l) + (i === n - 1 ? '<span class="cur sm"></span>' : "") + "</p>"; }).join("")
        : '<ul class="tags">' + tags() + "</ul>";
      return bar(t) + '<div class="term-body"><p class="prompt">' + esc(t.prompt) + "</p>" + body + "</div>";
    },
    footer: function () {
      return '<p class="links">' + SITE.footer.map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + "</a>"; }).join("<span>/</span>") +
        "</p><p>© " + new Date().getFullYear() + " " + esc(SITE.name) + ".</p>";
    }
  };

  // fills every [data-t] / [data-render] in the page (js/nav.js calls this again after each page swap)
  return function () {
    document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = get(el.dataset.t); });
    document.querySelectorAll("[data-render]").forEach(function (el) { el.innerHTML = R[el.dataset.render](el); });
  };
})();
renderPage();
