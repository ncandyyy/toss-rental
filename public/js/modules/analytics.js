/**
 * 분석 이벤트 전송 (설치된 도구가 있을 때만 동작)
 * - Google Tag Manager: window.dataLayer
 * - GA4: window.gtag
 * - Meta 픽셀: window.fbq
 * 아무것도 설치되어 있지 않으면 조용히 무시합니다.
 */
export function track(event, params = {}) {
  try {
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...params });
    if (typeof window.gtag === "function") window.gtag("event", event, params);
    if (typeof window.fbq === "function" && event === "lead_submit") window.fbq("track", "Lead");
  } catch {
    /* ignore */
  }
}
