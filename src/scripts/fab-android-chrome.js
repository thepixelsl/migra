(() => {
  const ua = navigator.userAgent || "";
  // Do not touch iOS, desktop browsers, Android WebViews or other Android browsers.
  if (
    !/Android/i.test(ua)
    || !/\bChrome\/\d+/i.test(ua)
    || /iPhone|iPad|iPod|CriOS|EdgA|OPR|SamsungBrowser|Vivaldi|YaBrowser|UCBrowser|DuckDuckGo|Silk|;\s*wv\b/i.test(ua)
    || /iPhone|iPad|iPod|Mac/i.test(navigator.platform || "")
  ) return;

  const brands = navigator.userAgentData?.brands;
  if (brands && !brands.some(({ brand }) => brand === "Google Chrome")) return;
  if (!CSS.supports("backdrop-filter", "blur(1px)")) return;

  const panels = [...document.querySelectorAll(".floating-action__menu[data-floating-action-panel]")]
    .filter((panel) => getComputedStyle(panel).getPropertyValue("backdrop-filter") === "none");
  if (!panels.length) return;

  // The production CSS minifier retains only -webkit-backdrop-filter for the FAB.
  // Restore the existing filter on Android Chrome without editing shared CSS or alpha.
  const narrowViewport = window.matchMedia("(max-width: 480px)");
  const applyBackdrop = () => {
    const filter = `saturate(180%) blur(${narrowViewport.matches ? 18 : 22}px)`;
    panels.forEach((panel) => panel.style.setProperty("backdrop-filter", filter));
  };
  applyBackdrop();
  narrowViewport.addEventListener("change", applyBackdrop);
})();
