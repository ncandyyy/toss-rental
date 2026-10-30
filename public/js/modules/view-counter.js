/**
 * 상단 바 누적 조회수
 * - Apps Script 웹 앱(CONFIG.FORM_ENDPOINT)에 ?action=view 로 요청하면 1 올리고 총합을 돌려줍니다.
 * - 같은 브라우저 탭(세션)에서 새로고침하면 다시 세지 않고 ?action=count 로 숫자만 읽습니다.
 * - 마지막으로 받은 숫자를 저장해 두었다가 다음 방문 때 바로 보여줍니다.
 * - 접수 주소가 비어 있으면(테스트 모드) HTML 에 적힌 기본 숫자(data-fallback)를 보여줍니다.
 */
import { CONFIG } from "../config.js";

const SEEN_KEY = "paydv:view-counted";
const CACHE_KEY = "paydv:view-total";

export async function initViewCounter() {
  const el = document.querySelector("[data-view-count]");
  if (!el) return;

  const fallback = Number(el.dataset.fallback) || 0;
  const cached = Number(read(localStorage, CACHE_KEY)) || 0;

  if (!CONFIG.FORM_ENDPOINT) {
    countUp(el, 0, fallback);
    return;
  }

  if (cached) el.textContent = format(cached);

  try {
    const first = !read(sessionStorage, SEEN_KEY);
    const url = new URL(CONFIG.FORM_ENDPOINT);
    url.searchParams.set("action", first ? "view" : "count");
    const res = await fetch(url.toString(), { method: "GET" });
    const json = await res.json();
    const total = Number(json.views);
    if (!json.ok || !Number.isFinite(total)) throw new Error("bad response");

    write(sessionStorage, SEEN_KEY, "1");
    write(localStorage, CACHE_KEY, String(total));
    countUp(el, cached, total);
  } catch (err) {
    console.warn("[view-counter] 조회수를 불러오지 못했어요", err);
    if (!cached) countUp(el, 0, fallback);
  }
}

function countUp(el, from, to) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || from === to) {
    el.textContent = format(to);
    return;
  }
  const duration = 1200;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function format(n) {
  return Number(n).toLocaleString("ko-KR");
}

function read(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* 사생활 보호 모드 등 */
  }
}
