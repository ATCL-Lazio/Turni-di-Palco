(function () {
  var localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (localHosts.has(window.location.hostname)) return;
  var manifestLink = document.createElement("link");
  manifestLink.rel = "manifest";
  manifestLink.href = "/mobile/manifest.webmanifest";
  manifestLink.crossOrigin = "use-credentials";
  document.head.appendChild(manifestLink);
})();
