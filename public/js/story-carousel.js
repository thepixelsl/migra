(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-story-carousel]").forEach((carousel) => {
    if (carousel.dataset.storyReady === "true") return;

    const viewport = carousel.querySelector("[data-story-viewport]");
    const track = carousel.querySelector("[data-story-track]");
    const cards = Array.from(carousel.querySelectorAll("[data-story-card]"));
    const previous = carousel.querySelector("[data-story-previous]");
    const next = carousel.querySelector("[data-story-next]");
    const current = carousel.querySelector("[data-story-current]");
    const status = carousel.querySelector("[data-story-status]");
    const dots = Array.from(carousel.querySelectorAll("[data-story-dot]"));

    if (!viewport || !track || cards.length === 0) return;

    carousel.dataset.storyReady = "true";
    carousel.classList.add("is-enhanced");

    let activeIndex = 0;
    let visibleCount = 1;
    let scrollFrame = 0;
    let resizeFrame = 0;
    let statusTimer = 0;
    let settleTimer = 0;
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
      if (
        !isVisible
        && document.activeElement instanceof Element
        && card.contains(document.activeElement)
      ) {
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

    const announce = () => {
      if (!status) return;

      const firstNumber = activeIndex + 1;
      const lastNumber = Math.min(cards.length, activeIndex + visibleCount);
      status.textContent = firstNumber === lastNumber
        ? `Galerie ${firstNumber} von ${cards.length}`
        : `Galerien ${firstNumber} bis ${lastNumber} von ${cards.length}`;
    };

    const queueAnnouncement = () => {
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(announce, 180);
    };

    const update = (requestedIndex = activeIndex, shouldAnnounce = false) => {
      visibleCount = calculateVisibleCount();
      const maximumIndex = Math.max(0, cards.length - visibleCount);
      activeIndex = Math.max(0, Math.min(requestedIndex, maximumIndex));
      const lastVisibleIndex = Math.min(cards.length - 1, activeIndex + visibleCount - 1);
      const firstNumber = activeIndex + 1;
      const lastNumber = lastVisibleIndex + 1;
      const visibleRange = firstNumber === lastNumber
        ? String(firstNumber).padStart(2, "0")
        : `${String(firstNumber).padStart(2, "0")}–${String(lastNumber).padStart(2, "0")}`;

      cards.forEach((card, index) => {
        setCardAccessibility(card, index >= activeIndex && index <= lastVisibleIndex);
      });

      if (current) current.textContent = visibleRange;
      if (shouldAnnounce) announce();
      if (previous) previous.disabled = activeIndex === 0;
      if (next) next.disabled = activeIndex === maximumIndex;
      dots.forEach((dot, index) => {
        dot.hidden = index > maximumIndex;
        const dotLastNumber = Math.min(cards.length, index + visibleCount);
        const dotTitle = cards[index]?.querySelector("h3")?.textContent?.trim();
        dot.setAttribute(
          "aria-label",
          visibleCount === 1
            ? `Galerie ${index + 1} von ${cards.length} anzeigen${dotTitle ? `: ${dotTitle}` : ""}`
            : `Galerien ${index + 1} bis ${dotLastNumber} von ${cards.length} anzeigen`,
        );
        if (index === activeIndex) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });
    };

    const closestIndex = () => {
      const step = cardStep();
      if (step <= 0) return 0;
      return Math.round(viewport.scrollLeft / step);
    };

    const goTo = (requestedIndex) => {
      visibleCount = calculateVisibleCount();
      const targetIndex = Math.max(
        0,
        Math.min(requestedIndex, cards.length - visibleCount),
      );

      programmaticIndex = targetIndex;
      window.clearTimeout(settleTimer);
      update(targetIndex, true);
      viewport.scrollTo({
        left: cards[targetIndex].offsetLeft,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      settleTimer = window.setTimeout(() => {
        programmaticIndex = null;
        update(closestIndex(), true);
      }, reduceMotion.matches ? 0 : 720);
    };

    previous?.addEventListener("click", () => {
      goTo(activeIndex - 1);
    });

    next?.addEventListener("click", () => {
      goTo(activeIndex + 1);
    });

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => goTo(index));
    });

    viewport.addEventListener("keydown", (event) => {
      if (event.target !== viewport) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    });

    viewport.addEventListener("scroll", () => {
      if (programmaticIndex !== null) return;
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        update(closestIndex());
        queueAnnouncement();
      });
    }, { passive: true });

    viewport.addEventListener("scrollend", () => {
      window.clearTimeout(settleTimer);
      programmaticIndex = null;
      update(closestIndex(), true);
    });

    const handleResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        window.clearTimeout(settleTimer);
        programmaticIndex = null;
        const targetIndex = Math.min(activeIndex, cards.length - calculateVisibleCount());
        viewport.scrollTo({
          left: cards[Math.max(0, targetIndex)].offsetLeft,
          behavior: "auto",
        });
        update(targetIndex, true);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });
    update(0, true);
  });
})();
