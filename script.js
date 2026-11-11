/**
 * My Tasks — 할 일 관리 앱
 *
 * 구조 요약
 *  - 상태(todos, 필터, 정렬, 검색어 등)는 이 파일의 모듈 변수에 두고,
 *    상태를 바꾼 뒤에는 항상 render()를 호출해 화면을 맞춘다.
 *  - render()는 목록을 통째로 다시 만들지 않고, id별로 캐시한 <li>를 재사용·수정·이동한다.
 *  - 모든 데이터는 localStorage에 저장한다 (저장은 디바운스, 페이지를 떠날 때 즉시 기록).
 *
 * 할 일 데이터 형식: { id, text, completed, createdAt, category }
 */

/* ==========================================================================
 * 상수
 * ========================================================================== */

// localStorage 키
const STORAGE_KEY = 'my-tasks';
const FILTER_STORAGE_KEY = 'my-tasks-filter';
const SORT_STORAGE_KEY = 'my-tasks-sort';
const THEME_STORAGE_KEY = 'my-tasks-theme'; // index.html의 인라인 스크립트도 같은 키를 읽는다

// 카테고리: 키 → 표시 이름. 객체의 키 순서가 '카테고리순' 정렬 순서가 된다.
const CATEGORIES = {
  work: '업무',
  personal: '개인',
  study: '공부',
};
const CATEGORY_ORDER = Object.keys(CATEGORIES);
// 카테고리 정보가 없거나 잘못된 데이터(이전 버전, 가져온 파일)에 적용할 기본값
const DEFAULT_CATEGORY = 'personal';

// 자동 분류용 키워드. 카테고리 선택이 '자동'일 때 할 일 내용에 포함된 키워드로 카테고리를 정한다.
// 영문 키워드는 소문자로 적는다 (비교할 때 입력을 소문자로 바꾼다).
// 다른 단어의 일부로 흔히 나타나는 짧은 낱말(예: '책' → 책상, 책임)은 오분류가 생기므로 넣지 않는다.
const CATEGORY_KEYWORDS = {
  work: [
    '회의', '미팅', '보고서', '업무', '회사', '출근', '퇴근', '메일', '프로젝트', '발표',
    '기획', '고객', '거래처', '결재', '계약', '마감', '출장', '면담', '배포', '회식',
    '견적', '제안서', '인수인계',
    'meeting', 'report', 'email', 'project', 'deadline', 'client',
  ],
  personal: [
    '운동', '헬스', '병원', '약속', '장보기', '청소', '빨래', '가족', '친구', '생일',
    '여행', '영화', '산책', '요리', '쇼핑', '은행', '미용실', '설거지', '택배', '데이트',
    '부모님', '강아지', '고양이',
    'gym', 'shopping', 'birthday',
  ],
  study: [
    '공부', '시험', '강의', '수업', '과제', '숙제', '독서', '복습', '예습', '학습',
    '영어', '수학', '코딩', '자격증', '토익', '인강', '논문', '스터디', '단어 암기', '문제집',
    '필기', '책 읽',
    'study', 'exam', 'homework', 'lecture',
  ],
};

const FILTER_LABELS = { all: '전체', ...CATEGORIES };

// 정렬 방식
//  - status  : 미완료 → 완료 순 (기본값)
//  - created : 생성일 최신순
//  - category: 업무 → 개인 → 공부 순
//  - manual  : 사용자가 드래그/키보드로 정한 순서 (todos 배열 순서 그대로)
const SORT_MODES = ['status', 'created', 'category', 'manual'];
const DEFAULT_SORT = 'status';

// Alt+1~4 단축키 → 필터
const SHORTCUT_FILTERS = {
  Digit1: 'all',
  Digit2: 'work',
  Digit3: 'personal',
  Digit4: 'study',
};

const SEARCH_DEBOUNCE_MS = 200;
const SAVE_DEBOUNCE_MS = 300;
const TOAST_DURATION_MS = 2500;
const UNDO_TOAST_DURATION_MS = 7000;
// 가져올 수 있는 파일의 최대 크기 (잘못 선택한 대용량 파일로 브라우저가 멈추는 것을 방지)
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
// 화면에 이보다 많은 항목이 있으면 이동 애니메이션을 생략한다
const MAX_ANIMATED_ITEMS = 300;
// 드래그 중 화면 가장자리에서 자동 스크롤이 시작되는 거리와 한 번에 스크롤하는 양(px)
const AUTO_SCROLL_EDGE = 60;
const AUTO_SCROLL_STEP = 14;

// 오늘의 격언 (페이지를 열 때마다 무작위로 하나 표시)
const QUOTES = [
  '천 리 길도 한 걸음부터.',
  '시작이 반이다.',
  '티끌 모아 태산.',
  '늦었다고 생각할 때가 가장 빠른 때다.',
  '오늘 할 일을 내일로 미루지 마라. — 벤저민 프랭클린',
  '미래는 현재 우리가 무엇을 하는가에 달려 있다. — 마하트마 간디',
  '계획 없는 목표는 한낱 꿈에 불과하다. — 생텍쥐페리',
  '성공은 매일 반복한 작은 노력들의 합이다. — 로버트 콜리어',
];

/* ==========================================================================
 * DOM 참조
 * ========================================================================== */

const inputEl = document.getElementById('todo-input');
const categoryEl = document.getElementById('category-select');
const autoOptionEl = categoryEl.querySelector('option[value="auto"]');
const addBtn = document.getElementById('add-btn');
const filterBarEl = document.getElementById('filter-bar');
const filterBtns = [...filterBarEl.querySelectorAll('.filter-btn')];
const searchEl = document.getElementById('search-input');
const sortEl = document.getElementById('sort-select');
const listEl = document.getElementById('todo-list');
const emptyEl = document.getElementById('empty-message');
const quoteEl = document.getElementById('quote');
const progressTextEl = document.getElementById('progress-text');
const progressTrackEl = document.getElementById('progress-track');
const progressBarEl = document.getElementById('progress-bar');
const todayCountEl = document.getElementById('today-count');
const cheerEl = document.getElementById('cheer-message');
const remainingBadgeEl = document.getElementById('remaining-badge');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileEl = document.getElementById('import-file');
const importDialogEl = document.getElementById('import-dialog');
const importDialogMessageEl = document.getElementById('import-dialog-message');
const themeToggleEl = document.getElementById('theme-toggle');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');
const toastActionEl = document.getElementById('toast-action');
const srStatusEl = document.getElementById('sr-status');

