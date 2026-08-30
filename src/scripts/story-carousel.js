// Bundled by Astro so every content change receives a new asset URL.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-story-carousel]").forEach((carousel) => {
    if (carousel.dataset.storyReady === "true") return;

    const viewport = carousel.querySelector("[data-story-viewport]");
    const track = carousel.querySelector("[data-story-track]");
    const originalCards = Array.from(carousel.querySelectorAll("[data-story-card]"));
    const mobileLayout = window.matchMedia("(max-width: 620px)");
    const previous = carousel.querySelector("[data-story-previous]");
    const next = carousel.querySelector("[data-story-next]");
    const current = carousel.querySelector("[data-story-current]");
    const status = carousel.querySelector("[data-story-status]");
    const totals = Array.from(carousel.querySelectorAll("[data-story-total]"));

    if (!viewport || !track || originalCards.length === 0) return;

    let cards = [];

    const configureCardsForLayout = () => {
      originalCards.forEach((card) => track.append(card));

      const mobileOnlyCard = originalCards.find((card) => card.hasAttribute("data-story-mobile-only"));
      if (mobileLayout.matches && mobileOnlyCard) track.prepend(mobileOnlyCard);

      cards = Array.from(track.querySelectorAll("[data-story-card]")).filter(
        (card) => mobileLayout.matches || !card.hasAttribute("data-story-mobile-only"),
      );

      originalCards
        .filter((card) => !cards.includes(card))
        .forEach((card) => {
          card.setAttribute("aria-hidden", "true");
          card.querySelectorAll("a, button, [tabindex]").forEach((element) => {
            element.setAttribute("tabindex", "-1");
          });
        });

      cards.forEach((card, index) => {
        const position = card.querySelector("[data-story-card-position]");
        if (position) position.textContent = `${index + 1} von ${cards.length}:`;
      });
      totals.forEach((total) => {
        total.textContent = String(cards.length);
      });
    };

    configureCardsForLayout();

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
        ? String(firstNumber)
        : `${firstNumber}–${lastNumber}`;

      cards.forEach((card, index) => {
        setCardAccessibility(card, index >= activeIndex && index <= lastVisibleIndex);
      });

      if (current) current.textContent = visibleRange;
      if (shouldAnnounce) announce();
      if (previous) previous.disabled = activeIndex === 0;
      if (next) next.disabled = activeIndex === maximumIndex;
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
        const previousCardCount = cards.length;
        configureCardsForLayout();
        if (cards.length !== previousCardCount) activeIndex = 0;
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
