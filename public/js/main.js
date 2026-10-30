/**
 * 페이지 진입점 — 각 기능 모듈을 켭니다.
 * 기능별 코드는 js/modules/ 에 있습니다.
 */
import { initReveal } from "./modules/reveal.js";
import { initMarquees } from "./modules/marquee.js";
import { initCarousels } from "./modules/carousel.js";
import { initApplyForm } from "./modules/form.js";
import { initFloatingCta } from "./modules/floating-cta.js";
import { initCountUp } from "./modules/count-up.js";
import { captureAttribution } from "./modules/attribution.js";

function start() {
  captureAttribution();
  initCountUp();
  initMarquees();
  initCarousels();
  initApplyForm();
  initFloatingCta();
  initReveal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
