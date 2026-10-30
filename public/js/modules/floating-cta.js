/**
 * 하단 고정 상담 버튼
 * 히어로 영역을 지나면 나타나고, 신청 폼이 보이거나 기능 캐러셀이 화면에 고정된 동안에는 숨습니다.
 */
import { track } from "./analytics.js";

export function initFloatingCta() {
  const cta = document.querySelector("[data-floating-cta]");
  const hero = document.getElementById("hero");
  const form = document.getElementById("apply-form");
  if (!cta || !hero || !form || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let formVisible = false;
  let pinActive = false;
  const update = () => cta.classList.toggle("is-show", !heroVisible && !formVisible && !pinActive);

  // 기능 캐러셀이 화면 가운데를 차지하는 동안 (스크롤 고정 중)
  const pin = document.querySelector("[data-carousel-pin]");
  if (pin) {
    new IntersectionObserver(([entry]) => {
      pinActive = entry.isIntersecting && pin.classList.contains("is-pinned");
      update();
    }, { rootMargin: "-45% 0px -45% 0px" }).observe(pin);
  }

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    update();
  }, { rootMargin: "0px 0px -35% 0px" }).observe(hero);

  new IntersectionObserver(([entry]) => {
    formVisible = entry.isIntersecting;
    update();
  }, { threshold: 0.2 }).observe(form);

  cta.querySelector("[data-cta]")?.addEventListener("click", () => track("cta_click", { location: "floating" }));
}
