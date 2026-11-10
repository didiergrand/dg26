/* js/consent.js adds its cookie banner to <body>; it belongs to the footer, beside the legal links. */
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    var b = document.getElementById("cookie-banner"), f = document.querySelector("footer.closing");
    if (b && f) f.appendChild(b);
  });
});
