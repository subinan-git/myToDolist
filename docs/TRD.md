# TRD — My Tasks (할 일 관리 앱)

| 항목 | 내용 |
|------|------|
| 문서 종류 | 기술 요구사항 문서 (Technical Requirements Document) |
| 작성일 | 2026-11-11 |
| 관련 문서 | [PRD.md](./PRD.md), [TASK.md](./TASK.md) |

## 1. 기술 스택과 제약

- **순수 HTML / CSS / JavaScript** — 프레임워크, 라이브러리, 번들러, 패키지 매니저 없음
- **빌드 단계 없음** — `index.html`을 브라우저에서 직접 연다 (`file://`로 동작)
- **서버 없음** — 모든 데이터는 브라우저 localStorage에 저장
- **테스트/린트 도구 없음** — 문법 확인은 `node --check script.js`로만 수행
- 대상 브라우저: 최신 Chrome/Edge/Firefox/Safari (`<dialog>`, Pointer Events, Web Animations API, `Object.hasOwn`, `Blob.text()` 사용)

## 2. 파일 구조

```
todolist/
├── index.html        # 마크업 + 테마 초기화 인라인 스크립트
├── style.css         # 스타일 (CSS 변수 기반 테마, 반응형)
├── script.js         # 앱 로직 전체
├── web_version/      # 데스크톱 전체 화면 레이아웃 버전
│   ├── index.html    # 루트와 동일 + .sidebar / .content 래퍼
│   ├── style.css     # 루트와 동일 + 파일 끝에 레이아웃 재정의 구역
│   └── script.js     # 루트 script.js의 동일 복사본
└── docs/             # PRD, TRD, TASK
```

> **주의**: `web_version/script.js`는 루트 `script.js`의 복사본이다. 기능을 고치면 두 파일에 모두 반영해야 한다.
> `web_version/style.css`도 루트 내용을 포함하므로, 공통 스타일을 고칠 때 마찬가지다.

## 3. 데이터 모델

### 3.1 할 일

```js
{
  id: string,          // `${Date.now()}-${무작위 6자}` 형식
  text: string,        // 앞뒤 공백 제거, 입력창 기준 최대 200자
  completed: boolean,
  createdAt: string,   // ISO 8601 (예: "2026-11-11T06:28:00.000Z")
  category: 'work' | 'personal' | 'study'
}
```

- `todos` 배열의 순서 = 추가 순서이자 **수동 정렬 순서**다.

### 3.2 localStorage 키

| 키 | 값 | 비고 |
|----|----|------|
| `my-tasks` | 할 일 배열(JSON) | 디바운스 저장 (300ms) |
| `my-tasks-filter` | `all` \| `work` \| `personal` \| `study` | `all`은 저장값이 없거나 잘못된 경우의 기본값 |
| `my-tasks-sort` | `status` \| `created` \| `category` \| `manual` | 기본값 `status` |
| `my-tasks-theme` | `dark` \| `light` | `index.html` 인라인 스크립트도 같은 키를 읽음 |

루트 버전과 `web_version`은 같은 출처(origin)에서 열면 같은 키를 공유한다.

### 3.3 내보내기 파일 형식

```json
{
  "app": "my-tasks",
  "version": 1,
  "exportedAt": "2026-11-11T06:28:00.000Z",
  "todos": [ /* 할 일 배열 */ ]
}
```

가져오기는 위 형식과 **할 일 배열만 있는 JSON** 두 가지를 모두 받는다.

### 3.4 데이터 검증 (`sanitizeTodos`)

localStorage에서 읽을 때와 파일을 가져올 때 같은 함수를 거친다.

- `text`가 문자열이 아니거나 비어 있으면 항목을 버린다.
- `id`가 없거나 중복이면 새로 발급한다.
- `completed`는 `true`일 때만 완료로 본다.
- `createdAt`이 잘못된 날짜면 현재 시각으로 대체한다.
- `category`가 유효하지 않으면 `personal`(`DEFAULT_CATEGORY`)로 보정한다.

## 4. 아키텍처

### 4.1 상태 → 렌더 흐름

`script.js`는 모듈 수준 변수에 상태를 두고, **상태를 바꾼 뒤 항상 `render()`를 호출**하는 단방향 구조다.

```
사용자 이벤트 → 상태 변경 함수(addTodo, toggleTodo, ...) → saveTodos() → render()
```

주요 상태 변수:

