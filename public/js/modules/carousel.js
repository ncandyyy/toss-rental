/**
 * 기능 소개 캐러셀 (어두운 슬라이드)
 *
 * 두 가지 모드로 동작합니다.
 * 1) 휠 잠금 모드 (마우스/트랙패드가 있는 데스크톱, 폭 600px 이상)
 *    캐러셀이 양옆을 꽉 채운 띠로 바뀌고, 스크롤해서 화면 가운데에 오면 페이지가 그 자리에 멈춘 채
 *    휠을 굴릴 때마다 슬라이드만 넘어갑니다. 위아래 섹션은 그대로 보입니다.
 *    4장을 다 보면(위로 굴릴 땐 1장으로 돌아오면) 다시 평소처럼 페이지가 스크롤됩니다.
 *    화면이 낮으면 안쪽 내용을 줄여서 캐러셀 전체가 화면에 들어오게 합니다.
 * 2) 자동 넘김 모드 (휴대폰·터치 태블릿, 화면 높이가 아주 낮을 때)
 *    일정 간격으로 자동으로 넘어가고, 손가락으로 좌우로 밀어서도 넘길 수 있습니다.
 *
 * 공통: 오른쪽 인디케이터 클릭, 좌우 스와이프(마우스 드래그 포함), 키보드 ←/→,
 *       슬라이드 안 <video> 는 해당 슬라이드가 보일 때만 재생.
 */
import { CONFIG } from "../config.js";

export function initCarousels(root = document) {
  root.querySelectorAll("[data-carousel]").forEach((el) => new FeatureCarousel(el));
}

/**
 * <video> 안의 <source data-src> 를 실제 주소로 바꿔 불러옵니다. (mp4 → 안 되면 webm 순서)
 * 실패해도 영상 태그는 남겨두고(첫 장면 이미지가 계속 보임) 콘솔에 원인을 남깁니다.
 */
