/**
 * 페이앤밴 렌탈 상담 신청 접수 (Google Apps Script 웹 앱)
 *
 * 하는 일
 *  1) 웹사이트 폼에서 보낸 신청서를 구글 시트에 한 줄씩 저장
 *  2) 슬랙 채널로 새 신청 알림 전송
 *
 * 설정 방법은 docs/form-setup.md 를 보세요. 요약:
 *  - 신청을 받을 구글 시트 > 확장 프로그램 > Apps Script 에 이 파일 내용을 붙여넣기
 *  - 프로젝트 설정 > 스크립트 속성에 SLACK_WEBHOOK_URL 추가
 *  - setup() 한 번 실행 → 배포 > 새 배포 > 웹 앱 (액세스: 모든 사용자)
 *  - 나온 웹 앱 URL 을 public/js/config.js 의 FORM_ENDPOINT 에 넣기
 */

const SHEET_NAME = '신청목록';

// 시트 열 순서 (바꾸고 싶으면 이 배열과 buildRow_ 를 함께 수정)
const HEADERS = [
  '접수일시',
  '처리상태',
  '매장 상태',
  '업종',
  '휴대폰',
  '연락 희망일',
  '연락 희망 시간',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  '유입 경로(referrer)',
  '랜딩 URL',
  '기기 정보',
];

/* =========================================================
   웹 앱 진입점
   ========================================================= */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // 스팸 봇(숨김 칸 채움)은 저장하지 않고 성공처럼 응답
    if (data.website) return json_({ ok: true });

    const phoneDigits = String(data.phone || '').replace(/\D/g, '');
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return json_({ ok: false, error: 'invalid_phone' });
    if (!data.consent) return json_({ ok: false, error: 'consent_required' });

    // 같은 번호로 10분 안에 다시 보내면 중복으로 보고 저장하지 않음
    const cache = CacheService.getScriptCache();
    const dupKey = 'lead_' + phoneDigits;
    if (cache.get(dupKey)) return json_({ ok: true, duplicate: true });

    const sheet = getSheet_();
    sheet.appendRow(buildRow_(data));
    const rowNumber = sheet.getLastRow();
    cache.put(dupKey, '1', 600);

    try {
      notifySlack_(data, sheet, rowNumber);
    } catch (slackErr) {
      // 슬랙 실패해도 신청 자체는 저장됐으므로 성공 처리
      console.error('Slack notify failed', slackErr);
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

// 브라우저로 웹 앱 주소를 열었을 때 동작 확인용
function doGet() {
  return json_({ ok: true, service: 'paydv-rental-leads' });
}

/* =========================================================
   시트
   ========================================================= */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e8f3ff');
  }
  return sheet;
}

function buildRow_(d) {
  const contactDay = d.contactDate ? `${d.contactDay} (${d.contactDate})` : d.contactDay;
  return [
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    '신규',
    d.storeStatus,
    d.industry,
    formatPhone_(d.phone),
    contactDay,
    d.contactTime,
    d.utm_source,
    d.utm_medium,
    d.utm_campaign,
    d.utm_content,
    d.utm_term,
    d.referrer,
    d.landing,
    d.userAgent,
  ].map(safeCell_);
}

// 셀이 수식으로 해석되지 않도록 (=, +, -, @ 로 시작하는 값 방어)
function safeCell_(v) {
  const s = v === undefined || v === null ? '' : String(v).slice(0, 500);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function formatPhone_(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

/* =========================================================
   슬랙
   ========================================================= */
function notifySlack_(d, sheet, rowNumber) {
  const url = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!url) return;

  const sheetUrl = `${sheet.getParent().getUrl()}#gid=${sheet.getSheetId()}&range=A${rowNumber}`;
  const when = `${d.contactDay || ''}${d.contactDate ? ` (${d.contactDate})` : ''} ${d.contactTime || ''}`.trim();
  const source = [d.utm_source, d.utm_campaign].filter(Boolean).join(' / ') || '직접 유입';

  const payload = {
    text: `새 렌탈 상담 신청: ${formatPhone_(d.phone)} · ${d.industry || ''}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🔔 새 렌탈 상담 신청' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*휴대폰*\n${formatPhone_(d.phone)}` },
          { type: 'mrkdwn', text: `*연락 희망*\n${when}` },
          { type: 'mrkdwn', text: `*매장 상태*\n${d.storeStatus || '-'}` },
          { type: 'mrkdwn', text: `*업종*\n${d.industry || '-'}` },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `유입: ${source}` },
          { type: 'mrkdwn', text: `<${sheetUrl}|시트에서 보기 (${rowNumber}행)>` },
        ],
      },
    ],
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

/* =========================================================
   유틸 / 설정용 함수 (Apps Script 편집기에서 직접 실행)
   ========================================================= */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 처음 한 번 실행: 시트와 머리글을 만들고 필요한 권한을 승인받습니다. */
function setup() {
  getSheet_();
  UrlFetchApp.fetch('https://slack.com', { muteHttpExceptions: true }); // 외부 요청 권한 승인용
}

/** 테스트: 가짜 신청 한 건을 저장하고 슬랙 알림을 보냅니다. */
function testSubmit() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        storeStatus: '매장 운영 중',
        industry: '카페 · 디저트',
        phone: '010-0000-0000',
        contactDay: '내일',
        contactDate: Utilities.formatDate(new Date(Date.now() + 86400000), 'Asia/Seoul', 'yyyy-MM-dd'),
        contactTime: '오후 14시',
        consent: true,
        utm_source: 'test',
        utm_campaign: 'apps-script-test',
        landing: 'https://example.com',
      }),
    },
  });
  console.log(res.getContent());
}
