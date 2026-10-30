/**
 * 기능 소개 캐러셀 (어두운 슬라이드)
 *
 * 두 가지 모드로 동작합니다.
 * 1) 스크롤 모드 (기본): [data-carousel-pin] 래퍼 안에서 캐러셀이 양옆을 꽉 채운 띠가 되어 화면 가운데에 고정되고,
 *    스크롤을 내리는 만큼 슬라이드가 1→4로 넘어갑니다. 4장을 다 보면 다음 섹션으로 내려갑니다.
 *    화면이 낮으면 안쪽 내용을 줄여서 화면에 맞춥니다.
 * 2) 자동 넘김 모드: 화면 높이가 아주 낮으면(가로로 눕힌 휴대폰 등) 고정 대신 일정 간격으로 자동 넘김.
 *
 * 공통: 오른쪽 인디케이터 클릭, 좌우 스와이프, 키보드 ←/→,
 *       슬라이드 안 <video data-src> 는 해당 슬라이드가 보일 때만 재생.
 */
import { CONFIG } from "../config.js";

export function initCarousels(root = document) {
  root.querySelectorAll("[data-carousel]").forEach((el) => new FeatureCarousel(el));
}

class FeatureCarousel {
  constructor(root) {
    this.root = root;
    this.pin = root.closest("[data-carousel-pin]");
    this.viewport = root.querySelector(".fc__viewport");
    this.track = root.querySelector(".fc__track");
    this.slides = [...root.querySelectorAll(".fc__slide")];
    this.dots = [...root.querySelectorAll(".fc__dot")];
    this.interval = Number(root.dataset.interval) || CONFIG.CAROUSEL_INTERVAL;
    this.index = -1;
    this.mode = "auto";
    this.step = 0;
    this.timer = null;
    this.remaining = 0;
    this.startedAt = 0;
    this.inView = false;
    this.hovered = false;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!this.track || this.slides.length < 2) return;