| 변수 | 의미 |
|------|------|
| `todos` | 할 일 배열 |
| `currentFilter`, `sortMode`, `searchQuery` | 목록 표시 조건 |
| `currentTheme` | `dark` / `light` |
| `editingId` | 인라인 수정 중인 항목 id (없으면 `null`) |
| `lastDeleted` | 최근 삭제 내역 `[{ todo, index }]` (실행 취소용) |
| `enteringIds` | 다음 렌더에서 페이드 인할 항목 id 집합 |
| `focusAfterRender` | 렌더 후 포커스를 줄 대상 `{ id, selector }` |
| `drag` | 진행 중인 드래그 정보 |
| `itemViews` | id → `<li>`와 내부 요소 참조 (DOM 재사용 캐시) |

### 4.2 `script.js` 구역

1. 상수 (스토리지 키, 카테고리, 자동 분류 키워드, 정렬 방식, 격언 등)
2. DOM 참조
3. 유틸리티 (`debounce`, `detectCategory`, `formatRelativeTime`, ...)
4. 저장소 (`readStorage`, `writeStorage`, `sanitizeTodos`, `loadTodos`, ...)
5. 상태
6. 피드백 (`showToast`, `announce`, `applyTheme`, `toggleTheme`, `getCheerMessage`)
7. 정렬/필터 (`sortTodos`, `getVisibleTodos`, `setFilter`, `setSort`)
8. 할 일 변경 (`addTodo`, `toggleTodo`, `deleteTodo`, `clearCompleted`, `undoDelete`)
9. 인라인 수정 (`startEdit`, `finishEdit`)
10. 수동 정렬 (`applyManualMove`, `moveByKeyboard`, `startDrag`, `moveDrag`, `endDrag`)
11. 내보내기/가져오기 (`exportTodos`, `askImportMode`, `importTodos`)
12. 렌더링 (`createItemView`, `updateItemView`, `renderDashboard`, `render`, ...)
13. 이벤트 등록
14. 초기화

## 5. 핵심 설계

### 5.1 렌더링 (DOM 재사용)

`render()`는 목록을 통째로 다시 만들지 않는다.

1. `getVisibleTodos()`로 필터·검색·정렬이 적용된 목록을 구한다.
2. 각 항목에 대해 `itemViews` 캐시의 `<li>`를 재사용하고 바뀐 부분만 갱신한다(`updateItemView`). 캐시에 없거나 일반/수정 모드가 바뀐 경우에만 새로 만든다(`createItemView`).
3. 더 이상 보이지 않는 항목은 캐시와 DOM에서 제거한다.
4. 이미 제자리에 있는 노드는 건드리지 않고, 순서가 다른 노드만 `insertBefore`로 옮긴다.
5. 이동 애니메이션, 포커스 복원을 처리한다.

이벤트는 목록 컨테이너(`#todo-list`)에 **위임**해 항목별 리스너를 만들지 않는다.

### 5.2 애니메이션

| 대상 | 방식 |
|------|------|
| 항목 추가/삭제 | CSS 키프레임 (`.entering` 페이드 인, `.removing` 페이드 아웃) |
| 순서 변경(완료 체크, 삭제 후 빈자리, 필터 변경) | FLIP 기법: 변경 전 위치 기록(`capturePositions`) → 변경 후 `element.animate()`로 이동(`playMoveAnimations`) |
| 진행률 바 | CSS `transition: width` |
| 테마 전환 | 전환 순간에만 `<html>`에 `.theme-transition` 클래스를 350ms 부여 |

- 이동 애니메이션은 화면에 보이는 항목에만 적용하고, 항목이 300개(`MAX_ANIMATED_ITEMS`)를 넘으면 생략한다.
- `prefers-reduced-motion: reduce`이면 CSS와 JS 애니메이션을 모두 생략한다.

### 5.3 인라인 수정

- 수정 종료는 `finishEdit(save)` 한 곳에서 처리한다. 재진입을 막기 위해 `editingId`를 먼저 `null`로 만든 뒤 값을 반영한다 (렌더로 입력창이 제거될 때 `focusout`이 다시 발생하기 때문).
- 수정 중인 항목의 체크박스/삭제 버튼을 누를 때는 `mousedown`에서 `preventDefault()`로 포커스 이동을 막아, `focusout` → 재렌더로 클릭이 유실되는 것을 방지한다.

### 5.4 정렬과 수동 정렬