// 카테고리별 통계 요소를 미리 찾아 둔다 (렌더링마다 querySelector를 반복하지 않기 위해)
const categoryStatEls = [...document.querySelectorAll('.category-stat')].map((el) => ({
  category: el.dataset.category,
  countEl: el.querySelector('.category-stat-count'),
  barEl: el.querySelector('.mini-bar'),
}));

// OS의 '동작 줄이기' 설정. 켜져 있으면 JS로 만드는 애니메이션도 생략한다.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ==========================================================================
 * 유틸리티
 * ========================================================================== */

/**
 * 마지막 호출 후 delay(ms)가 지나면 fn을 한 번 실행하는 함수를 만든다.
 *  - flush(): 대기 중인 호출이 있으면 즉시 실행
 *  - cancel(): 대기 중인 호출을 취소
 */
function debounce(fn, delay) {
  let timer = null;

  function run() {
    timer = null;
    fn();
  }

  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      run();
    }
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}

function isCategory(value) {
  return typeof value === 'string' && Object.hasOwn(CATEGORIES, value);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 할 일 내용의 키워드로 카테고리를 추정한다.
 * 포함된 키워드가 가장 많은 카테고리를 고르고, 동점이면 CATEGORY_ORDER에서 앞선 쪽을 고른다.
 * @returns {string | null} 카테고리 키. 일치하는 키워드가 하나도 없으면 null
 */
function detectCategory(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestCount = 0;

  for (const category of CATEGORY_ORDER) {
    const count = CATEGORY_KEYWORDS[category].filter((keyword) => lower.includes(keyword)).length;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/** 카테고리 선택이 '자동'일 때 실제로 적용될 카테고리 (키워드가 없으면 기본 카테고리). */
function resolveAutoCategory(text) {
  return detectCategory(text) ?? DEFAULT_CATEGORY;
}

/** '자동' 옵션의 이름에 지금 입력한 내용이 어느 카테고리로 분류될지 미리 보여 준다. */
function updateAutoCategoryHint() {
  const text = inputEl.value.trim();
  autoOptionEl.textContent = text ? `자동: ${CATEGORIES[resolveAutoCategory(text)]}` : '자동';
}

/** 중복 비교용으로 텍스트를 정규화한다 (앞뒤 공백 제거, 연속 공백 축소, 대소문자 무시). */
function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** ISO 날짜 문자열을 "2시간 전" 같은 상대 시간으로 바꾼다. 잘못된 날짜면 빈 문자열. */
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(diffMs)) return '';

  // 기기 시계가 달라 미래 시각으로 기록된 경우에도 '방금 전'으로 표시된다
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;

  return `${Math.floor(days / 365)}년 전`;
}

function toPercent(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** CSS 애니메이션 클래스를 다시 붙여 처음부터 재생한다. */
function replayAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // 리플로우를 강제해야 같은 애니메이션이 다시 시작된다
  el.classList.add(className);
  el.addEventListener('animationend', () => el.classList.remove(className), { once: true });
}

/* ==========================================================================
 * 저장소 (localStorage)
 * ========================================================================== */

// 저장 실패 알림을 반복해서 띄우지 않기 위한 플래그
let storageErrorShown = false;

/** localStorage에서 값을 읽는다. 사용할 수 없는 환경(차단, 시크릿 모드 등)이면 null. */
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`저장소를 읽지 못했습니다 (${key}):`, err);
    return null;
  }
}

/** localStorage에 값을 쓴다. 실패(용량 초과, 접근 차단)하면 한 번만 사용자에게 알린다. */
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    storageErrorShown = false;
    return true;
  } catch (err) {
    console.error(`저장소에 쓰지 못했습니다 (${key}):`, err);
    if (!storageErrorShown) {
      storageErrorShown = true;
      showToast('브라우저에 저장하지 못했습니다. 내보내기로 백업해 주세요.', { duration: 5000 });
    }
    return false;
  }
}

/**
 * 외부에서 온 데이터(localStorage, 가져온 파일)를 검증해 올바른 할 일 배열로 만든다.
 *  - 텍스트가 없는 항목은 버린다.
 *  - id가 없거나 중복이면 새로 발급한다.
 *  - 완료 여부/생성일/카테고리가 잘못되어 있으면 기본값으로 보정한다.
 * @returns {{ items: object[], skipped: number }} 정리된 항목과 버린 항목 수
 */
function sanitizeTodos(rawList) {
  const items = [];
  const usedIds = new Set();
  let skipped = 0;

  for (const raw of rawList) {
    const text = raw && typeof raw === 'object' && typeof raw.text === 'string'
      ? raw.text.trim()
      : '';
    if (!text) {
      skipped += 1;
      continue;
    }

    let id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
    if (!id || usedIds.has(id)) id = createId();
    usedIds.add(id);

    const createdTime = Date.parse(raw.createdAt);

    items.push({
      id,
      text,
      completed: raw.completed === true,
      createdAt: Number.isNaN(createdTime)
        ? new Date().toISOString()
        : new Date(createdTime).toISOString(),
      category: isCategory(raw.category) ? raw.category : DEFAULT_CATEGORY,
    });
  }

  return { items, skipped };
}

function loadTodos() {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizeTodos(parsed).items : [];
  } catch (err) {
    // 저장된 데이터가 손상된 경우: 빈 목록으로 시작한다
    console.error('저장된 할 일을 읽지 못했습니다:', err);
    return [];
  }
}

function loadFilter() {
  const saved = readStorage(FILTER_STORAGE_KEY);
  return isCategory(saved) ? saved : 'all';
}

function loadSort() {
  const saved = readStorage(SORT_STORAGE_KEY);
  return SORT_MODES.includes(saved) ? saved : DEFAULT_SORT;
}

/* ==========================================================================
 * 상태
 * ========================================================================== */

// 할 일 목록. 배열 순서 = 추가 순서이자 '수동 정렬' 순서.
let todos = loadTodos();
// 'all' 또는 CATEGORIES의 키
let currentFilter = loadFilter();
// SORT_MODES 중 하나
let sortMode = loadSort();
// 검색어 (정규화된 소문자, 저장하지 않음)
let searchQuery = '';
// 테마는 index.html <head>의 인라인 스크립트가 먼저 적용해 둔다
let currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

// 인라인 수정 중인 할 일의 id (없으면 null)
let editingId = null;
// 다음 렌더링에서 페이드 인 애니메이션을 적용할 할 일 id (새로 추가/복구된 항목)
const enteringIds = new Set();
// 가장 최근 삭제 내역 (실행 취소용): [{ todo, index }] 또는 null
let lastDeleted = null;
// 다음 렌더링 후 포커스를 옮길 대상: { id, selector } 또는 null
let focusAfterRender = null;
// 진행 중인 드래그 정보: { li, handle, pointerId, moved } 또는 null
let drag = null;