    this.bindDots();
    this.bindSwipe();
    this.bindKeys();
    this.bindVisibility();
    this.setupPin();
    if (this.index < 0) this.go(0, { instant: true });
  }

  /* =========================================================
     스크롤 고정 모드
     ========================================================= */
  setupPin() {
    if (!this.pin) return;

    const measure = () => {
      const vh = window.innerHeight;
      const topbar = document.querySelector(".topbar")?.offsetHeight || 0;

      // 양옆을 채운 모양 그대로 원래 높이를 잽니다
      this.pin.classList.add("is-pinned");
      this.pin.style.removeProperty("--pin-vh");
      this.pin.style.removeProperty("--pin-fit");
      const h = this.root.offsetHeight;
      const fit = Math.min(1, (vh - topbar - 24) / h); // 화면이 낮으면 안쪽 내용 축소 비율

      if (fit >= 0.6) {
        const visualH = Math.round(h * fit);
        this.step = Math.max(240, Math.round(vh * 0.5)); // 슬라이드 1장당 스크롤 거리
        const top = Math.round(topbar + (vh - topbar - visualH) / 2); // 상단 바 아래 남은 화면의 세로 가운데
        this.pin.style.setProperty("--pin-h", `${visualH + this.step * this.slides.length}px`);
        this.pin.style.setProperty("--pin-top", `${top}px`);
        if (fit < 1) {
          this.pin.style.setProperty("--pin-vh", `${visualH}px`);
          this.pin.style.setProperty("--pin-fit", fit.toFixed(4));
        }
        this.setMode("scroll");
        this.onScroll();
      } else {
        this.pin.classList.remove("is-pinned");
        this.setMode("auto");
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        this.onScroll();
      });
    };

    let resizeTimer;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    window.addEventListener("resize", () => {
      // 모바일 주소창이 접히는 정도의 작은 높이 변화는 무시
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    measure();
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.root.classList.toggle("is-scroll", mode === "scroll");
    if (mode === "scroll") {
      clearTimeout(this.timer);
      this.startedAt = 0;
      this.root.classList.remove("is-playing", "is-paused");
    } else {
      this.restartTimer();
    }
  }

  /** 래퍼 안에서 얼마나 스크롤했는지로 슬라이드를 고릅니다 */
  progress() {
    const top = parseFloat(this.pin.style.getPropertyValue("--pin-top")) || 0;
    const scrolled = top - this.pin.getBoundingClientRect().top;
    const n = this.slides.length;
    return Math.min(n - 0.0001, Math.max(0, scrolled / this.step));
  }

  onScroll() {
    if (this.mode !== "scroll" || !this.step) return;
    const p = this.progress();
    const i = Math.floor(p);
    this.root.style.setProperty("--p", (p - i).toFixed(3));
    if (i !== this.index) this.go(i);
  }

  /** 사용자가 고른 슬라이드로 이동 (스크롤 모드면 해당 위치로 화면을 스크롤) */
  request(i) {
    const n = this.slides.length;
    const target = Math.max(0, Math.min(n - 1, i));
    if (this.mode === "scroll") {
      const top = parseFloat(this.pin.style.getPropertyValue("--pin-top")) || 0;
      const pinStart = window.scrollY + this.pin.getBoundingClientRect().top - top;
      window.scrollTo({ top: pinStart + target * this.step + 2, behavior: this.reduced ? "auto" : "smooth" });
      this.go(this.index); // 드래그로 밀린 위치 되돌리기
    } else {
      this.go((i + n) % n, { user: true });
    }
  }

  /* =========================================================
     슬라이드 이동
     ========================================================= */
  go(i, { instant = false } = {}) {
    const n = this.slides.length;
    const prev = this.index;
    this.index = (i + n) % n;

    if (instant) this.track.style.transition = "none";
    this.track.style.transform = `translate3d(${-100 * this.index}%, 0, 0)`;
    if (instant) {
      this.track.getBoundingClientRect();
      this.track.style.transition = "";
    }

    this.slides.forEach((slide, k) => {
      const active = k === this.index;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.inert = !active;
    });
    this.dots.forEach((dot, k) => {
      const active = k === this.index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
      dot.tabIndex = active ? 0 : -1;
    });

    this.syncVideos(prev !== this.index);
    if (this.mode === "auto") this.restartTimer();
  }

  next() {
    this.go(this.index + 1);
  }

  /* =========================================================
     자동 넘김 (화면이 낮을 때)
     ========================================================= */
  slideDuration() {
    return Number(this.slides[this.index]?.dataset.duration) || this.interval;
  }

  canPlay() {
    return this.mode === "auto" && this.inView && !this.hovered && !document.hidden && !this.reduced;
  }

  restartTimer() {
    clearTimeout(this.timer);
    this.startedAt = 0;
    this.remaining = this.slideDuration();
    this.root.style.setProperty("--slide-ms", `${this.remaining}ms`);
    this.root.classList.remove("is-playing", "is-paused");
    this.root.getBoundingClientRect(); // 진행 바 애니메이션을 처음부터
    this.updatePlayState();
  }

  updatePlayState() {
    if (this.mode !== "auto") return;
    if (this.startedAt) {
      this.remaining = Math.max(300, this.remaining - (performance.now() - this.startedAt));
      this.startedAt = 0;
    }
    clearTimeout(this.timer);

    if (this.canPlay()) {
      this.root.classList.add("is-playing");
      this.root.classList.remove("is-paused");
      this.startedAt = performance.now();
      this.timer = setTimeout(() => this.next(), this.remaining);
    } else if (this.root.classList.contains("is-playing")) {
      this.root.classList.add("is-paused");
    }
  }

  /* =========================================================
     영상
     ========================================================= */
  syncVideos(changed = false) {
    this.slides.forEach((slide, k) => {
      const video = slide.querySelector("video");
      if (!video) return;

      // 캐러셀이 화면에 들어오면 미리 받아둬서, 해당 슬라이드에 오자마자 바로 재생되게
      if (this.inView && !video.src && video.dataset.src) {
        video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
        video.addEventListener("error", () => video.remove(), { once: true });
        video.preload = "auto";
        video.src = video.dataset.src;
      }

      const shouldPlay = k === this.index && this.inView && !document.hidden;
      if (shouldPlay) {
        if (changed && video.currentTime > 0) video.currentTime = 0; // 슬라이드에 들어올 때 처음부터
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }

  /* =========================================================
     입력
     ========================================================= */
  bindDots() {
    this.dots.forEach((dot, k) => dot.addEventListener("click", () => this.request(k)));
  }

  bindKeys() {
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      this.request(this.index + (e.key === "ArrowRight" ? 1 : -1));
      requestAnimationFrame(() => this.dots[this.index]?.focus({ preventScroll: true }));
    });
  }

  bindSwipe() {
    const area = this.viewport || this.root;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    let locked = false;
    let pointerId = null;

    area.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      locked = false;
      dx = 0;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
    });

    area.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;
      if (!locked) {
        if (Math.abs(mx) < 8) return;
        if (Math.abs(my) > Math.abs(mx)) {
          dragging = false; // 세로 스크롤은 브라우저에 맡김
          return;
        }
        locked = true;
        area.setPointerCapture?.(pointerId);
        this.root.classList.add("is-dragging");
        clearTimeout(this.timer);
      }
      dx = mx;
      const last = this.slides.length - 1;
      const edge = (this.index === 0 && dx > 0) || (this.index === last && dx < 0);
      const offset = edge ? dx * 0.35 : dx;
      this.track.style.transform = `translate3d(calc(${-100 * this.index}% + ${offset}px), 0, 0)`;
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      this.root.classList.remove("is-dragging");
      if (!locked) return;
      const threshold = Math.min(80, (area.clientWidth || 300) * 0.15);
      if (dx < -threshold) this.request(this.index + 1);
      else if (dx > threshold) this.request(this.index - 1);
      else this.go(this.index);
    };
    area.addEventListener("pointerup", end);
    area.addEventListener("pointercancel", end);
    area.addEventListener("lostpointercapture", end);
    area.addEventListener("dragstart", (e) => e.preventDefault());
  }

  bindVisibility() {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          this.inView = entry.isIntersecting;
          this.updatePlayState();
          this.syncVideos();
        },
        { threshold: 0.35 },
      ).observe(this.root);
    } else {
      this.inView = true;
    }

    document.addEventListener("visibilitychange", () => {
      this.updatePlayState();
      this.syncVideos();
    });

    if (window.matchMedia("(hover: hover)").matches) {
      this.root.addEventListener("mouseenter", () => {
        this.hovered = true;
        this.updatePlayState();
      });
      this.root.addEventListener("mouseleave", () => {
        this.hovered = false;
        this.updatePlayState();
      });
    }
  }
}
