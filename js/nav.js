// page changes without a reload, so the <audio> in js/player.js keeps playing between pages.
// fetches the target page and swaps in its .wrap; anything that fails falls back to a normal navigation.
(function () {
  function go(url, push) {
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      document.title = doc.title;
      document.querySelector(".wrap").innerHTML = doc.querySelector(".wrap").innerHTML;
      if (push) history.pushState(null, "", url);
      renderPage();
      PlayerSync();
      TermMount();
      scrollTo(0, 0);
    }).catch(function () { location.href = url; });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    var u = new URL(a.href);
    if (u.origin !== location.origin || !/(\.html|\/)$/.test(u.pathname)) return;
    e.preventDefault();
    if (u.href !== location.href) go(u.href, true); else scrollTo(0, 0);
  });
  addEventListener("popstate", function () { go(location.href, false); });
})();