- `sortTodos(list, mode)`는 원본을 바꾸지 않고 정렬된 새 배열을 돌려준다. 안정 정렬이므로 기준이 같은 항목은 배열 순서를 유지한다.
- 드래그는 **Pointer Events**로 구현해 마우스·터치·펜을 함께 처리한다. 끌고 있는 `<li>`는 DOM에서 떼지 않고(포커스·포인터 캡처 유지), 지나친 이웃 항목을 반대편으로 옮긴다.
- 놓을 때 `applyManualMove(id, prevId, nextId)`가 데이터 순서를 갱신한다. 수동 정렬이 아니었다면 현재 정렬 결과를 `todos`에 굳힌 뒤 `manual`로 전환한다.
- 드래그는 세로 한 줄 목록을 전제로 한다 (여러 열 배치와 호환되지 않음).

### 5.5 저장

- `saveTodos`는 300ms 디바운스된 함수다. `pagehide`와 `visibilitychange(hidden)`에서 `flush()`로 즉시 기록한다.
- `writeStorage`는 실패 시(용량 초과, 접근 차단) 한 번만 토스트로 알린다.
- `storage` 이벤트로 다른 탭의 변경을 받아 `todos`를 다시 읽는다 (수정·드래그 중에는 건너뜀).

### 5.6 자동 카테고리 분류

- `CATEGORY_KEYWORDS`에 카테고리별 키워드를 둔다 (영문은 소문자).
- `detectCategory(text)`는 소문자로 바꾼 내용에 포함된 키워드 수를 카테고리별로 세어 가장 많은 쪽을 돌려준다. 동점이면 `CATEGORY_ORDER`에서 앞선 쪽, 일치가 없으면 `null`.
- 다른 단어의 일부로 흔히 나타나는 짧은 낱말(예: "책" → 책상)은 오분류를 막기 위해 키워드에서 제외했다.

### 5.7 테마

- 색상은 모두 CSS 변수(`:root`, `:root[data-theme="dark"]`)로 정의한다.
- `index.html`의 `<head>` 인라인 스크립트가 첫 렌더 전에 `data-theme`을 설정한다 (저장값 → 없으면 `prefers-color-scheme`). `script.js`는 이 속성을 읽어 `currentTheme`을 초기화한다.
- 카테고리 색은 채움용(`--color-work` 등)과 글자용(`--color-work-text` 등)을 분리했다. 다크 모드에서는 글자용만 밝게 조정한다.

### 5.8 접근성

- 항목의 버튼·체크박스 레이블에 할 일 내용을 포함한다 (예: `"보고서 작성" 삭제`).
- 토스트 메시지와 `#sr-status`는 `aria-live="polite"` 영역이다.
- 포커스 이동: 삭제 → 이웃 항목의 삭제 버튼(없으면 입력창), 수정 종료 → 수정 버튼, 키보드 이동 → 핸들, 렌더로 풀린 포커스는 복원.
- 가져오기 확인은 `<dialog>.showModal()`을 사용한다 (미지원 브라우저는 `window.confirm`으로 대체).

## 6. 반응형 기준점

| 조건 | 적용 내용 |
|------|-----------|
| `max-width: 480px` | 여백 축소, 필터 버튼 균등 배치, 입력 영역 줄바꿈, 하단 버튼 전체 너비 |
| `max-width: 480px` 또는 `pointer: coarse` | 조작 영역 44px 이상, 단축키 안내 숨김 |
| `min-width: 960px` (`web_version`만) | 사이드바 + 본문 2단 그리드, 사이드바 sticky |
| `min-width: 1440px` (`web_version`만) | 사이드바 400px, 여백 확대 |

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| localStorage 읽기 실패 | `null` 반환 → 빈 목록/기본값으로 시작 |
| localStorage 쓰기 실패 | 토스트로 1회 안내 ("내보내기로 백업해 주세요") |
| 저장 데이터 손상(JSON 파싱 실패) | 빈 목록으로 시작, 콘솔에 기록 |
| 가져오기: 빈 파일 / 5MB 초과 / 잘못된 JSON / 목록 없음 / 유효 항목 0개 | `ImportError` 메시지를 토스트로 표시하고 현재 데이터 유지 |
| 가져오기 전 백업 실패 | 가져오기 중단 |
| 내보내기 실패 | 토스트 안내 |

## 8. 검증 현황

- `script.js`: `node --check` 문법 검사 통과.
- 자동 분류: 샘플 문장 6개로 `detectCategory` 결과 확인.
- `web_version`: 샘플 데이터 12개를 넣은 사본을 헤드리스 Chrome으로 1920×1080, 1366×768, 800×900에서 렌더링해 레이아웃 확인.
- **미검증**: 클릭·드래그·가져오기·포커스 이동 등 상호작용 전반은 브라우저에서 수동 확인이 필요하다. 자동화된 테스트는 없다.