// id → 항목 뷰(<li>와 내부 요소 참조). 렌더링 때 DOM을 재사용하기 위한 캐시.
const itemViews = new Map();

let toastTimer = null;
let toastAction = null;
let themeTransitionTimer = null;

// 할 일 저장은 디바운스한다. 연속 조작(여러 개 체크, 드래그 등) 중 매번 직렬화하지 않기 위해서다.
// 페이지를 떠날 때는 아래 이벤트 등록부에서 flush()로 즉시 기록한다.
const saveTodos = debounce(() => {
  writeStorage(STORAGE_KEY, JSON.stringify(todos));
}, SAVE_DEBOUNCE_MS);

/* ==========================================================================
 * 피드백: 토스트 / 스크린 리더 알림 / 테마
 * ========================================================================== */

/**
 * 화면 하단에 알림을 띄운다. 메시지는 aria-live 영역이라 스크린 리더도 읽어 준다.
 * @param {string} message
 * @param {{ actionLabel?: string, onAction?: Function, duration?: number }} [options]
 *        actionLabel/onAction을 주면 알림 안에 버튼(예: 실행 취소)을 함께 표시한다.
 */
function showToast(message, { actionLabel = null, onAction = null, duration = TOAST_DURATION_MS } = {}) {
  toastMessageEl.textContent = message;
  toastAction = actionLabel ? onAction : null;
  toastActionEl.textContent = actionLabel ?? '';
  toastActionEl.hidden = !actionLabel;

  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.classList.remove('show');
  toastAction = null;
}

/** 화면에는 보이지 않는 알림을 스크린 리더에 전달한다. */
function announce(message) {
  srStatusEl.textContent = message;
}

function announceVisibleCount() {
  announce(`${getVisibleTodos().length}개 항목 표시 중`);
}

function applyTheme() {
  document.documentElement.dataset.theme = currentTheme;
  themeToggleEl.setAttribute('aria-checked', String(currentTheme === 'dark'));
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // 전환되는 동안에만 색상 트랜지션을 켠다 (평소 호버 효과 등에는 영향이 없도록)
  document.documentElement.classList.add('theme-transition');
  clearTimeout(themeTransitionTimer);
  themeTransitionTimer = setTimeout(
    () => document.documentElement.classList.remove('theme-transition'),
    350,
  );

  applyTheme();
  writeStorage(THEME_STORAGE_KEY, currentTheme);
  showToast(currentTheme === 'dark' ? '다크 모드로 전환했습니다.' : '라이트 모드로 전환했습니다.');
}

