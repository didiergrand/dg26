/* Bandeau cookies + outils de mesure (Google Analytics, pixel Meta).
   Rien n'est chargé tant que le visiteur n'a pas cliqué sur « Accepter ».
   Le choix est mémorisé dans le navigateur (clé "dg-cookies" : "oui" ou "non").
   Pour rouvrir le bandeau : un lien vers "#cookies". */
(function () {
  // Identifiant Google Analytics 4 (format G-XXXXXXXXXX). Vide = désactivé.
  var GA_ID = "G-2LS4CP49KQ";
  // Le pixel Meta n'est actif que sur les pages qui définissent window.META_PIXEL_ID.
  var META_ID = window.META_PIXEL_ID || "";

  if (!GA_ID && !META_ID) return;

  var KEY = "dg-cookies";
  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function addScript(src) {
    var s = document.createElement("script");
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function loadGA() {
    if (!GA_ID || window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_ID);
    addScript("https://www.googletagmanager.com/gtag/js?id=" + GA_ID);
  }

  function loadMeta() {
    if (!META_ID || window.fbq) return;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", META_ID);
    fbq("track", "PageView");
  }

  function loadAll() { loadGA(); loadMeta(); }

  // Efface les cookies de mesure déjà posés (si le visiteur retire son accord).
  function clearCookies() {
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name)) {
        ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      }
    });
  }

  if (getChoice() === "oui") loadAll();

  function buildBanner() {
    var tools = [];
    if (GA_ID) tools.push("Google Analytics pour mesurer l’audience");
    if (META_ID) tools.push("le pixel Meta pour mesurer l’efficacité de ses publicités");
    var box = document.createElement("div");
    box.className = "cookie-banner";
    box.id = "cookie-banner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Cookies");
    box.hidden = true;
    box.innerHTML =
      "<p>Ce site utilise " + tools.join(" et ") + ". Acceptez-vous ces cookies&nbsp;? " +
      '<a href="confidentialite.html">En savoir plus</a></p>' +
      '<div class="cb-actions"><button type="button" class="cb-no" data-choice="non">Refuser</button>' +
      '<button type="button" class="cb-yes" data-choice="oui">Accepter</button></div>';
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      var c = e.target && e.target.getAttribute("data-choice");
      if (!c) return;
      var before = getChoice();
      setChoice(c);
      hide();
      if (c === "oui") loadAll();
      else if (before === "oui") { clearCookies(); location.reload(); }
    });
    return box;
  }

  var box;
  function show() { box.hidden = false; document.body.classList.add("cb-open"); }
  function hide() { box.hidden = true; document.body.classList.remove("cb-open"); }

  function init() {
    box = buildBanner();
    if (!getChoice()) show();
    function reopen() { if (location.hash === "#cookies") show(); }
    window.addEventListener("hashchange", reopen);
    reopen();
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href$="#cookies"]');
      if (a && a.pathname === location.pathname) { e.preventDefault(); show(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
