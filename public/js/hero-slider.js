(() => {
  const mobileQuery = window.matchMedia(
    "(orientation: landscape) and (max-width: 900px), (orientation: portrait) and (max-width: 700px)"
  );
  const featuredHoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const instances = new Map();

  class HeroSlider {
    constructor(root) {
      this.root = root;
      this.mode = root.dataset.mode;
      this.viewport = root.querySelector(".hero-slider__viewport");
      this.slides = [...root.querySelectorAll(".hero-slider__slide")];
      this.index = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains("is-initial")));
      this.interval = 1500;
      this.timer = 0;
      this.hoverPaused = false;
      this.userPaused = false;
      this.pointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.deltaX = 0;
      this.dragOffset = 0;
      this.slideWidth = 0;
      this.preloadTimer = 0;
      this.neighborTimer = 0;
      this.preloadQueue = [];
      this.neighborQueue = [];
      this.previousButton = root.querySelector("[data-slider-prev]");
      this.nextButton = root.querySelector("[data-slider-next]");
      this.toggleButton = root.querySelector("[data-slider-toggle]");
      this.onResize = this.onResize.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onPreviousClick = this.onPreviousClick.bind(this);
      this.onNextClick = this.onNextClick.bind(this);
      this.onToggleClick = this.onToggleClick.bind(this);
      this.resizeObserver = "ResizeObserver" in window ? new ResizeObserver(this.onResize) : null;
    }

    start() {
      this.root.hidden = false;
      this.root.setAttribute("role", "region");
      this.root.setAttribute("aria-roledescription", "carousel");
      this.root.setAttribute("aria-live", "off");

      this.slides.forEach((slide, index) => {
        slide.style.setProperty("--focus-x", `${slide.dataset.focusX || 50}%`);
        slide.style.setProperty("--focus-y", `${slide.dataset.focusY || 50}%`);
        slide.setAttribute("aria-label", `${index + 1} von ${this.slides.length}`);
      });

      if (this.mode === "desktop") {
        this.root.addEventListener("mouseenter", this.onMouseEnter);
        this.root.addEventListener("mouseleave", this.onMouseLeave);
        this.root.addEventListener("pointerenter", this.onMouseEnter);
        this.root.addEventListener("pointerleave", this.onMouseLeave);
      } else {
        this.root.addEventListener("pointerdown", this.onPointerDown, { passive: true });
        this.root.addEventListener("pointermove", this.onPointerMove, { passive: true });
        this.root.addEventListener("pointerup", this.onPointerUp);
        this.root.addEventListener("pointercancel", this.onPointerUp);
      }

      document.addEventListener("visibilitychange", this.onVisibilityChange);
      this.previousButton?.addEventListener("click", this.onPreviousClick);
      this.nextButton?.addEventListener("click", this.onNextClick);
      this.toggleButton?.addEventListener("click", this.onToggleClick);

      if (this.resizeObserver) {
        this.resizeObserver.observe(this.viewport);
      } else {
        window.addEventListener("resize", this.onResize, { passive: true });
      }

      this.measure();
      this.render(true);
      this.queueNeighborImages();
      this.queueDeferredImages();
      this.root.classList.add("is-ready");
      this.updateToggleButton();

      if (!reducedMotionQuery.matches) {
        this.play();
      } else {
        this.userPaused = true;
        this.updateToggleButton();
      }
    }

    stop() {
      this.pause();
      this.clearPreloadTimer();
      this.clearNeighborTimer();
      this.root.classList.remove("is-ready", "is-dragging");
      this.root.hidden = true;

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", this.onResize);
      }

      this.root.removeEventListener("mouseenter", this.onMouseEnter);
      this.root.removeEventListener("mouseleave", this.onMouseLeave);
      this.root.removeEventListener("pointerenter", this.onMouseEnter);
      this.root.removeEventListener("pointerleave", this.onMouseLeave);
      this.root.removeEventListener("pointerdown", this.onPointerDown);
      this.root.removeEventListener("pointermove", this.onPointerMove);
      this.root.removeEventListener("pointerup", this.onPointerUp);
      this.root.removeEventListener("pointercancel", this.onPointerUp);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.previousButton?.removeEventListener("click", this.onPreviousClick);
      this.nextButton?.removeEventListener("click", this.onNextClick);
      this.toggleButton?.removeEventListener("click", this.onToggleClick);
    }

    measure() {
      this.slideWidth = this.slides[0]?.getBoundingClientRect().width || 1;
    }

    offsetFor(slideIndex) {
      const count = this.slides.length;
      const half = Math.floor(count / 2);
      let offset = slideIndex - this.index;

      if (offset > half) offset -= count;
      if (offset < -half) offset += count;

      return offset;
    }

    render(loadActive = false) {
      this.slides.forEach((slide, slideIndex) => {
        const offset = this.offsetFor(slideIndex);
        const offsetX = offset * this.slideWidth + this.dragOffset;
        const isActive = offset === 0;

        slide.style.setProperty("--offset-x", `${offsetX}px`);
        slide.style.zIndex = String(100 - Math.abs(offset));
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");

        if (loadActive && isActive) {
          this.loadImage(slide, isActive);
        }
      });
    }

    onResize() {
      this.measure();
      this.render();
    }

    next() {
      this.index = (this.index + 1) % this.slides.length;
      this.dragOffset = 0;
      this.render(true);
      this.queueNeighborImages();
    }

    previous() {
      this.index = (this.index - 1 + this.slides.length) % this.slides.length;
      this.dragOffset = 0;
      this.render(true);
      this.queueNeighborImages();
    }

    play() {
      if (this.timer || this.isPaused() || document.hidden) return;
      this.timer = window.setInterval(() => this.next(), this.interval);
    }

    pause() {
      window.clearInterval(this.timer);
      this.timer = 0;
    }

    isPaused() {
      return this.hoverPaused || this.userPaused;
    }

    onMouseEnter() {
      this.hoverPaused = true;
      this.pause();
    }

    onMouseLeave() {
      this.hoverPaused = false;
      this.play();
    }

    onVisibilityChange() {
      if (document.hidden) {
        this.pause();
      } else if (!this.isPaused() && !reducedMotionQuery.matches) {
        this.play();
      }
    }

    onPreviousClick() {
      this.pause();
      this.previous();
      if (!this.userPaused && !reducedMotionQuery.matches) this.play();
    }

    onNextClick() {
      this.pause();
      this.next();
      if (!this.userPaused && !reducedMotionQuery.matches) this.play();
    }

    onToggleClick() {
      this.userPaused = !this.userPaused;
      this.updateToggleButton();

      if (this.userPaused) {
        this.pause();
      } else if (!reducedMotionQuery.matches) {
        this.play();
      }
    }

    updateToggleButton() {
      if (!this.toggleButton) return;
      this.toggleButton.setAttribute("aria-pressed", this.userPaused ? "true" : "false");
      this.toggleButton.setAttribute("aria-label", this.userPaused ? "Slider abspielen" : "Slider pausieren");
      this.toggleButton.textContent = this.userPaused ? "Play" : "Pause";
    }

    onPointerDown(event) {
      if (event.pointerType === "mouse") return;
      this.pointerId = event.pointerId;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.deltaX = 0;
      this.dragOffset = 0;
      this.pause();
      this.root.classList.add("is-dragging");
    }

    onPointerMove(event) {
      if (event.pointerId !== this.pointerId) return;
      const deltaY = Math.abs(event.clientY - this.startY);
      this.deltaX = event.clientX - this.startX;

      if (Math.abs(this.deltaX) > deltaY) {
        this.dragOffset = this.deltaX;
        this.render(false);
      }
    }

    onPointerUp(event) {
      if (event.pointerId !== this.pointerId) return;
      this.root.classList.remove("is-dragging");

      if (Math.abs(this.deltaX) > 35) {
        this.deltaX < 0 ? this.next() : this.previous();
      } else {
        this.dragOffset = 0;
        this.render(false);
      }

      this.pointerId = null;
      this.play();
    }

    loadImage(slide, isPriority = false) {
      const image = slide.querySelector("img");
      if (!image) return;

      image.loading = isPriority ? "eager" : "lazy";
      image.decoding = "async";
      if (isPriority) image.setAttribute("fetchpriority", "high");

      if (image.dataset.src) {
        image.src = image.dataset.src;
        image.removeAttribute("data-src");
      }
    }

    queueDeferredImages() {
      this.preloadQueue = this.slides.filter((slide) => slide.querySelector("img[data-src]"));
      this.scheduleNextDeferredImage();
    }

    queueNeighborImages() {
      const radius = this.mode === "desktop" ? 3 : 1;
      const neighbors = this.slides
        .map((slide, slideIndex) => ({ slide, distance: Math.abs(this.offsetFor(slideIndex)) }))
        .filter((item) => item.distance > 0 && item.distance <= radius && item.slide.querySelector("img[data-src]"))
        .sort((a, b) => a.distance - b.distance)
        .map((item) => item.slide);

      this.neighborQueue = neighbors;
      this.scheduleNextNeighborImage();
    }

    scheduleNextNeighborImage() {
      this.clearNeighborTimer();
      if (!this.neighborQueue.length) return;

      this.neighborTimer = window.setTimeout(() => {
        const slide = this.neighborQueue.shift();
        if (slide) this.loadImage(slide, false);
        this.scheduleNextNeighborImage();
      }, 120);
    }

    scheduleNextDeferredImage() {
      this.clearPreloadTimer();
      if (!this.preloadQueue.length) return;

      const loadNext = () => {
        const slide = this.preloadQueue.shift();
        if (slide) this.loadImage(slide, false);
        this.scheduleNextDeferredImage();
      };

      this.preloadTimer = window.setTimeout(loadNext, 450);
    }

    clearPreloadTimer() {
      if (!this.preloadTimer) return;
      window.clearTimeout(this.preloadTimer);
      this.preloadTimer = 0;
    }

    clearNeighborTimer() {
      if (!this.neighborTimer) return;
      window.clearTimeout(this.neighborTimer);
      this.neighborTimer = 0;
    }
  }

  const desiredMode = () => (mobileQuery.matches ? "mobile" : "desktop");

  const sync = () => {
    const mode = desiredMode();

    document.querySelectorAll("[data-hero-slider]").forEach((root) => {
      const shouldRun = root.dataset.mode === mode;
      let instance = instances.get(root);

      if (shouldRun && !instance) {
        instance = new HeroSlider(root);
        instances.set(root, instance);
        instance.start();
      } else if (!shouldRun && instance) {
        instance.stop();
        instances.delete(root);
      } else if (!shouldRun) {
        root.hidden = true;
      }
    });
  };

  const listenToMediaQuery = (query, callback) => {
    if (query.addEventListener) {
      query.addEventListener("change", callback);
    } else if (query.addListener) {
      query.addListener(callback);
    }
  };

  const initFeaturedLinks = () => {
    document.querySelectorAll("[data-featured-links]").forEach((block) => {
      const image = block.querySelector(".flo-featured-links-1__image-wrap");
      const links = [...block.querySelectorAll("[data-featured-link]")];
      const media = [...block.querySelectorAll("[data-featured-media]")];
      if (!image || !links.length) return;

      const previewIndex = new URLSearchParams(window.location.search).get("featured");
      const shouldUseDesktopPreview = featuredHoverQuery.matches || Boolean(previewIndex);
      if (!shouldUseDesktopPreview) return;

      const loadFeaturedMedia = (index) => {
        const figure = media.find((item) => item.dataset.featuredMedia === index);
        const featuredImage = figure?.querySelector("img[data-src]");
        if (!featuredImage) return;

        if (featuredImage.dataset.srcset) {
          featuredImage.srcset = featuredImage.dataset.srcset;
          featuredImage.removeAttribute("data-srcset");
        }

        featuredImage.src = featuredImage.dataset.src;
        featuredImage.removeAttribute("data-src");
      };

      const activate = (link) => {
        const index = link.dataset.featuredIndex;
        const nextImage = link.dataset.image;
        links.forEach((item) => item.classList.toggle("hovered", item === link));

        if (media.length && index) {
          loadFeaturedMedia(index);
          media.forEach((item) => {
            item.classList.toggle("is-active", item.dataset.featuredMedia === index);
          });
          return;
        }

        if (nextImage) {
          image.style.backgroundImage = `url("${nextImage}")`;
        }
      };

      links.forEach((link) => {
        link.addEventListener("mouseenter", () => activate(link));
        link.addEventListener("focus", () => activate(link));
      });

      const previewLink = previewIndex
        ? links.find((link) => link.dataset.featuredIndex === previewIndex)
        : null;

      activate(previewLink || links.find((link) => link.classList.contains("hovered")) || links[0]);
    });
  };

  listenToMediaQuery(mobileQuery, sync);
  listenToMediaQuery(reducedMotionQuery, sync);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      sync();
      initFeaturedLinks();
    }, { once: true });
  } else {
    sync();
    initFeaturedLinks();
  }
})();
