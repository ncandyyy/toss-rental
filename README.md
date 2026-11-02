# 페이앤밴 무상 렌탈 상세페이지

피그마 `페이앤밴_렌탈 상세페이지` 디자인을 반응형 웹페이지로 옮긴 프로젝트입니다.
빌드 과정 없는 순수 HTML/CSS/JS 라서 `public` 폴더를 그대로 넷리파이에 올리면 됩니다.

## 폴더 구조

```
.
├── netlify.toml                 # 넷리파이 설정 (public 폴더 배포)
├── apps-script/
│   └── Code.gs                  # 구글 시트 저장 + 슬랙 알림 (Google Apps Script)
├── docs/
│   └── form-setup.md            # 시트·슬랙 연결 방법
└── public/                      # ← 실제로 배포되는 폴더
    ├── index.html               # 페이지 전체 마크업 (섹션별 주석으로 구분)
    ├── css/
    │   ├── base/                # 디자인 토큰(색·단위), 리셋, 공통 스타일·등장 애니메이션
    │   ├── components/          # 말풍선/알약, 자동 캐러셀, 기능 캐러셀, 신청 폼, 하단 버튼
    │   └── sections/            # 섹션별 스타일 (topbar, hero, worry, reasons, lineup, apply, footer)
    ├── js/
    │   ├── config.js            # ★ 운영 설정: 신청 접수 주소, 업종 목록, 상담 시간
    │   ├── main.js              # 진입점
    │   └── modules/             # 기능별 코드 (폼, 캐러셀, 마키, 등장효과, 유입경로 저장 등)
    └── assets/
        ├── images/              # 피그마에서 추출한 이미지 (WebP)
        ├── icons/               # 이모지·로고·아이콘 (SVG)
        └── videos/              # 영상 넣는 곳 (README 참고)
```

## 섹션 ↔ 피그마 프레임

| 섹션 (index.html) | 피그마 | 인터랙션 |
| --- | --- | --- |
| `.topbar` | 상단 플로팅 바 | 상단 고정, **누적 조회수**(Apps Script 집계) 카운트업, 숫자 그라디언트 흐름, 불꽃 흔들림 |
| `.hero` | 00히어로 | 말풍선 팝업, 형광펜 그어짐, 혜택 알약·기기 순차 등장 후 둥실둥실, 알약에 마우스를 올리면 기울어지며 떠오름 |
| `.worry` | 01 | 비 막대 오르내림, 고민 버블·이모지 순차 등장, 0원 숫자 슬롯 굴림 |
| `.reasons` | 2 | 타이틀 데스크톱 1줄·모바일 2줄, 혜택 카드 6개 한 줄 자동 캐러셀 (마우스 올리면 멈춤) |
| `.lineup` | 3 (+ 캔버스 오른쪽 슬라이드 3장) | 기능 캐러셀(양옆 꽉 채운 띠) 자동 넘김 + 좌우 스와이프·드래그 + 데스크톱 좌우 화살표(마우스 올리면 표시) + 인디케이터, 2번 슬라이드 영상, 프론트 화면 속 첫 화면 이미지 자동 슬라이드, 사용 장면 자동 캐러셀, 터미널 배지 둥실 |
| `.apply` | 4 + 폼 1·2·3 | 태그 그어짐, 비교 카드 등장·체크 그려짐, 3단계 신청 폼 |

## 반응형 방식

- 피그마 원본 폭 **860px** 기준입니다. CSS 변수 `--u` 가 "디자인 1px" 이고, 화면이 860px보다 좁으면 비율대로 줄어듭니다.
- 글자는 너무 작아지지 않게 `max(최소px, 디자인값 × --u)` 로 최소 크기를 둡니다.
- 600px 미만(휴대폰)에서는 겹치는 요소(히어로 알약, 프론트/터미널 설명)를 따로 정리합니다.
- 860px 보다 넓은 화면에서는 가운데 860px 칼럼 + 섹션 배경은 화면 끝까지 채웁니다.
- 이미지 위치를 바꾸고 싶으면 HTML 의 `style="--x: ..; --y: ..; --w: .."` 숫자(피그마 좌표)를 고치면 됩니다.

## 로컬에서 보기

```bash
npx serve public
```

(또는 `python3 -m http.server 8080 --directory public` 후 http://localhost:8080)

## 넷리파이 배포

- **Git 연결**: 넷리파이에서 이 저장소를 연결하면 `netlify.toml` 대로 `public` 폴더가 배포됩니다. 빌드 명령 없음.
- **드래그 앤 드롭**: https://app.netlify.com/drop 에 `public` 폴더를 끌어다 놓아도 됩니다.

## 오픈 전 체크리스트

- [ ] `public/js/config.js` 의 `FORM_ENDPOINT` 에 Apps Script 웹 앱 주소 넣기 → [docs/form-setup.md](docs/form-setup.md)
      (신청 접수 + 상단 바 누적 조회수가 같은 주소를 씁니다. 비워두면 테스트 모드: 신청은 전송 안 되고 조회수는 24로 표시)
- [ ] 개인정보 수집·이용 동의 문구 확인 (`index.html` 의 `consent-detail`)
- [ ] 이용약관 / 개인정보처리방침 / 이메일무단수집거부 링크 주소 넣기 (`index.html` 푸터 TODO, 지금은 "준비 중" 안내)
- [x] 공유 미리보기 이미지 적용 (`assets/images/og/og-image.png`, 1200×630). 도메인을 바꾸면 `index.html` 의 canonical · og:url · og:image 주소도 함께 변경
- [ ] 광고 링크에 UTM 붙이기 (예: `?utm_source=daangn&utm_campaign=1030`) → 시트/슬랙에 유입 경로가 같이 기록됨
- [ ] (선택) GA4 / GTM / 메타 픽셀 설치 시 `form_start`, `form_step`, `lead_submit`, `cta_click` 이벤트가 자동 전송됨
