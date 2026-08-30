// Bundled by Astro so every content change receives a new asset URL.
(() => {
  "use strict";

  const setVisibility = (element, isVisible) => {
    if (!element) return;

    element.hidden = !isVisible;
    element.setAttribute("aria-hidden", String(!isVisible));
  };

  const initTrauortFinder = (root) => {
    if (root.dataset.trauortInitialized === "true") return;

    const select = root.querySelector("[data-trauort-select]");
    const result = root.querySelector("[data-trauort-result]");
    const resultState = root.querySelector("[data-trauort-result-state]");
    const placeholder = root.querySelector("[data-trauort-placeholder]");
    const cards = Array.from(
      root.querySelectorAll("[data-trauort-result-card][data-trauort-id]"),
    );
    const reset = root.querySelector("[data-trauort-reset]");
    const liveStatus = root.querySelector("[data-trauort-status]");

    if (!select || !result || cards.length === 0) return;

    const emptyStateText =
      resultState?.textContent.trim() || "Noch keine Auswahl";

    root.dataset.trauortInitialized = "true";
    root.dataset.enhanced = "true";

    if (liveStatus) {
      liveStatus.setAttribute("aria-live", "polite");
      liveStatus.setAttribute("aria-atomic", "true");
    }

    const showEmptyState = ({ announce = false } = {}) => {
      cards.forEach((card) => {
        card.dataset.active = "false";
        setVisibility(card, false);
      });

      setVisibility(placeholder, true);
      setVisibility(reset, false);
      result.dataset.state = "empty";

      if (resultState) resultState.textContent = emptyStateText;
      if (announce && liveStatus) {
        liveStatus.textContent = "Auswahl zurückgesetzt.";
      }
    };

    const showSelectedState = (selectedId, { announce = true } = {}) => {
      const activeCard = cards.find(
        (card) => card.dataset.trauortId === selectedId,
      );

      if (!selectedId || !activeCard) {
        showEmptyState({ announce: false });
        return;
      }

      cards.forEach((card) => {
        const isActive = card === activeCard;
        card.dataset.active = String(isActive);
        setVisibility(card, isActive);
      });

      setVisibility(placeholder, false);
      setVisibility(reset, true);
      result.dataset.state = "selected";

      if (resultState) resultState.textContent = "Gefunden";

      if (announce && liveStatus) {
        const selectedLabel = select.selectedOptions[0]?.textContent.trim();
        liveStatus.textContent = selectedLabel
          ? `Ergebnis für ${selectedLabel} angezeigt.`
          : "Passender Trauort angezeigt.";
      }
    };

    const updateResult = ({ announce = true } = {}) => {
      showSelectedState(select.value.trim(), { announce });
    };

    select.addEventListener("change", () => updateResult());

    reset?.addEventListener("click", (event) => {
      event.preventDefault();
      select.value = "";
      showEmptyState({ announce: true });
    });

    updateResult({ announce: false });
  };

  const initAllTrauortFinders = () => {
    document
      .querySelectorAll("[data-trauort-finder]")
      .forEach(initTrauortFinder);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllTrauortFinders, {
      once: true,
    });
  } else {
    initAllTrauortFinders();
  }
})();
