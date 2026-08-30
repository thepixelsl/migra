// Bundled by Astro so every content change receives a new asset URL.
(() => {
  const targets = Array.from(document.querySelectorAll("[data-home-reveal]"));
  if (targets.length === 0) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cleanupTimers = new WeakMap();
  let observer = null;

  const clearCleanupTimer = (element) => {
    const timer = cleanupTimers.get(element);
    if (!timer) return;
    window.clearTimeout(timer);
    cleanupTimers.delete(element);
  };

  const finishReveal = (element) => {
    clearCleanupTimer(element);
    element.classList.remove("is-reveal-ready", "is-reveal-visible");
    element.style.removeProperty("--home-reveal-delay");
  };

  const reveal = (element) => {
    if (!element.classList.contains("is-reveal-ready")) return;

    observer?.unobserve(element);
    element.classList.add("is-reveal-visible");
    cleanupTimers.set(
      element,
      window.setTimeout(() => finishReveal(element), 1250),
    );
  };

  const showEverything = () => {
    observer?.disconnect();
    observer = null;
    targets.forEach(finishReveal);
  };

  if (
    motionPreference.matches
    || !("IntersectionObserver" in window)
  ) {
    showEverything();
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -9% 0px",
      threshold: 0.08,
    },
  );

  const initialRevealThreshold = window.innerHeight * 0.92;
  const belowFoldTargets = targets.filter(
    (element) => element.getBoundingClientRect().top > initialRevealThreshold,
  );

  // Read all positions first, then apply the reveal state in a separate phase.
  // This keeps the same first-viewport behavior without forcing layout per item.
  belowFoldTargets.forEach((element) => {
    const delay = Number.parseInt(element.dataset.homeRevealDelay || "0", 10);
    element.style.setProperty(
      "--home-reveal-delay",
      `${Number.isFinite(delay) ? Math.max(0, Math.min(delay, 180)) : 0}ms`,
    );
    element.classList.add("is-reveal-ready");
    observer.observe(element);
  });

  document.addEventListener("focusin", (event) => {
    const element = event.target instanceof Element
      ? event.target.closest("[data-home-reveal].is-reveal-ready")
      : null;
    if (element) reveal(element);
  });

  const handleMotionPreference = (event) => {
    if (event.matches) showEverything();
  };

  if (motionPreference.addEventListener) {
    motionPreference.addEventListener("change", handleMotionPreference);
  } else {
    motionPreference.addListener(handleMotionPreference);
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) showEverything();
  });
})();
