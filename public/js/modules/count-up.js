/**
 * 숫자가 0부터 목표값까지 올라가는 효과 (한 번만)
 * <span data-count-up="24">24</span>
 */
export function initCountUp(root = document) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("[data-count-up]").forEach((el) => {
    const target = Number(el.dataset.countUp);
    if (!Number.isFinite(target) || reduced) return;
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  });
}