function loadVideo(video) {
  video.dataset.loaded = "1";
  video.addEventListener("playing", () => video.classList.add("is-playing"));

  const sources = [...video.querySelectorAll("source[data-src]")];
  sources.forEach((source) => {
    source.addEventListener("error", () => console.warn("[carousel] 영상을 불러오지 못했어요:", source.dataset.src));
  });
  const markFailed = () => {
    video.dataset.failed = "1";
  };
  if (sources.length) {
    sources[sources.length - 1].addEventListener("error", markFailed); // 모든 후보가 실패
    sources.forEach((source) => {
      source.src = source.dataset.src;
    });
  } else if (video.dataset.src) {
    video.addEventListener("error", markFailed);
    video.src = video.dataset.src;
  }
  video.preload = "auto";
  video.load();
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
    this.engaged = false; // 휠 잠금 중인지
    this.wheelSum = 0;
    this.lastStepAt = 0;
    this.targetTop = 0; // 잠금 시 캐러셀 윗변이 놓일 화면 위치
    this.visualH = 0;
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
     휠 잠금 모드 (데스크톱)
     ========================================================= */
  setupPin() {
    if (!this.pin) return;

    // 마우스/트랙패드가 있는 넓은 화면에서만 (터치 기기는 자동 넘김 + 스와이프)
    const desktop = window.matchMedia("(min-width: 600px) and (hover: hover) and (pointer: fine)");

    const unpin = () => {
      this.pin.classList.remove("is-pinned");
      ["--pin-vh", "--pin-fit"].forEach((k) => this.pin.style.removeProperty(k));
      this.engaged = false;
      this.setMode("auto");
    };

    const measure = () => {
      if (!desktop.matches) {
        unpin();
        return;
      }

      const vh = window.innerHeight;
      const topbar = document.querySelector(".topbar")?.offsetHeight || 0;

      // 양옆을 채운 모양 그대로 원래 높이를 잽니다
      this.pin.classList.add("is-pinned");
      this.pin.style.removeProperty("--pin-vh");
      this.pin.style.removeProperty("--pin-fit");
      const h = this.root.offsetHeight;
      const fit = Math.min(1, (vh - topbar - 24) / h); // 화면이 낮으면 안쪽 내용 축소 비율

      if (fit < 0.6) {
        unpin();
        return;
      }
      this.visualH = Math.round(h * fit);
      this.targetTop = Math.round(topbar + (vh - topbar - this.visualH) / 2); // 상단 바 아래 남은 화면의 세로 가운데
      if (fit < 1) {
        this.pin.style.setProperty("--pin-vh", `${this.visualH}px`);
        this.pin.style.setProperty("--pin-fit", fit.toFixed(4));
      }
      this.setMode("lock");
    };

    let resizeTimer;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    });
    desktop.addEventListener?.("change", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);

    window.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    window.addEventListener("keydown", (e) => this.onPageKey(e));
    measure();
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.root.classList.toggle("is-lock", mode === "lock");
    if (mode === "lock") {
      clearTimeout(this.timer);
      this.startedAt = 0;
      this.root.classList.remove("is-playing", "is-paused");
    } else {
      this.restartTimer();
    }
  }

  /** 캐러셀이 가운데 자리에서 얼마나 떨어져 있는지 (양수: 아직 아래, 음수: 지나쳐 위) */
  offsetFromTarget() {
    return this.root.getBoundingClientRect().top - this.targetTop;
  }

  canAdvance(dir) {
    return dir > 0 ? this.index < this.slides.length - 1 : this.index > 0;
  }

  /**
   * 휠 한 번(또는 트랙패드 한 번 쓸기) → 슬라이드 한 장.
   * 넘길 장이 남아 있는 동안만 페이지 스크롤을 막습니다.
   * 트랙패드는 한 번 쓸어도 관성으로 휠 이벤트가 1~2초 이어지므로,
   * 한 장 넘긴 뒤에는 휠이 잠깐 멈추거나(새 동작) 다시 세게 굴릴 때까지 들어오는 이벤트를 삼킵니다.
   */
  onWheel(e) {
    if (this.mode !== "lock" || e.ctrlKey) return; // ctrl + 휠은 브라우저 확대/축소
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return;

    const now = performance.now();
    const gap = now - (this.lastWheelAt || 0);
    const abs = Math.abs(dy);
    const accelerating = abs > (this.lastAbs || 0) * 1.6 && abs > 20;
    this.lastWheelAt = now;
    this.lastAbs = abs;

    const dir = dy > 0 ? 1 : -1;
    const offset = this.offsetFromTarget();
    const range = this.visualH * 0.5;

    // 한 장 넘긴 직후: 같은 동작(관성)이 이어지는 동안은 삼킴
    if (this.engaged && this.settling) {
      const newGesture = gap > 160 || (accelerating && now - this.lastStepAt > 450);
      if (!newGesture) {
        e.preventDefault();
        return;
      }
      this.settling = false;
    }

    // 다른 방법(스크롤바 드래그 등)으로 멀리 벗어났으면 잠금 해제
    if (this.engaged && Math.abs(offset) > range) this.engaged = false;

    if (!this.canAdvance(dir)) {
      this.engaged = false; // 끝까지 봤으면 평소처럼 스크롤
      this.wheelSum = 0;
      return;
    }

    if (!this.engaged) {
      // 내려가는 중: 캐러셀이 가운데 자리에 도착했거나 막 지나쳤을 때 / 올라가는 중: 그 반대
      const arrived = dir > 0 ? offset <= 0 && offset > -range : offset >= 0 && offset < range;
      if (!arrived) return;
      e.preventDefault();
      this.engaged = true;
      this.settling = true; // 자리를 맞추는 이번 동작에서는 넘기지 않음
      this.wheelSum = 0;
      this.lastStepAt = now;
      if (Math.abs(offset) > 1) {
        window.scrollTo({ top: window.scrollY + offset, behavior: this.reduced ? "auto" : "smooth" });
      }
      return;
    }

    e.preventDefault();
    if (now - this.lastStepAt < 450) return; // 너무 빠른 연속 넘김 방지
    if (Math.sign(this.wheelSum) !== dir) this.wheelSum = 0;
    this.wheelSum += dy;
    if (Math.abs(this.wheelSum) >= 30) {
      this.wheelSum = 0;
      this.lastStepAt = now;
      this.settling = true;
      this.go(this.index + dir);
    }
  }

  /** 잠금 중에는 ↓ / PageDown / 스페이스 · ↑ / PageUp 도 슬라이드를 넘깁니다 */
  onPageKey(e) {
    if (this.mode !== "lock" || !this.engaged || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.("input, select, textarea, button, a, [contenteditable]")) return;
    const down = ["ArrowDown", "PageDown", " "].includes(e.key) && !e.shiftKey;
    const up = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (!down && !up) return;
    const dir = down ? 1 : -1;
    if (Math.abs(this.offsetFromTarget()) > 4 || !this.canAdvance(dir)) {
      this.engaged = false;
      return;
    }
    e.preventDefault();
    this.go(this.index + dir);
  }

  /** 사용자가 고른 슬라이드로 이동 (인디케이터, 스와이프, ←/→) */
  request(i) {
    const n = this.slides.length;
    if (this.mode === "lock") this.go(Math.max(0, Math.min(n - 1, i)));
    else this.go((i + n) % n, { user: true });
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
      if (this.inView && !video.dataset.loaded) loadVideo(video);

      const shouldPlay = k === this.index && this.inView && !document.hidden && !video.dataset.failed;
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
    // 터치는 손가락이 닿은 이미지가 먼저 이벤트를 잡고 있다가 viewport 로 넘어오며 lostpointercapture 가 생깁니다.
    // 그건 손을 뗀 게 아니므로, viewport 자신이 잡고 있던 것을 놓쳤을 때만 끝냅니다.
    area.addEventListener("lostpointercapture", (e) => {
      if (e.target === area) end();
    });
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
