(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-vendor-carousel]").forEach((carousel) => {
    if (carousel.dataset.vendorCarouselReady === "true") return;

    const viewport = carousel.querySelector("[data-vendor-carousel-viewport]");
    const cards = Array.from(carousel.querySelectorAll("[data-vendor-carousel-card]"));
    const previous = carousel.querySelector("[data-vendor-carousel-previous]");
    const next = carousel.querySelector("[data-vendor-carousel-next]");
    const current = carousel.querySelector("[data-vendor-carousel-current]");
    const status = carousel.querySelector("[data-vendor-carousel-status]");

    if (!viewport || cards.length === 0) return;

    carousel.dataset.vendorCarouselReady = "true";
    carousel.classList.add("is-enhanced");

    let activeIndex = 0;
    let visibleCount = 1;
    let scrollFrame = 0;
    let resizeFrame = 0;
    let heightFrame = 0;
    let statusTimer = 0;
    let programmaticTimer = 0;
    let programmaticIndex = null;

    const cardStep = () => {
      if (cards.length < 2) return cards[0].getBoundingClientRect().width;
      return Math.abs(cards[1].offsetLeft - cards[0].offsetLeft);
    };

    const calculateVisibleCount = () => {
      const step = cardStep();
      if (step <= 0) return 1;
      return Math.max(1, Math.min(cards.length, Math.round(viewport.clientWidth / step)));
    };

    const setCardAccessibility = (card, isVisible) => {
      if (!isVisible && card.contains(document.activeElement)) {
        viewport.focus({ preventScroll: true });
      }

      card.setAttribute("aria-hidden", String(!isVisible));
      card.querySelectorAll("a, button, [tabindex]").forEach((element) => {
        if (isVisible) {
          element.removeAttribute("tabindex");
        } else {
          element.setAttribute("tabindex", "-1");
        }
      });
    };

    const updateStatus = (message, immediate = false) => {
      if (!status) return;
      if (statusTimer) window.clearTimeout(statusTimer);

      const commit = () => {
        if (status.textContent !== message) status.textContent = message;
      };

      if (immediate) {
        commit();
        return;
      }

      statusTimer = window.setTimeout(commit, 180);
    };

    const syncViewportHeight = () => {
      const lastVisibleIndex = Math.min(cards.length - 1, activeIndex + visibleCount - 1);
      const tallestVisibleCard = cards
        .slice(activeIndex, lastVisibleIndex + 1)
        .reduce((height, card) => Math.max(height, card.getBoundingClientRect().height), 0);

      if (tallestVisibleCard > 0) {
        viewport.style.height = `${Math.ceil(tallestVisibleCard)}px`;
      }
    };

    const update = (requestedIndex = activeIndex, { announce = false } = {}) => {
      visibleCount = calculateVisibleCount();
      const maximumIndex = Math.max(0, cards.length - visibleCount);
      activeIndex = Math.max(0, Math.min(requestedIndex, maximumIndex));

      const lastVisibleIndex = Math.min(cards.length - 1, activeIndex + visibleCount - 1);
      const firstNumber = activeIndex + 1;
      const lastNumber = lastVisibleIndex + 1;
      const visibleRange = firstNumber === lastNumber
        ? String(firstNumber)
        : `${firstNumber}–${lastNumber}`;

      cards.forEach((card, index) => {
        setCardAccessibility(card, index >= activeIndex && index <= lastVisibleIndex);
      });

      if (current) current.textContent = visibleRange;
      updateStatus(
        firstNumber === lastNumber
          ? `Dienstleister ${firstNumber} von ${cards.length}`
          : `Dienstleister ${firstNumber} bis ${lastNumber} von ${cards.length}`,
        announce,
      );
      if (previous) previous.disabled = activeIndex === 0;
      if (next) next.disabled = activeIndex === maximumIndex;
      syncViewportHeight();
    };

    const closestIndex = () => {
      const step = cardStep();
      if (step <= 0) return 0;
      return Math.round(viewport.scrollLeft / step);
    };

    const finishProgrammaticScroll = () => {
      if (programmaticTimer) window.clearTimeout(programmaticTimer);
      const targetIndex = programmaticIndex;
      programmaticIndex = null;
      update(targetIndex ?? closestIndex(), { announce: true });
    };

    const goTo = (requestedIndex) => {
      visibleCount = calculateVisibleCount();
      const targetIndex = Math.max(
        0,
        Math.min(requestedIndex, cards.length - visibleCount),
      );

      programmaticIndex = targetIndex;
      if (programmaticTimer) window.clearTimeout(programmaticTimer);
      update(targetIndex, { announce: true });
      const targetLeft = cards[targetIndex].offsetLeft;
      viewport.scrollTo({
        left: targetLeft,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      if (reduceMotion.matches) viewport.scrollLeft = targetLeft;
      programmaticTimer = window.setTimeout(
        finishProgrammaticScroll,
        reduceMotion.matches ? 80 : 700,
      );
    };

    previous?.addEventListener("click", () => goTo(activeIndex - 1));
    next?.addEventListener("click", () => goTo(activeIndex + 1));

    viewport.addEventListener("keydown", (event) => {
      if (event.target !== viewport) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    });

    viewport.addEventListener("scroll", () => {
      if (programmaticIndex !== null) return;
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => update(closestIndex()));
    }, { passive: true });

    viewport.addEventListener("scrollend", () => {
      if (programmaticIndex !== null) {
        const targetLeft = cards[programmaticIndex]?.offsetLeft ?? 0;
        if (Math.abs(viewport.scrollLeft - targetLeft) > 2) return;
        finishProgrammaticScroll();
      } else {
        update(closestIndex(), { announce: true });
      }
    }, { passive: true });

    const handleResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const targetIndex = Math.min(activeIndex, cards.length - calculateVisibleCount());
        viewport.scrollTo({
          left: cards[Math.max(0, targetIndex)].offsetLeft,
          behavior: "auto",
        });
        update(targetIndex);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    if ("ResizeObserver" in window) {
      const cardResizeObserver = new ResizeObserver(() => {
        if (heightFrame) window.cancelAnimationFrame(heightFrame);
        heightFrame = window.requestAnimationFrame(syncViewportHeight);
      });
      cards.forEach((card) => cardResizeObserver.observe(card));
    }

    update(0, { announce: true });
  });
})();
