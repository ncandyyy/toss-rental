/**
 * 기능 소개 캐러셀 (어두운 슬라이드)
 * - 일정 간격으로 자동 넘김 (화면 밖/탭 숨김/마우스 올림 시 일시정지)
 * - 손가락/마우스로 좌우 스와이프, 오른쪽 인디케이터 클릭, 키보드 ←/→
 * - 슬라이드 안 <video data-src> 는 해당 슬라이드가 보일 때만 재생
 * - 슬라이드별 표시 시간: <article class="fc__slide" data-duration="7000">
 */
import { CONFIG } from "../config.js";

export function initCarousels(root = document) {
  root.querySelectorAll("[data-carousel]").forEach((el) => new FeatureCarousel(el));
}

class FeatureCarousel {
  constructor(root) {
    this.root = root;
    this.viewport = root.querySelector(".fc__viewport");
    this.track = root.querySelector(".fc__track");
    this.slides = [...root.querySelectorAll(".fc__slide")];
    this.dots = [...root.querySelectorAll(".fc__dot")];
    this.interval = Number(root.dataset.interval) || CONFIG.CAROUSEL_INTERVAL;
    this.index = 0;
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
    this.go(0, { instant: true });
  }

  /* ---------- 이동 ---------- */
  go(i, { user = false, instant = false } = {}) {
    const n = this.slides.length;
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

    this.syncVideos();
    this.restartTimer();
    if (user) this.root.dataset.userInteracted = "true";
  }

  next() {
    this.go(this.index + 1);
  }

  prev() {
    this.go(this.index - 1);
  }

  /* ---------- 자동 재생 ---------- */
  slideDuration() {
    return Number(this.slides[this.index].dataset.duration) || this.interval;
  }

  canPlay() {
    return this.inView && !this.hovered && !document.hidden && !this.reduced;
  }

  restartTimer() {
    clearTimeout(this.timer);
    this.startedAt = 0;
    this.remaining = this.slideDuration();
    this.root.style.setProperty("--slide-ms", `${this.remaining}ms`);
    // 진행 바 애니메이션을 처음부터 다시 시작
    this.root.classList.remove("is-playing", "is-paused");
    this.root.getBoundingClientRect();
    this.updatePlayState();
  }

  updatePlayState() {
    // 돌고 있던 타이머가 있으면 남은 시간을 계산해 둡니다
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

  /* ---------- 영상 ---------- */
  syncVideos() {
    this.slides.forEach((slide, k) => {
      const video = slide.querySelector("video");
      if (!video) return;
      const shouldPlay = k === this.index && this.inView && !document.hidden;
      if (shouldPlay) {
        if (!video.src && video.dataset.src) {
          video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
          video.addEventListener("error", () => video.remove(), { once: true });
          video.src = video.dataset.src;
        }
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }

  /* ---------- 입력 ---------- */
  bindDots() {
    this.dots.forEach((dot, k) => {
      dot.addEventListener("click", () => this.go(k, { user: true }));
    });
  }

  bindKeys() {
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.go(this.index + 1, { user: true });
        this.dots[this.index]?.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.go(this.index - 1, { user: true });
        this.dots[this.index]?.focus();
      }
    });
  }

  bindSwipe() {
    const area = this.viewport || this.root;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    let locked = false; // 가로 스와이프로 판정됨
    let pointerId = null;

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      locked = false;
      dx = 0;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
    };

    const onMove = (e) => {
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
      const w = area.clientWidth || 1;
      const edge = (this.index === 0 && dx > 0) || (this.index === this.slides.length - 1 && dx < 0);
      const offset = edge ? dx * 0.35 : dx;
      this.track.style.transform = `translate3d(calc(${-100 * this.index}% + ${offset}px), 0, 0)`;
      if (Math.abs(dx) > w) dx = Math.sign(dx) * w;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.root.classList.remove("is-dragging");
      if (!locked) return;
      const threshold = Math.min(80, (area.clientWidth || 300) * 0.15);
      if (dx < -threshold) this.go(this.index + 1, { user: true });
      else if (dx > threshold) this.go(this.index - 1, { user: true });
      else this.go(this.index, { user: true });
    };

    area.addEventListener("pointerdown", onDown);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerup", onUp);
    area.addEventListener("pointercancel", onUp);
    area.addEventListener("lostpointercapture", onUp);
    // 드래그 중 링크/이미지 클릭 방지
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

    const hoverable = window.matchMedia("(hover: hover)").matches;
    if (hoverable) {
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
