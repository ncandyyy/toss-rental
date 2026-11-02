/**
 * 상단 바 누적 조회수
 * - Apps Script 웹 앱(CONFIG.FORM_ENDPOINT)에 ?action=view 로 요청하면 1 올리고 총합을 돌려줍니다.
 * - 같은 브라우저 탭(세션)에서 새로고침하면 다시 세지 않고 ?action=count 로 숫자만 읽습니다.
 * - 숫자를 받아오는 동안에는 0부터 숫자가 올라가는 모션만 보여주고,
 *   받으면 그 숫자까지 이어서 올라가 멈춥니다. (미리 정해둔 가짜 숫자는 없습니다)
 * - 받아오지 못하면 이 기기에서 마지막으로 받은 숫자를 보여주고,
 *   그것도 없으면(테스트 모드 포함) 숫자 없이 "많은 사장님이 관심있게 보고 있어요" 로 바꿉니다.
 */
import { CONFIG } from "../config.js";

const SEEN_KEY = "paydv:view-counted";
const CACHE_KEY = "paydv:view-total";
const TIMEOUT_MS = 8000;

export async function initViewCounter() {
  const el = document.querySelector("[data-view-count]");
  if (!el) return;

  const cached = Number(read(localStorage, CACHE_KEY)) || 0;
  const ticker = startTicker(el, cached);

  try {
    if (!CONFIG.FORM_ENDPOINT) throw new Error("FORM_ENDPOINT 가 비어 있어요 (테스트 모드)");
    const first = !read(sessionStorage, SEEN_KEY);
    const total = await fetchTotal(first ? "view" : "count");

    write(sessionStorage, SEEN_KEY, "1");
    write(localStorage, CACHE_KEY, String(total));
    ticker.finish(total);
  } catch (err) {
    console.warn("[view-counter] 조회수를 불러오지 못했어요", err);
    if (cached) {
      ticker.finish(cached);
    } else {
      ticker.stop();
      showWithoutNumber();
    }
  }
}

async function fetchTotal(action) {
  const url = new URL(CONFIG.FORM_ENDPOINT);
  url.searchParams.set("action", action);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { method: "GET", signal: ctrl.signal });
    const json = await res.json();
    const total = Number(json.views);
    if (!json.ok || !Number.isFinite(total)) throw new Error("bad response");
    return total;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 받아오는 동안 0부터 숫자가 올라가다가 점점 느려집니다.
 * 실제 숫자보다 크게 올라갔다가 내려오지 않도록, 지난번 숫자(없으면 40) 아래에서만 움직입니다.
 */
function startTicker(el, hint) {
  const ceiling = hint ? hint * 0.9 : 40;
  const start = performance.now();
  let shown = 0;
  let raf = 0;

  const render = (n) => {
    shown = n;
    el.textContent = format(n);
  };

  render(0);
  const loop = (now) => {
    const n = Math.floor(ceiling * (1 - Math.exp(-(now - start) / 1500)));
    if (n !== shown) render(n);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(raf);
    },
    // 지금 보이는 숫자에서 실제 숫자까지 이어서 올라가 멈춤
    finish(total) {
      cancelAnimationFrame(raf);
      const from = shown;
      const begin = performance.now();
      const duration = 1200;
      const tick = (now) => {
        const t = Math.min(1, (now - begin) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        render(Math.round(from + (total - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
  };
}

function showWithoutNumber() {
  const text = document.querySelector("[data-view-text]");
  if (text) text.innerHTML = '<strong class="topbar__count">많은 사장님</strong>이 관심있게 보고 있어요';
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