function showRandomQuote() {
  quoteEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

/** 완료율에 따른 응원 메시지를 고른다. */
function getCheerMessage(total, done) {
  if (total === 0) return '첫 할 일을 추가하고 하루를 시작해 보세요.';
  if (done === total) return '모두 완료했어요! 오늘도 수고했어요 🎉';

  const percent = toPercent(done, total);
  if (percent === 0) return '시작이 반이에요. 하나만 먼저 끝내 볼까요?';
  if (percent < 50) return '좋은 출발이에요. 이 속도로 계속 가요!';
  if (percent < 80) return '절반을 넘었어요. 잘하고 있어요!';
  return '거의 다 왔어요. 조금만 더 힘내요!';
}

/* ==========================================================================
 * 정렬 / 필터
 * ========================================================================== */

/**
 * 주어진 방식으로 정렬한 새 배열을 돌려준다 (원본은 바꾸지 않는다).
 * Array.prototype.sort는 안정 정렬이므로 기준이 같은 항목끼리는 기존 순서가 유지된다.
 */
function sortTodos(list, mode) {
  const sorted = [...list];

  if (mode === 'status') {
    sorted.sort((a, b) => Number(a.completed) - Number(b.completed));
  } else if (mode === 'created') {
    sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } else if (mode === 'category') {
    sorted.sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
  }
  // 'manual'은 배열 순서 그대로

  return sorted;
}

/** 카테고리 필터와 검색어를 적용한 뒤 현재 정렬 방식으로 정렬한, 화면에 보일 목록. */
function getVisibleTodos() {
  const filtered = todos.filter(
    (todo) =>
      (currentFilter === 'all' || todo.category === currentFilter) &&
      (!searchQuery || todo.text.toLowerCase().includes(searchQuery)),
  );
  return sortTodos(filtered, sortMode);
}

function setFilter(filter) {
  finishEdit(true);
  currentFilter = filter === 'all' || isCategory(filter) ? filter : 'all';
  writeStorage(FILTER_STORAGE_KEY, currentFilter);
  render();
  announceVisibleCount();
}

function setSort(mode) {
  finishEdit(true);
  sortMode = SORT_MODES.includes(mode) ? mode : DEFAULT_SORT;
  sortEl.value = sortMode;
  writeStorage(SORT_STORAGE_KEY, sortMode);
  render();
}

/* ==========================================================================
 * 할 일 변경
 * ========================================================================== */

function addTodo() {
  const text = inputEl.value.trim();
  if (!text) {
    // 빈 입력: 입력창을 흔들어 알려 준다
    inputEl.focus();
    replayAnimation(inputEl, 'shake');
    return;
  }

  // 중복 확인: 같은 내용의 할 일이 이미 있으면 추가 여부를 묻는다
  const normalized = normalizeText(text);
  const duplicate = todos.find((todo) => normalizeText(todo.text) === normalized);
  if (duplicate) {
    const state = duplicate.completed ? '완료된 항목' : '진행 중인 항목';
    if (!window.confirm(`"${duplicate.text}"은(는) 이미 목록에 있습니다 (${state}).\n그래도 추가할까요?`)) {
      inputEl.focus();
      inputEl.select();
      return;
    }
  }

  finishEdit(true);

  const todo = {
    id: createId(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    // 직접 고른 카테고리가 있으면 그대로, '자동'이면 키워드로 분류한다
    category: isCategory(categoryEl.value) ? categoryEl.value : resolveAutoCategory(text),
  };
  todos.push(todo);
  enteringIds.add(todo.id);

  inputEl.value = '';
  updateAutoCategoryHint();
  inputEl.focus();
  saveTodos();
  render();

  // 현재 필터/검색 조건 때문에 새 항목이 보이지 않으면 알려 준다
  if (itemViews.has(todo.id)) {
    announce(`"${text}" ${CATEGORIES[todo.category]} 카테고리로 추가됨`);
  } else {
    showToast('추가했습니다. 현재 필터·검색 조건에 가려져 있습니다.');
  }
}

function toggleTodo(id) {
  finishEdit(true);
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  todo.completed = !todo.completed;
  saveTodos();
  render();
}

function deleteTodo(id) {
  const wasEditing = finishEdit(true);
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) return;

  const [removed] = todos.splice(index, 1);
  lastDeleted = [{ todo: removed, index }];
  saveTodos();
  showToast('할 일을 삭제했습니다.', {
    actionLabel: '실행 취소',
    onAction: undoDelete,
    duration: UNDO_TOAST_DURATION_MS,
  });

  const li = itemViews.get(id)?.li;
  itemViews.delete(id);

  // 포커스 관리: 삭제되는 항목 안에 포커스가 있었다면 이웃 항목(없으면 입력창)으로 옮긴다
  if (li && li.contains(document.activeElement)) {
    const neighbor = li.nextElementSibling ?? li.previousElementSibling;
    (neighbor?.querySelector('.delete-btn') ?? inputEl).focus();
  }

  if (wasEditing || !li || !li.isConnected || reducedMotion.matches) {
    render();
    return;
  }

  // 통계는 즉시 갱신하고, 항목은 페이드 아웃이 끝난 뒤 DOM에서 제거한다.
  // (그 사이 다른 render()가 실행되면 이 <li>는 그때 바로 제거된다)
  renderDashboard();
  li.classList.add('removing');
  li.addEventListener('animationend', () => {
    const positions = capturePositions();
    li.remove();
    updateEmptyMessage();
    playMoveAnimations(positions);
  }, { once: true });
}

function clearCompleted() {
  // 원래 위치(index)를 함께 기록해 두어 실행 취소 시 제자리에 되돌릴 수 있게 한다
  const removed = [];
  todos.forEach((todo, index) => {
    if (todo.completed) removed.push({ todo, index });
  });
  if (removed.length === 0) return;
  if (!window.confirm(`완료된 항목 ${removed.length}개를 모두 삭제할까요?`)) return;

  finishEdit(true);
  todos = todos.filter((todo) => !todo.completed);
  lastDeleted = removed;
  saveTodos();
  render();
  inputEl.focus();
  showToast(`완료된 항목 ${removed.length}개를 삭제했습니다.`, {
    actionLabel: '실행 취소',
    onAction: undoDelete,
    duration: UNDO_TOAST_DURATION_MS,
  });
}

/** 가장 최근 삭제(단일 삭제 또는 완료 항목 일괄 삭제)를 되돌린다. */
function undoDelete() {
  if (!lastDeleted) return;

  finishEdit(true);
  const existingIds = new Set(todos.map((todo) => todo.id));
  let restored = 0;

  // index 오름차순으로 넣어야 여러 항목이 원래 위치에 정확히 돌아간다
  for (const { todo, index } of [...lastDeleted].sort((a, b) => a.index - b.index)) {
    if (existingIds.has(todo.id)) continue;
    todos.splice(Math.min(index, todos.length), 0, todo);
    enteringIds.add(todo.id);
    restored += 1;
  }

  lastDeleted = null;
  saveTodos();
  render();
  showToast(restored > 0 ? `${restored}개 항목을 복구했습니다.` : '복구할 항목이 없습니다.');
}

/* ==========================================================================
 * 인라인 수정
 * ========================================================================== */

function startEdit(id) {
  finishEdit(true);
  editingId = id;
  render(); // render()가 수정 입력창에 포커스를 준다
}

/**
 * 수정 모드를 종료한다. save가 true면 입력값을 반영한다 (빈 텍스트면 원래 값 유지).
 * 화면 갱신은 호출한 쪽에서 render()로 한다.
 * @returns {boolean} 수정 중이었으면 true
 */
function finishEdit(save) {
  if (editingId === null) return false;

  const id = editingId;
  // 렌더링으로 입력창이 제거될 때 발생하는 focusout에서 다시 진입하지 않도록 먼저 해제
  editingId = null;

  if (save) {
    const todo = todos.find((item) => item.id === id);
    const view = itemViews.get(id);

    if (todo && view?.editInput && view.editCategory) {
      const text = view.editInput.value.trim() || todo.text;
      const category = isCategory(view.editCategory.value) ? view.editCategory.value : todo.category;

      if (text !== todo.text || category !== todo.category) {
        todo.text = text;
        todo.category = category;
        saveTodos();
        showToast('할 일을 수정했습니다.');
      }
    }
  }
  return true;
}

/* ==========================================================================
 * 수동 정렬 (드래그 앤 드롭 / 키보드)
 * ========================================================================== */

/**
 * 할 일 하나를 화면상 prevId 항목과 nextId 항목 사이로 옮긴다.
 * 수동 정렬이 아닌 상태에서 옮기면, 현재 보이는 순서를 배열에 그대로 굳힌 뒤
 * 수동 정렬로 전환한다 (그래야 옮긴 결과가 화면에 유지된다).
 * @returns {boolean} 실제로 옮겼으면 true
 */
function applyManualMove(id, prevId, nextId) {
  if (sortMode !== 'manual') {
    todos = sortTodos(todos, sortMode);
    sortMode = 'manual';
    sortEl.value = sortMode;
    writeStorage(SORT_STORAGE_KEY, sortMode);
    showToast('수동 정렬로 전환했습니다.');
  }

  const from = todos.findIndex((todo) => todo.id === id);
  if (from === -1) return false;
  const [moved] = todos.splice(from, 1);

  // 다음 항목 바로 앞, 없으면 이전 항목 바로 뒤에 넣는다.
  // (필터/검색 중이라 숨겨진 항목이 사이에 있어도 보이는 순서는 의도대로 된다)
  let to = nextId ? todos.findIndex((todo) => todo.id === nextId) : -1;
  if (to === -1 && prevId) {
    const prevIndex = todos.findIndex((todo) => todo.id === prevId);
    if (prevIndex !== -1) to = prevIndex + 1;
  }
  if (to === -1) to = from; // 기준 항목을 찾지 못하면 제자리에 되돌린다

  todos.splice(to, 0, moved);
  saveTodos();
  return true;
}

/** 키보드(핸들에서 ↑/↓)로 한 칸씩 옮긴다. direction: -1(위) 또는 1(아래) */
function moveByKeyboard(id, direction) {
  const visible = getVisibleTodos();
  const index = visible.findIndex((todo) => todo.id === id);
  const targetIndex = index + direction;

  if (index === -1 || targetIndex < 0 || targetIndex >= visible.length) {
    announce('더 이상 이동할 수 없습니다.');
    return;
  }

  // 위로: 바로 위 항목의 앞으로 / 아래로: 바로 아래 항목의 뒤로
  const prevId = direction < 0 ? visible[targetIndex - 1]?.id ?? null : visible[targetIndex].id;
  const nextId = direction < 0 ? visible[targetIndex].id : visible[targetIndex + 1]?.id ?? null;

  applyManualMove(id, prevId, nextId);
  focusAfterRender = { id, selector: '.drag-handle' };
  render();
  announce(`${visible.length}개 중 ${targetIndex + 1}번째로 이동했습니다.`);
}

function startDrag(event) {
  const handle = event.target.closest('.drag-handle');
  // 수정 중에는 드래그를 시작하지 않는다 (포커스가 빠지면서 수정이 먼저 저장된다)
  if (!handle || drag || editingId !== null) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const li = handle.closest('.todo-item');
  if (!li) return;

  drag = { li, handle, pointerId: event.pointerId, moved: false };
  try {
    // 포인터가 핸들을 벗어나도 이동/해제 이벤트를 계속 받는다
    handle.setPointerCapture(event.pointerId);
  } catch {
    // 캡처에 실패해도 목록 위에서는 드래그가 동작한다
  }
  li.classList.add('dragging');
  document.body.classList.add('is-dragging');
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;

  // 포인터가 좌우로 목록을 벗어나도 동작하도록 x는 목록 중앙으로 고정한다
  const listRect = listEl.getBoundingClientRect();
  const target = document
    .elementFromPoint(listRect.left + listRect.width / 2, event.clientY)
    ?.closest('.todo-item');

  if (target && target !== drag.li && target.parentElement === listEl) {
    const rect = target.getBoundingClientRect();
    const pastMiddle = event.clientY > rect.top + rect.height / 2;
    const targetIsBelow = Boolean(
      drag.li.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // 끌고 있는 <li> 자체는 DOM에서 떼지 않고(포커스·포인터 캡처 유지),
    // 지나친 이웃 항목들을 반대편으로 옮겨 순서를 바꾼다.
    if (targetIsBelow && pastMiddle) {
      let sibling;
      do {
        sibling = drag.li.nextElementSibling;
        drag.li.before(sibling);
      } while (sibling !== target);
      drag.moved = true;
    } else if (!targetIsBelow && !pastMiddle) {
      let sibling;
      do {
        sibling = drag.li.previousElementSibling;
        drag.li.after(sibling);
      } while (sibling !== target);
      drag.moved = true;
    }
  }

  // 화면 위/아래 가장자리 근처에서는 자동으로 스크롤한다
  if (event.clientY < AUTO_SCROLL_EDGE) {
    window.scrollBy(0, -AUTO_SCROLL_STEP);
  } else if (event.clientY > window.innerHeight - AUTO_SCROLL_EDGE) {
    window.scrollBy(0, AUTO_SCROLL_STEP);
  }
}

/** 드래그를 끝낸다. commit이 false(취소)면 원래 순서로 되돌린다. */
function endDrag(event, commit) {
  if (!drag || event.pointerId !== drag.pointerId) return;

  const { li, moved } = drag;
  drag = null;
  li.classList.remove('dragging');
  document.body.classList.remove('is-dragging');

  if (commit && moved) {
    // 놓은 위치의 앞뒤 항목을 기준으로 데이터 순서를 갱신한다
    applyManualMove(
      li.dataset.id,
      li.previousElementSibling?.dataset.id ?? null,
      li.nextElementSibling?.dataset.id ?? null,
    );
  }
  // 커밋이든 취소든 데이터 기준으로 화면을 다시 맞춘다
  render();
}

/* ==========================================================================
 * 내보내기 / 가져오기
 * ========================================================================== */

/** 가져오기 과정에서 사용자에게 그대로 보여 줄 수 있는 오류 */
class ImportError extends Error {}

/**
 * 현재 할 일을 JSON 파일로 내려받는다.
 * @param {string} [suffix] 파일 이름 뒤에 붙일 구분자 (예: 'backup')
 * @returns {boolean} 성공 여부
 */
function exportTodos(suffix = '') {
  try {
    const payload = {
      app: 'my-tasks',
      version: 1,
      exportedAt: new Date().toISOString(),
      todos,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    const link = document.createElement('a');
    link.href = url;
    link.download = `my-tasks-${date}${suffix ? `-${suffix}` : ''}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    // 다운로드가 시작될 시간을 준 뒤 임시 URL을 해제한다
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('내보내기에 실패했습니다:', err);
    showToast('내보내기에 실패했습니다.');
    return false;
  }
}

/**
 * 가져오기 전에 현재 데이터를 어떻게 할지 묻는다.
 * @returns {Promise<'backup' | 'replace' | 'cancel'>}
 */
function askImportMode(currentCount, incomingCount) {
  const message =
    `현재 할 일 ${currentCount}개가 가져온 ${incomingCount}개로 교체됩니다. ` +
    '먼저 현재 데이터를 백업 파일로 저장할까요?';

  // <dialog>를 지원하지 않는 브라우저에서는 기본 확인 창으로 대신한다
  if (typeof importDialogEl.showModal !== 'function') {
    return Promise.resolve(
      window.confirm(`${message}\n\n[확인] 백업 후 가져오기 / [취소] 가져오기 취소`)
        ? 'backup'
        : 'cancel',
    );
  }

  return new Promise((resolve) => {
    importDialogMessageEl.textContent = message;
    importDialogEl.returnValue = ''; // 이전에 닫을 때의 값이 남아 있지 않게 초기화
    importDialogEl.addEventListener('close', () => {
      const choice = importDialogEl.returnValue;
      // Esc로 닫으면 returnValue가 비어 있다 → 취소로 처리
      resolve(choice === 'backup' || choice === 'replace' ? choice : 'cancel');
    }, { once: true });
    importDialogEl.showModal();
  });
}

/** 선택한 JSON 파일을 읽어 현재 할 일 목록을 교체한다. */
async function importTodos(file) {
  try {
    if (file.size === 0) throw new ImportError('빈 파일입니다.');
    if (file.size > MAX_IMPORT_BYTES) throw new ImportError('파일이 너무 큽니다 (최대 5MB).');

    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new ImportError('JSON 형식이 올바르지 않은 파일입니다.');
    }

    // 이 앱이 내보낸 형식({ todos: [...] })과 할 일 배열만 있는 형식을 모두 받는다
    const rawList = Array.isArray(data) ? data : data?.todos;
    if (!Array.isArray(rawList)) throw new ImportError('파일에서 할 일 목록을 찾을 수 없습니다.');

    const { items, skipped } = sanitizeTodos(rawList);
    if (items.length === 0) throw new ImportError('가져올 수 있는 할 일이 없습니다.');

    // 현재 데이터가 있으면 덮어쓰기 전에 백업 여부를 확인한다
    if (todos.length > 0) {
      const choice = await askImportMode(todos.length, items.length);
      if (choice === 'cancel') {
        showToast('가져오기를 취소했습니다.');
        return;
      }
      // 백업에 실패하면 데이터를 잃지 않도록 가져오기를 중단한다
      if (choice === 'backup' && !exportTodos('backup')) return;
    }

    finishEdit(false);
    todos = items;
    lastDeleted = null; // 이전 목록의 삭제 내역은 더 이상 되돌릴 수 없다
    saveTodos();
    saveTodos.flush();
    render();
    showToast(
      skipped > 0
        ? `${items.length}개를 가져왔습니다 (형식이 맞지 않는 ${skipped}개 제외).`
        : `${items.length}개를 가져왔습니다.`,
    );
  } catch (err) {
    if (!(err instanceof ImportError)) console.error('가져오기에 실패했습니다:', err);
    showToast(err instanceof ImportError ? err.message : '파일을 읽지 못했습니다.', { duration: 4000 });
  }
}

/* ==========================================================================
 * 렌더링
 * ========================================================================== */

/** 인라인 수정용 입력창 + 카테고리 select를 만든다. */
function createEditElement(todo) {
  const edit = document.createElement('div');
  edit.className = 'todo-edit';

  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.className = 'edit-input';
  editInput.value = todo.text;
  editInput.maxLength = 200;
  editInput.setAttribute('aria-label', '할 일 수정 (Enter 저장, Esc 취소)');

  const editCategory = document.createElement('select');
  editCategory.className = 'edit-category';
  editCategory.setAttribute('aria-label', '카테고리 변경');
  for (const [value, label] of Object.entries(CATEGORIES)) {
    editCategory.append(new Option(label, value, false, value === todo.category));
  }

  edit.append(editInput, editCategory);
  return { edit, editInput, editCategory };
}

/**
 * 할 일 하나의 <li>를 새로 만들고, 이후 부분 갱신에 쓸 내부 요소 참조를 함께 돌려준다.
 * 일반 모드와 수정 모드는 구조가 달라서 모드가 바뀔 때만 새로 만든다.
 */
function createItemView(todo, editing) {
  const li = document.createElement('li');
  li.className = 'todo-item';
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';

  const body = document.createElement('div');
  body.className = 'todo-body';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';

  // text/category는 updateItemView가 '마지막으로 그린 값'을 기억하는 칸이다 (처음엔 null → 반드시 그림)
  const view = { li, checkbox, deleteBtn, editing, text: null, category: null };

  if (editing) {
    const { edit, editInput, editCategory } = createEditElement(todo);
    view.editInput = editInput;
    view.editCategory = editCategory;
    body.append(edit);
    li.append(checkbox, body, deleteBtn);
  } else {
    // 순서 변경 핸들: 마우스/터치로 끌거나, 포커스 후 ↑/↓ 키로 이동
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'drag-handle';
    handle.textContent = '≡';
    handle.title = '끌어서 순서 변경 (키보드: ↑/↓)';

    const textEl = document.createElement('span');
    textEl.className = 'todo-text';
    textEl.title = '더블클릭하여 수정';

    const meta = document.createElement('div');
    meta.className = 'todo-meta';

    const tag = document.createElement('span');
    tag.className = 'category-tag';

    const time = document.createElement('time');
    time.className = 'todo-time';
    time.dateTime = todo.createdAt;
    time.title = new Date(todo.createdAt).toLocaleString('ko-KR');
    time.textContent = formatRelativeTime(todo.createdAt);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = '수정';

    meta.append(tag, time);
    body.append(textEl, meta);
    li.append(handle, checkbox, body, editBtn, deleteBtn);

    Object.assign(view, { handle, textEl, tag, time, editBtn });
  }

  // 새로 추가/복구된 항목은 페이드 인. 끝나면 클래스를 떼어야
  // 나중에 <li>가 DOM 안에서 옮겨질 때 애니메이션이 다시 재생되지 않는다.
  if (enteringIds.has(todo.id)) {
    li.classList.add('entering');
    li.addEventListener('animationend', () => li.classList.remove('entering'), { once: true });
  }

  updateItemView(view, todo);
  return view;
}

/** 기존 <li>에서 바뀐 부분만 갱신한다. */
function updateItemView(view, todo) {
  view.li.classList.toggle('completed', todo.completed);
  view.checkbox.checked = todo.completed;

  if (view.text !== todo.text) {
    view.text = todo.text;
    // 스크린 리더가 어떤 항목의 버튼인지 알 수 있도록 레이블에 할 일 내용을 넣는다
    view.checkbox.setAttribute('aria-label', `"${todo.text}" 완료 표시`);
    view.deleteBtn.setAttribute('aria-label', `"${todo.text}" 삭제`);

    if (!view.editing) {
      view.textEl.textContent = todo.text;
      view.handle.setAttribute('aria-label', `"${todo.text}" 순서 변경. 위아래 화살표 키로 이동`);
      view.editBtn.setAttribute('aria-label', `"${todo.text}" 수정`);
    }
  }

  if (view.category !== todo.category) {
    view.category = todo.category;
    if (!view.editing) {
      view.tag.dataset.category = todo.category;
      view.tag.textContent = CATEGORIES[todo.category];
    }
  }
}

/** 캐시된 뷰를 재사용하거나(부분 갱신), 없거나 모드가 바뀌었으면 새로 만든다. */
function getItemElement(todo) {
  const editing = todo.id === editingId;
  let view = itemViews.get(todo.id);

  if (!view || view.editing !== editing) {
    view = createItemView(todo, editing);
    itemViews.set(todo.id, view);
  } else {
    updateItemView(view, todo);
  }
  return view.li;
}

function renderFilters() {
  for (const btn of filterBtns) {
    const isActive = btn.dataset.filter === currentFilter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  }
}

/**
 * 대시보드, 남은 개수 배지, 응원 메시지, 완료 항목 삭제 버튼을 갱신한다.
 * 필터·검색과 무관하게 전체 할 일 기준이며, 목록을 한 번만 순회해 집계한다.
 */
function renderDashboard() {
  const today = new Date().toDateString();
  const byCategory = Object.fromEntries(CATEGORY_ORDER.map((key) => [key, { total: 0, done: 0 }]));
  let done = 0;
  let todayCount = 0;

  for (const todo of todos) {
    const stat = byCategory[todo.category];
    stat.total += 1;
    if (todo.completed) {
      stat.done += 1;
      done += 1;
    }
    if (new Date(todo.createdAt).toDateString() === today) todayCount += 1;
  }

  const total = todos.length;
  const percent = toPercent(done, total);

  progressTextEl.textContent = `${done}/${total} 완료 (${percent}%)`;
  progressBarEl.style.width = `${percent}%`;
  progressTrackEl.setAttribute('aria-valuenow', String(percent));
  progressTrackEl.setAttribute('aria-valuetext', `${total}개 중 ${done}개 완료, ${percent}퍼센트`);
  todayCountEl.textContent = `오늘 추가 ${todayCount}개`;
  cheerEl.textContent = getCheerMessage(total, done);

  const remainingText = `${total - done}개 남음`;
  if (remainingBadgeEl.textContent !== remainingText) {
    remainingBadgeEl.textContent = remainingText;
    replayAnimation(remainingBadgeEl, 'bump');
  }

  clearCompletedBtn.disabled = done === 0;
  clearCompletedBtn.textContent = done === 0
    ? '완료된 항목 모두 삭제'
    : `완료된 항목 모두 삭제 (${done})`;

  for (const { category, countEl, barEl } of categoryStatEls) {
    const stat = byCategory[category];
    if (!stat) continue;
    countEl.textContent = `${stat.done}/${stat.total}`;
    barEl.style.width = `${toPercent(stat.done, stat.total)}%`;
  }
}

function updateEmptyMessage() {
  emptyEl.hidden = listEl.children.length > 0;

  if (todos.length === 0) {
    emptyEl.textContent = '할 일이 없습니다. 추가해보세요!';
  } else if (searchQuery) {
    emptyEl.textContent = `'${searchEl.value.trim()}'에 대한 검색 결과가 없습니다.`;
  } else {
    emptyEl.textContent = `'${FILTER_LABELS[currentFilter]}' 카테고리에 할 일이 없습니다.`;
  }
}

/** 목록 변경 전 각 항목의 세로 위치를 기록해 둔다 (이동 애니메이션용). */
function capturePositions() {
  const positions = new Map();
  if (reducedMotion.matches || listEl.children.length > MAX_ANIMATED_ITEMS) return positions;

  for (const li of listEl.children) {
    positions.set(li.dataset.id, li.getBoundingClientRect().top);
  }
  return positions;
}

/**
 * 이전 위치에서 새 위치로 미끄러지듯 이동시킨다 (완료 체크 시 정렬, 삭제 후 빈자리 메우기 등).
 * 화면 밖에서만 움직이는 항목은 보이지 않으므로 애니메이션을 만들지 않는다.
 */
function playMoveAnimations(previousPositions) {
  if (previousPositions.size === 0) return;
  const viewportHeight = window.innerHeight;

  for (const li of listEl.children) {
    const previousTop = previousPositions.get(li.dataset.id);
    if (previousTop === undefined) continue;

    const { top, height } = li.getBoundingClientRect();
    const delta = previousTop - top;
    if (delta === 0) continue;

    const wasVisible = previousTop < viewportHeight && previousTop + height > 0;
    const isVisible = top < viewportHeight && top + height > 0;
    if (!wasVisible && !isVisible) continue;

    li.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
      { duration: 300, easing: 'ease' },
    );
  }
}

/**
 * 현재 상태에 맞게 화면 전체를 갱신한다.
 * 목록은 캐시된 <li>를 재사용하고, 필요한 노드만 추가·제거·이동한다.
 */
function render() {
  const previousPositions = capturePositions();
  // 목록 안에 있던 포커스는 <li>가 옮겨지면 풀리므로 기억해 두었다가 복원한다
  const activeBefore = listEl.contains(document.activeElement) ? document.activeElement : null;

  renderFilters();
  renderDashboard();

  // 1) 보여야 할 항목의 <li>를 순서대로 준비 (재사용 또는 생성)
  const visible = getVisibleTodos();
  const visibleIds = new Set();
  const ordered = [];
  for (const todo of visible) {
    visibleIds.add(todo.id);
    ordered.push(getItemElement(todo));
  }

  // 2) 더 이상 보이지 않는 항목은 캐시와 DOM에서 제거
  for (const id of itemViews.keys()) {
    if (!visibleIds.has(id)) itemViews.delete(id);
  }
  const wanted = new Set(ordered);
  for (const child of [...listEl.children]) {
    if (!wanted.has(child)) child.remove();
  }

  // 3) 순서 맞추기: 이미 제자리에 있는 노드는 건드리지 않는다
  let cursor = listEl.firstElementChild;
  for (const li of ordered) {
    if (li === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      listEl.insertBefore(li, cursor);
    }
  }

  updateEmptyMessage();
  playMoveAnimations(previousPositions);
  enteringIds.clear();

  // 4) 포커스 관리
  if (editingId !== null) {
    const view = itemViews.get(editingId);
    if (!view?.editInput) {
      // 수정 대상이 현재 목록에 없으면 수정 모드 해제
      editingId = null;
    } else if (!view.li.contains(document.activeElement)) {
      view.editInput.focus();
      view.editInput.select();
    }
  } else if (focusAfterRender) {
    itemViews.get(focusAfterRender.id)?.li.querySelector(focusAfterRender.selector)?.focus();
  } else if (activeBefore?.isConnected && document.activeElement !== activeBefore) {
    activeBefore.focus({ preventScroll: true });
  }
  focusAfterRender = null;
}

/** 전체 렌더 없이 "n분 전" 표시와 대시보드(자정이 지나면 '오늘 추가' 변경)만 갱신한다. */
function refreshTimes() {
  for (const view of itemViews.values()) {
    if (view.time) view.time.textContent = formatRelativeTime(view.time.dateTime);
  }
  renderDashboard();
}

/* ==========================================================================
 * 이벤트 등록
 * ========================================================================== */

/* ----- 추가 ----- */

addBtn.addEventListener('click', addTodo);

inputEl.addEventListener('keydown', (event) => {
  // 한글 조합 중 Enter는 무시 (마지막 글자 중복 입력 방지)
  if (event.key === 'Enter' && !event.isComposing) {
    addTodo();
  }
});

// 입력하는 동안 자동 분류 결과를 카테고리 선택 박스에 미리 보여 준다
inputEl.addEventListener('input', updateAutoCategoryHint);

/* ----- 필터 / 검색 / 정렬 ----- */

filterBarEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.filter-btn');
  if (btn) setFilter(btn.dataset.filter);
});

// 검색은 디바운스: 빠르게 타이핑하는 동안에는 목록을 다시 그리지 않는다
const applySearch = debounce(() => {
  finishEdit(true);
  searchQuery = searchEl.value.trim().toLowerCase();
  render();
  announceVisibleCount();
}, SEARCH_DEBOUNCE_MS);

searchEl.addEventListener('input', applySearch);

sortEl.addEventListener('change', () => setSort(sortEl.value));

/* ----- 목록: 이벤트 위임으로 토글/삭제/수정 처리 ----- */

listEl.addEventListener('click', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;

  if (event.target.closest('.delete-btn')) {
    deleteTodo(item.dataset.id);
  } else if (event.target.closest('.edit-btn')) {
    startEdit(item.dataset.id);
  }
});

listEl.addEventListener('change', (event) => {
  if (!event.target.classList.contains('todo-checkbox')) return;
  const item = event.target.closest('.todo-item');
  if (item) toggleTodo(item.dataset.id);
});

listEl.addEventListener('dblclick', (event) => {
  if (!event.target.closest('.todo-text')) return;
  const item = event.target.closest('.todo-item');
  if (item) startEdit(item.dataset.id);
});

listEl.addEventListener('keydown', (event) => {
  // 수정 중: Enter 저장, Esc 취소. 끝나면 해당 항목의 수정 버튼으로 포커스를 돌려준다.
  if (event.target.closest('.todo-edit')) {
    const isSave = event.key === 'Enter' && !event.isComposing;
    if (!isSave && event.key !== 'Escape') return;

    event.preventDefault();
    const id = editingId;
    finishEdit(isSave);
    focusAfterRender = { id, selector: '.edit-btn' };
    render();
    return;
  }

  // 순서 변경 핸들: ↑/↓로 한 칸씩 이동
  if (
    event.target.closest('.drag-handle') &&
    (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
    !event.altKey && !event.ctrlKey && !event.metaKey
  ) {
    event.preventDefault();
    const item = event.target.closest('.todo-item');
    if (item) moveByKeyboard(item.dataset.id, event.key === 'ArrowUp' ? -1 : 1);
  }
});

// 수정 영역 밖으로 포커스가 나가면 저장 (입력창 ↔ 카테고리 select 이동은 제외)
listEl.addEventListener('focusout', (event) => {
  if (editingId === null) return;
  const edit = event.target.closest('.todo-edit');
  if (!edit || edit.contains(event.relatedTarget)) return;

  finishEdit(true);
  render();
});

// 수정 중인 항목의 체크박스/삭제 버튼을 누를 때, focusout으로 그 <li>가 먼저 다시 만들어져
// 클릭이 유실되는 것을 방지한다 (클릭 핸들러가 수정 내용을 저장한 뒤 처리한다)
listEl.addEventListener('mousedown', (event) => {
  if (editingId !== null && event.target.closest('.delete-btn, .todo-checkbox')) {
    event.preventDefault();
  }
});

/* ----- 드래그 앤 드롭 (포인터 이벤트: 마우스·터치·펜 공통) ----- */

listEl.addEventListener('pointerdown', startDrag);
listEl.addEventListener('pointermove', moveDrag);
listEl.addEventListener('pointerup', (event) => endDrag(event, true));
listEl.addEventListener('pointercancel', (event) => endDrag(event, false));

/* ----- 일괄 삭제 / 내보내기 / 가져오기 ----- */

clearCompletedBtn.addEventListener('click', clearCompleted);

exportBtn.addEventListener('click', () => {
  if (todos.length === 0) {
    showToast('내보낼 할 일이 없습니다.');
    return;
  }
  saveTodos.flush();
  if (exportTodos()) showToast(`${todos.length}개를 JSON 파일로 내보냈습니다.`);
});

importBtn.addEventListener('click', () => importFileEl.click());

importFileEl.addEventListener('change', () => {
  const file = importFileEl.files?.[0];
  // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 값을 비운다
  importFileEl.value = '';
  if (file) importTodos(file);
});

/* ----- 테마 / 토스트 ----- */

themeToggleEl.addEventListener('click', toggleTheme);

toastActionEl.addEventListener('click', () => {
  const action = toastAction;
  hideToast();
  action?.();
});

/* ----- 키보드 단축키 ----- */

document.addEventListener('keydown', (event) => {
  // 다이얼로그가 열려 있는 동안에는 단축키를 처리하지 않는다
  if (importDialogEl.open) return;

  // Ctrl+Z (macOS는 Cmd+Z): 최근 삭제 복구.
  // 텍스트를 입력 중일 때는 브라우저의 입력 되돌리기를 방해하지 않는다.
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === 'KeyZ') {
    if (event.target.closest?.('input, textarea, select')) return;
    if (lastDeleted) {
      event.preventDefault();
      undoDelete();
    }
    return;
  }

  // Alt+N(새 할 일), Alt+1~4(필터), Alt+D(다크 모드)
  // event.code를 사용해 한글 입력 상태에서도 동작하게 한다.
  // (AltGr은 Ctrl+Alt로 전달되므로 ctrlKey 검사로 제외된다)
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

  if (event.code === 'KeyN') {
    event.preventDefault();
    inputEl.focus();
  } else if (event.code === 'KeyD') {
    event.preventDefault();
    toggleTheme();
  } else if (Object.hasOwn(SHORTCUT_FILTERS, event.code)) {
    event.preventDefault();
    const filter = SHORTCUT_FILTERS[event.code];
    setFilter(filter);
    showToast(`필터: ${FILTER_LABELS[filter]}`);
  }
});

/* ----- 저장 보장 / 탭 간 동기화 / 주기적 갱신 ----- */

// 디바운스로 미뤄 둔 저장을 페이지를 떠나기 전에 반드시 기록한다
window.addEventListener('pagehide', saveTodos.flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveTodos.flush();
});

// 다른 탭에서 할 일이 바뀌면 이 탭에도 반영한다
// (반영하지 않으면 이 탭의 오래된 목록이 나중에 새 데이터를 덮어쓴다)
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || editingId !== null || drag) return;
  saveTodos.cancel();
  todos = loadTodos();
  lastDeleted = null;
  render();
});

setInterval(refreshTimes, 60000);

/* ==========================================================================
 * 초기화
 * ========================================================================== */

applyTheme();
sortEl.value = sortMode;
showRandomQuote();
render();
