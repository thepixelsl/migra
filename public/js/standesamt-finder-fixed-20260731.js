(() => {
  const finder = document.querySelector("[data-standesamt-finder]");
  if (!finder) return;

  const form = finder.querySelector("[data-finder-form]");
  const districtSelect = finder.querySelector("[data-finder-district]");
  const clearButton = finder.querySelector("[data-finder-clear]");
  const status = finder.querySelector("[data-finder-status]");
  const result = finder.querySelector("[data-finder-result]");
  const resultState = finder.querySelector("[data-finder-result-state]");
  const resultPlaceholder = finder.querySelector("[data-finder-result-placeholder]");
  const resultCards = Array.from(
    finder.querySelectorAll("[data-finder-result-card]"),
  );

  if (
    !(districtSelect instanceof HTMLSelectElement)
    || !(clearButton instanceof HTMLButtonElement)
    || !(status instanceof HTMLElement)
    || !(result instanceof HTMLElement)
    || !(resultState instanceof HTMLElement)
    || !(resultPlaceholder instanceof HTMLElement)
    || resultCards.length === 0
  ) {
    return;
  }

  const selectedDistrictName = () => {
    if (!districtSelect.value) return "";
    const selectedOption = districtSelect.options[districtSelect.selectedIndex];
    return selectedOption?.dataset.district || selectedOption?.textContent?.trim() || "";
  };

  const deactivateCards = () => {
    resultCards.forEach((card) => {
      card.removeAttribute("data-active");
      card.setAttribute("aria-hidden", "true");
      card.setAttribute("inert", "");

      const district = card.querySelector("[data-finder-result-district]");
      if (district instanceof HTMLElement) district.textContent = "\u00a0";
    });
  };

  const restoreFinder = ({ focusSelect = false } = {}) => {
    districtSelect.value = "";
    deactivateCards();
    result.dataset.state = "empty";
    resultState.textContent = "Bitte wählen";
    resultPlaceholder.setAttribute("aria-hidden", "false");
    status.textContent = "";
    clearButton.hidden = true;

    if (focusSelect) districtSelect.focus({ preventScroll: true });
  };

  const showSelectedOffice = () => {
    const selectedOfficeId = districtSelect.value;
    const districtName = selectedDistrictName();
    const selectedCard = resultCards.find(
      (card) => card.getAttribute("data-office-id") === selectedOfficeId,
    );

    deactivateCards();
    clearButton.hidden = false;

    if (!(selectedCard instanceof HTMLElement)) {
      result.dataset.state = "error";
      resultState.textContent = "Bitte prüfen";
      resultPlaceholder.setAttribute("aria-hidden", "false");
      status.textContent = `Für ${districtName} konnte kein Standesamt zugeordnet werden`;
      return;
    }

    const officeName = selectedCard.getAttribute("data-office-name") || "Standesamt";
    const district = selectedCard.querySelector("[data-finder-result-district]");
    if (district instanceof HTMLElement) district.textContent = districtName;

    selectedCard.setAttribute("data-active", "");
    selectedCard.setAttribute("aria-hidden", "false");
    selectedCard.removeAttribute("inert");
    result.dataset.state = "selected";
    resultState.textContent = "Gefunden";
    resultPlaceholder.setAttribute("aria-hidden", "true");
    status.textContent = `${officeName} ist für ${districtName} zuständig`;
  };

  districtSelect.addEventListener("change", () => {
    if (!districtSelect.value) {
      restoreFinder();
      return;
    }
    showSelectedOffice();
  });

  clearButton.addEventListener("click", () => {
    restoreFinder({ focusSelect: true });
  });
  form?.addEventListener("submit", (event) => event.preventDefault());

  finder.dataset.enhanced = "true";
  restoreFinder();
})();
