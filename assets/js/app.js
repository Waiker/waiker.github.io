/* CONFIG */
const API_URL = 'https://cp.wtfbjj.ru/api/public.php?token=603B591160C537C6D962926C3A9AB2DF';
const USER_API_BASE = 'https://cp.wtfbjj.ru/miniapp/api';

/* STATE + localStorage keys */
const KEY_BOOKMARKS = 'bookmarkedCourses';
const KEY_WATCHED = 'watchedCourses';
const KEY_BM_META = 'bookmarksMetaCourses';
const KEY_PROFILE = 'userProfile';

const CLUB_MAX_LENGTH = 100;
const CLUB_ALLOWED_REGEX = /[^\p{L}\p{N}\s\-'().,]/gu;

function sanitizeClub(value) {
  let s = String(value || '').trim();
  s = s.replace(CLUB_ALLOWED_REGEX, '').replace(/\s+/g, ' ').trim();
  return s.slice(0, CLUB_MAX_LENGTH);
}

const MARK_COOLDOWN_MS = 2500;
let lastMarkAt = 0;
let profileEditMode = false; /* true = показывать форму редактирования пояса/категории */

let STATE = {
  courses: [],
  categories: [],
  activeCategory: null,
  query: '',
  catalogFilter: 'all', /* 'all' | 'bookmarks' | 'watched' */
  bookmarks: loadJSON(KEY_BOOKMARKS, []),
  watched: loadJSON(KEY_WATCHED, []),
  bmMeta: loadJSON(KEY_BM_META, {}),
  profile: loadJSON(KEY_PROFILE, { belt: '', division: '', club: '', status: '' }),
  userProgress: null,
  userRating: 0,
  leaderboard: null
};

/* helpers */
function $(sel){ return document.querySelector(sel) }
function getTelegramUser(){
  try {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return { photoUrl: null, displayName: 'Гость' };
    const name = user.username ? '@' + user.username : [user.first_name, user.last_name].filter(Boolean).join(' ');
    return { photoUrl: user.photo_url || null, displayName: name || 'Гость' };
  } catch (e) { return { photoUrl: null, displayName: 'Гость' }; }
}
function getInitData(){ return (window.Telegram?.WebApp?.initData || ''); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)) }
function loadJSON(k,d){ try{ const t=localStorage.getItem(k); return t?JSON.parse(t):d; }catch(e){ return d; } }
function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function showToast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); t.style.opacity=1; setTimeout(()=>{ t.style.opacity=0; },1500); }

/* ---------- Data loading ---------- */
async function loadData(){
  try{
    const res = await fetch(API_URL + '&_=' + Date.now());
    if(!res.ok) throw new Error('API error '+res.status);
    const data = await res.json();
    // normalize
    STATE.categories = (data.categories || []).map(c=>({ id:String(c.id), name:c.name }));
    STATE.courses = (data.courses || []).map(c=>({
      id:String(c.id),
      name:c.name || '',
      url:c.url || '',
      description:c.description || '',
      category_ids: (c.category_ids || []).map(String),
      categories: (c.categories || []),
      xp: (c.xp != null && c.xp !== '') ? parseInt(c.xp, 10) : 100
    }));
    await userInit();
    renderAll();
  }catch(e){
    console.error('loadData err',e);
    // fallback demo data
    loadMockData();
  }
}
function loadMockData(){
  STATE.categories = [{id:'1',name:'Леглоки'},{id:'2',name:'Пас гард'},{id:'3',name:'Баттерфляй'},{id:'4',name:'Армбар'}];
  STATE.courses = [];
  for(let i=1;i<=12;i++){
    STATE.courses.push({
      id:String(100+i),
      name:`Курс ${i} — ${STATE.categories[(i-1)%STATE.categories.length].name}`,
      url:`https://t.me/example/${100+i}`,
      description:`Описание курса ${i}`,
      category_ids:[String(((i-1)%STATE.categories.length)+1)],
      categories:[STATE.categories[(i-1)%STATE.categories.length].name],
      xp: 100
    });
  }
  userInit().then(()=> renderAll());
}

async function userInit(){
  // #region agent log
  const _authUrl = USER_API_BASE + '/auth.php';
  fetch('http://127.0.0.1:7242/ingest/4162b94a-fd1c-4a8f-ad75-a9068f963cec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:userInit',message:'userInit called',data:{USER_API_BASE, authUrl: _authUrl, hasTelegram: !!window.Telegram, hasWebApp: !!window.Telegram?.WebApp},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const initData = getInitData();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4162b94a-fd1c-4a8f-ad75-a9068f963cec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:userInit',message:'initData check',data:{initDataLength: (initData && initData.length) || 0, willSkip: !initData},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (!initData) return;
  try {
    const res = await fetch(_authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData })
    });
    // #region agent log
    const _resText = await res.text();
    fetch('http://127.0.0.1:7242/ingest/4162b94a-fd1c-4a8f-ad75-a9068f963cec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:userInit',message:'auth response',data:{status: res.status, ok: res.ok, bodyLength: _resText.length, bodyPreview: _resText.slice(0, 200)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!res.ok) return;
    const data = (function(){ try { return JSON.parse(_resText); } catch(e) { return null; } })();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4162b94a-fd1c-4a8f-ad75-a9068f963cec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:userInit',message:'parsed response',data:{hasUser: !!(data && data.user), hasError: !!(data && data.error), errorMsg: data && data.error},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (data.user && data.user.bio) {
      STATE.profile.belt = data.user.bio.belt || '';
      STATE.profile.division = data.user.bio.division || '';
      STATE.profile.club = data.user.bio.club || '';
    }
    if (data.user && data.user.rating != null) STATE.userRating = parseInt(data.user.rating, 10) || 0;
    if (Array.isArray(data.watched_course_ids)) STATE.watched = data.watched_course_ids;
    if (data.progress) STATE.userProgress = data.progress;
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4162b94a-fd1c-4a8f-ad75-a9068f963cec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:userInit',message:'userInit catch',data:{errName: e && e.name, errMessage: e && e.message},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.warn('userInit failed', e);
  }
}

/* ---------- Autocomplete index & suggestions (search) ---------- */
let autocompleteIndex = []; // {type:'course'|'category', value, ref}
function buildAutocompleteIndex(){
  autocompleteIndex = [];
  STATE.courses.forEach(c=> autocompleteIndex.push({ type:'course', value:c.name.toLowerCase(), ref:c }));
  STATE.categories.forEach(cat=> autocompleteIndex.push({ type:'category', value:cat.name.toLowerCase(), ref:cat }));
}

/* suggestions UI */
function renderSuggestions(q){
  const box = $('#suggestBox');
  box.innerHTML = '';
  if(!q || q.trim().length<1){ box.style.display='none'; return; }
  
  const s = q.trim().toLowerCase();
  const results = autocompleteIndex.filter(i => i.value.includes(s)).slice(0,12);
  if(results.length===0){ box.style.display='none'; return; }
  results.forEach(r=>{
    const el = document.createElement('div');
    el.className = 'item';
    if(r.type==='course'){
      el.innerHTML = `<strong>${escapeHtml(r.ref.name)}</strong> <span style="color:#888;display:block;font-size:13px">${escapeHtml(r.ref.description || r.ref.url)}</span>`;
      el.onclick = ()=>{ window.open(r.ref.url,'_blank'); box.style.display='none'; $('#searchInput').value=''; STATE.query=''; renderCatalog(); };
    } else {
      // el.innerHTML = `<span>#${escapeHtml(r.ref.name)}</span><span class="type-cat">категория</span>`;
      // el.onclick = ()=>{ STATE.activeCategory = String(r.ref.id); $('#searchInput').value = ''; box.style.display='none'; renderCategories(); renderCatalog(); };
      el.innerHTML = `<span>#${escapeHtml(r.ref.name)}</span><span class="type-cat">категория</span>`;
      el.onclick = () => {
        // Подставляем имя категории в поле поиска — пользователь видит активный фильтр
        $('#searchInput').value = r.ref.name;
        // Обновляем состояние (query нужен для фильтрации по тексту, activeCategory для чипов)
        STATE.query = String(r.ref.name);
        STATE.activeCategory = String(r.ref.id);
        // Скрываем подсказки, обновляем визуалку
        box.style.display = 'none';
        renderCategories();
        renderCatalog();
        // фокус обратно в поле поиска — удобно для быстрого снятия фильтра
        // $('#searchInput').focus();
        $('#searchInput').blur();
      };
    }
    box.appendChild(el);
  });
  box.style.display='block';
}

function renderCatalog(){
  const list = filterCourses();
  const coursesWrap = $('#courses');
  coursesWrap.innerHTML = '';
  $('#countInfo').textContent = `${list.length} курса(ов)`;
  const sort = $('#sortSelect') ? $('#sortSelect').value : 'name_asc';
  const sortVal = sort || 'name_asc';
  list.sort((a,b)=>{
    if(sortVal==='name_asc') return a.name.localeCompare(b.name,'ru');
    if(sortVal==='name_desc') return b.name.localeCompare(a.name,'ru');
    if (STATE.catalogFilter === 'bookmarks' && (sortVal === 'added_desc' || sortVal === 'added_asc')) {
      const ta = STATE.bmMeta[a.url]?.addedAt || 0;
      const tb = STATE.bmMeta[b.url]?.addedAt || 0;
      return sortVal === 'added_desc' ? tb - ta : ta - tb;
    }
    if(sortVal==='added_desc') return (b.id || 0) - (a.id || 0);
    if(sortVal==='added_asc') return (a.id || 0) - (b.id || 0);
    return 0;
  });

  list.forEach(c=>{
    const card = document.createElement('div'); card.className='course-card';
    const left = document.createElement('div'); left.className='course-left';
    const title = document.createElement('div'); title.className='course-title'; title.textContent=c.name;
    const tags = document.createElement('div'); tags.className='course-tags';

    (c.categories||[]).forEach(t => {
      const tEl = document.createElement('div'); tEl.className='tag'; tEl.textContent = t;
      // click on tag: prevent card click, set search input to category name and apply filter
      tEl.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const cat = STATE.categories.find(x=>x.name===t);
        if(cat){
          STATE.activeCategory = cat.id;
          $('#searchInput').value = cat.name;
          STATE.query = cat.name;
          $('#suggestBox').style.display='none';
          renderCategoryChips();
          renderCatalog();
          $('#searchInput').focus();
        }
      });
      tags.appendChild(tEl);
    });

    left.appendChild(title); left.appendChild(tags);

    const actions = document.createElement('div'); actions.className='course-actions';
    actions.style.flexDirection = 'row';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '12px';

    const bk = document.createElement('button'); bk.className='btn-icon'; bk.innerHTML = STATE.bookmarks.includes(c.url) ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    if(STATE.bookmarks.includes(c.url)) bk.classList.add('bookmarked');
    bk.addEventListener('click',(ev)=>{ ev.stopPropagation(); toggleBookmark(c); });

    const cbBtn = document.createElement('button'); cbBtn.className='btn-icon';
    const isWatched = STATE.watched.includes(c.id) || STATE.watched.includes(c.url);
    cbBtn.innerHTML = isWatched ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-regular fa-eye"></i>';
    if (isWatched) cbBtn.classList.add('bookmarked');
    cbBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); toggleWatched(c); });

    // const delBtn = document.createElement('button'); delBtn.className='btn-icon';
    // delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    // delBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); removeCourse(c); });

    card.addEventListener('click', ()=>{ window.open(c.url,'_blank') });

    actions.appendChild(bk);
    actions.appendChild(cbBtn);
    // actions.appendChild(delBtn);

    card.appendChild(left); card.appendChild(actions);
    coursesWrap.appendChild(card);
  })
}

function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* ---------- Rendering ---------- */
function renderAll(){
  buildAutocompleteIndex();
  renderCategoryChips();
  renderCatalogQuickFilters();
  renderCatalog();
  renderProfile();
}

function renderCategoryChips(){
  const mount = $('#categories');
  mount.innerHTML = '';
  const visibleCats = STATE.categories;
  visibleCats.forEach(cat=>{
    const el = document.createElement('button');
    el.className = 'category-chip' + (STATE.activeCategory===cat.id ? ' active' : '');
    el.textContent = '#'+cat.name;
    el.onclick = ()=>{ STATE.activeCategory = STATE.activeCategory===cat.id? null: cat.id; renderCategoryChips(); renderCatalog(); };
    mount.appendChild(el);
  });
}

/* filtering logic (search + category + catalog quick filter) */
function filterCourses(){
  const q = (STATE.query || '').trim().toLowerCase();
  let list = STATE.courses.filter(c=>{
    // name or category names match
    const nameOk = (c.name||'').toLowerCase().includes(q);
    const catText = (c.categories||[]).join(' ').toLowerCase();
    const catOk = catText.includes(q);
    if(q && !(nameOk || catOk)) return false;
    if(STATE.activeCategory && !(c.category_ids||[]).includes(STATE.activeCategory)) return false;
    return true;
  });
  if (STATE.catalogFilter === 'bookmarks') list = list.filter(c => STATE.bookmarks.includes(c.url));
  if (STATE.catalogFilter === 'watched') list = list.filter(c => isCourseWatched(c));
  return list;
}


/* bookmarks */
function toggleBookmark(course){
  const now = Date.now();
  if (now - lastMarkAt < MARK_COOLDOWN_MS) {
    const sec = Math.ceil((MARK_COOLDOWN_MS - (now - lastMarkAt)) / 1000);
    showToast('Подождите ' + sec + ' сек');
    return;
  }
  const i = STATE.bookmarks.indexOf(course.url);
  if(i>=0){ STATE.bookmarks.splice(i,1); delete STATE.bmMeta[course.url]; saveJSON(KEY_BOOKMARKS, STATE.bookmarks); saveJSON(KEY_BM_META, STATE.bmMeta); showToast('Удалено из закладок'); }
  else { STATE.bookmarks.push(course.url); STATE.bmMeta[course.url] = { addedAt: Date.now(), name: course.name }; saveJSON(KEY_BOOKMARKS, STATE.bookmarks); saveJSON(KEY_BM_META, STATE.bmMeta); showToast('Добавлено в закладки'); }
  lastMarkAt = Date.now();
  renderCatalog(); renderProfile();
}

function renderCatalogQuickFilters(){
  const wrap = $('#catalogQuickFilters');
  if (!wrap) return;
  Array.from(wrap.querySelectorAll('.catalog-filter-chip')).forEach(el => {
    const filter = el.getAttribute('data-filter');
    if (!filter) return;
    el.classList.toggle('active', STATE.catalogFilter === filter);
  });
  if (!wrap.dataset.bound) {
    wrap.dataset.bound = '1';
    wrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.catalog-filter-chip');
      if (!chip) return;
      const filter = chip.getAttribute('data-filter');
      if (filter && (filter === 'all' || filter === 'bookmarks' || filter === 'watched')) {
        STATE.catalogFilter = filter;
        renderCatalogQuickFilters();
        renderCatalog();
      }
    });
  }
}

/* watched */
function isCourseWatched(c){ return STATE.watched.includes(c.id) || STATE.watched.includes(c.url); }
async function toggleWatched(course){
  const now = Date.now();
  if (now - lastMarkAt < MARK_COOLDOWN_MS) {
    const sec = Math.ceil((MARK_COOLDOWN_MS - (now - lastMarkAt)) / 1000);
    showToast('Подождите ' + sec + ' сек');
    return;
  }
  const watched = isCourseWatched(course);
  if (watched) {
    const i = STATE.watched.indexOf(course.id) >= 0 ? STATE.watched.indexOf(course.id) : STATE.watched.indexOf(course.url);
    STATE.watched.splice(i, 1);
    saveJSON(KEY_WATCHED, STATE.watched);
    showToast('Отмечено как непросмотренное');
    lastMarkAt = Date.now();
    renderCatalog(); renderProfile();
    return;
  }
  const initData = getInitData();
  if (initData) {
    try {
      const res = await fetch(USER_API_BASE + '/progress.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initData, course_id: course.id, xp: course.xp != null ? course.xp : 100 })
      });
      const data = await res.json();
      if (res.ok && data.progress) {
        STATE.watched.push(course.id);
        STATE.userProgress = data.progress;
        showToast('Отмечено как просмотрено');
      } else if (res.status === 409) {
        STATE.watched.push(course.id);
        if (data.progress) STATE.userProgress = data.progress;
        showToast('Уже отмечено как просмотрено');
      } else { showToast('Ошибка сохранения'); return; }
    } catch (e) { showToast('Ошибка сети'); return; }
  } else {
    STATE.watched.push(course.url);
    saveJSON(KEY_WATCHED, STATE.watched);
    showToast('Отмечено как просмотрено');
  }
  lastMarkAt = Date.now();
  renderCatalog(); renderProfile();
}

/* profile: helpers for belt config */
function getBeltsConfig(){
  const raw = (typeof PROFILE_CONFIG !== 'undefined' && PROFILE_CONFIG.beltColors) ? PROFILE_CONFIG.beltColors : [];
  return raw.map(b => typeof b === 'string' ? { id: b, label: b, icon: '' } : b);
}
function getBeltConfigByValue(val){
  if (!val) return null;
  const belts = getBeltsConfig();
  return belts.find(b => b.id === val || b.label === val) || null;
}

/* leaderboard */
async function fetchLeaderboard(){
  const initData = getInitData();
  const headers = { };
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const res = await fetch(USER_API_BASE + '/leaderboard.php', { method: 'GET', headers });
  if (!res.ok) {
    STATE.leaderboard = { top: [], me: null };
    return;
  }
  const data = await res.json().catch(() => ({}));
  STATE.leaderboard = {
    top: Array.isArray(data.top) ? data.top : [],
    me: data.me != null ? data.me : null
  };
}

function renderLeaderboard(){
  const listEl = $('#leaderboardList');
  const meBlockEl = $('#leaderboardMeBlock');
  if (!listEl) return;

  if (!STATE.leaderboard) {
    listEl.innerHTML = '<p class="leaderboard-loading">Загрузка...</p>';
    if (meBlockEl) meBlockEl.style.display = 'none';
    return;
  }

  const { top, me } = STATE.leaderboard;
  const belts = getBeltsConfig();

  listEl.innerHTML = '';
  if (top.length === 0) {
    listEl.innerHTML = '<p class="leaderboard-empty">Пока никого нет в рейтинге.</p>';
  } else {
    top.forEach(row => {
      const beltCfg = row.belt_id ? getBeltConfigByValue(row.belt_id) : null;
      const rowEl = document.createElement('div');
      rowEl.className = 'leaderboard-row' + (row.is_me ? ' leaderboard-row--me' : '');
      const beltImg = beltCfg && beltCfg.icon
        ? `<img class="leaderboard-belt-icon" src="${escapeHtml(beltCfg.icon)}" alt="" />`
        : '<span class="leaderboard-belt-placeholder">—</span>';
      rowEl.innerHTML =
        `<span class="leaderboard-rank">${row.rank}</span>` +
        `<span class="leaderboard-username">${escapeHtml(row.username)}</span>` +
        `<span class="leaderboard-rating">${row.rating}</span>` +
        `<span class="leaderboard-level">${row.level}</span>` +
        `<span class="leaderboard-belt">${beltImg}</span>`;
      listEl.appendChild(rowEl);
    });
  }

  if (meBlockEl) {
    if (me && me.rank != null && !me.in_top) {
      meBlockEl.textContent = 'Ваша позиция в общем рейтинге: ' + me.rank;
      meBlockEl.style.display = 'block';
    } else if (me && me.rank != null && me.in_top) {
      meBlockEl.textContent = 'Ваша позиция: ' + me.rank;
      meBlockEl.style.display = 'block';
    } else {
      meBlockEl.style.display = 'none';
    }
  }
}

/* profile */
function renderProfile(){
  const avatarEl = $('#profileAvatar');
  const nameEl = $('#profileName');
  const progressFill = $('#profileProgressFill');
  const bookmarksCount = $('#profileBookmarksCount');
  const achievementsEl = $('#profileAchievements');
  const badgesEl = $('#profileBadges');
  const beltFormWrap = $('#profileBeltFormWrap');
  const beltFormEl = $('#profileBeltForm');
  const clubInputEl = $('#profileClubInput');
  const beltPickerEl = $('#profileBeltPicker');
  const divisionPickerEl = $('#profileDivisionPicker');
  const editIconBtn = $('#profileEditBtn');

  if (!avatarEl || !nameEl) return;

  const user = getTelegramUser();
  avatarEl.innerHTML = '';
  avatarEl.style.backgroundImage = '';
  if (user.photoUrl) {
    avatarEl.style.backgroundImage = 'url(' + user.photoUrl + ')';
  } else {
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-user';
    avatarEl.appendChild(icon);
  }
  nameEl.textContent = user.displayName;

  const watched = STATE.watched.length;
  const total = STATE.courses.length;
  const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
  if (progressFill) progressFill.style.width = pct + '%';
  if (bookmarksCount) bookmarksCount.textContent = STATE.bookmarks.length;

  const ratingEl = $('#profileRating');
  const ratingFillEl = $('#profileRatingFill');
  const rating = STATE.userRating || 0;
  if (ratingEl) ratingEl.textContent = rating;
  if (ratingFillEl) {
    const ratingMax = 200;
    ratingFillEl.style.width = Math.min(100, (rating / ratingMax) * 100) + '%';
  }

  const levelBlock = $('#profileLevelBlock');
  const levelText = $('#profileLevelText');
  if (STATE.userProgress && levelBlock && levelText) {
    levelBlock.style.display = 'flex';
    levelText.textContent = 'Уровень ' + STATE.userProgress.level;
  } else if (levelBlock) levelBlock.style.display = 'none';

  /* achievements */
  const achievementsList = (typeof PROFILE_CONFIG !== 'undefined' && PROFILE_CONFIG.achievements) ? PROFILE_CONFIG.achievements : [];
  const unlocked = achievementsList
    .filter(a => watched >= (a.minWatched || 0))
    .sort((a, b) => (a.minWatched || 0) - (b.minWatched || 0));
  if (achievementsEl) {
    achievementsEl.innerHTML = '';
    unlocked.forEach(a => {
      const b = document.createElement('span');
      b.className = 'profile-achievement';
      b.innerHTML = '<i class="fa-solid ' + (a.icon || 'fa-star') + '"></i> ' + escapeHtml(a.label || '');
      achievementsEl.appendChild(b);
    });
  }

  /* belt, division, club (миграция: club может отсутствовать, санитизация при чтении) */
  const club = sanitizeClub(STATE.profile.club);
  const hasBeltAndDivision = !!(STATE.profile.belt && STATE.profile.division);
  const divisions = (typeof PROFILE_CONFIG !== 'undefined' && PROFILE_CONFIG.divisions) ? PROFILE_CONFIG.divisions : [];

  /* badges in hero: belt icons (progression), division, club */
  if (badgesEl) {
    badgesEl.innerHTML = '';
    if (hasBeltAndDivision) {
      const belts = getBeltsConfig();
      const idx = belts.findIndex(b => b.id === STATE.profile.belt || b.label === STATE.profile.belt);
      const beltsToShow = idx >= 0 ? [belts[idx]] : [];
      beltsToShow.forEach(b => {
        const wrap = document.createElement('span');
        wrap.className = 'profile-belt-icon-wrap';
        if (b.icon) {
          const img = document.createElement('img');
          img.src = b.icon;
          img.alt = b.label;
          img.className = 'profile-hero-badge-icon';
          img.onerror = () => { img.style.display = 'none'; };
          wrap.appendChild(img);
        } else {
          const span = document.createElement('span');
          span.className = 'profile-hero-badge';
          span.textContent = b.label;
          wrap.appendChild(span);
        }
        badgesEl.appendChild(wrap);
      });
      const divCfg = divisions.find(d => d.id === STATE.profile.division);
      if (divCfg) {
        const divBadge = document.createElement('span');
        divBadge.className = 'profile-hero-badge';
        divBadge.textContent = divCfg.label;
        badgesEl.appendChild(divBadge);
      }
      if (club) {
        const clubBadge = document.createElement('span');
        clubBadge.className = 'profile-hero-badge profile-hero-badge--club';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-building';
        clubBadge.appendChild(icon);
        clubBadge.appendChild(document.createTextNode(' ' + club));
        badgesEl.appendChild(clubBadge);
      }
    }
  }

  /* hero background from selected belt color + firework particles */
  const heroEl = document.querySelector('.profile-hero');
  if (heroEl) {
    const belts = getBeltsConfig();
    const currentBelt = belts.find(b => b.id === STATE.profile.belt || b.label === STATE.profile.belt);
    heroEl.style.setProperty('--belt-color', currentBelt && currentBelt.color ? currentBelt.color : '#1e3a5f');
    heroEl.style.setProperty('--belt-color-light', currentBelt && (currentBelt.colorLight || currentBelt.color) ? (currentBelt.colorLight || currentBelt.color) : '#2d5a87');

    const fireworkEl = heroEl.querySelector('.profile-hero-firework');
    if (fireworkEl) {
      fireworkEl.innerHTML = '';
      if (currentBelt && currentBelt.icon) {
        const count = 24;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * 2 * Math.PI + Math.random() * 0.4;
          const radius = 50 + Math.random() * 70;
          const tx = Math.cos(angle) * radius;
          const ty = Math.sin(angle) * radius;
          const delay = Math.random() * 0.4;
          const img = document.createElement('img');
          img.src = currentBelt.icon;
          img.alt = '';
          img.className = 'profile-hero-firework-particle';
          img.style.setProperty('--tx', tx + 'px');
          img.style.setProperty('--ty', ty + 'px');
          img.style.setProperty('--delay', delay + 's');
          fireworkEl.appendChild(img);
        }
      }
    }
  }

  /* belt form: show when editing or when belt+division not set */
  const showBeltForm = !hasBeltAndDivision || profileEditMode;
  if (beltFormWrap) beltFormWrap.style.display = showBeltForm ? 'block' : 'none';
  if (beltFormEl && showBeltForm) {
    /* club input value */
    if (clubInputEl) clubInputEl.value = club;

    /* belt picker */
      if (beltPickerEl) {
        beltPickerEl.innerHTML = '';
        const belts = getBeltsConfig();
        belts.forEach(b => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'profile-belt-option' + (STATE.profile.belt === b.id || STATE.profile.belt === b.label ? ' active' : '');
          btn.dataset.beltId = b.id;
          btn.dataset.beltLabel = b.label;
          if (b.icon) {
            const img = document.createElement('img');
            img.src = b.icon;
            img.alt = b.label;
            img.className = 'profile-belt-option-icon';
            img.onerror = () => { img.style.display = 'none'; };
            btn.appendChild(img);
          }
          const span = document.createElement('span');
          span.className = 'profile-belt-option-label';
          span.textContent = b.label;
          btn.appendChild(span);
          beltPickerEl.appendChild(btn);
        });
      }

    /* division picker */
    if (divisionPickerEl) {
      divisionPickerEl.innerHTML = '';
      divisions.forEach(d => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profile-division-btn' + (STATE.profile.division === d.id ? ' active' : '');
        btn.dataset.division = d.id;
        btn.textContent = d.label;
        divisionPickerEl.appendChild(btn);
      });
    }
  }

  /* show/hide cancel button (only in edit mode) */
  const cancelBtn = $('#profileCancelBeltBtn');
  if (cancelBtn) cancelBtn.style.display = profileEditMode ? 'inline-block' : 'none';

  /* bind events (once) */
  const saveBtn = $('#profileSaveBeltBtn');
  if (editIconBtn && !editIconBtn.dataset.bound) {
    editIconBtn.dataset.bound = '1';
    editIconBtn.addEventListener('click', () => {
      profileEditMode = !profileEditMode;
      renderProfile();
    });
  }
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', () => {
      profileEditMode = false;
      renderProfile();
    });
  }
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', async () => {
      const selBelt = beltPickerEl && beltPickerEl.querySelector('.profile-belt-option.active');
      const selDiv = divisionPickerEl && divisionPickerEl.querySelector('.profile-division-btn.active');
      if (!selBelt || !selDiv) {
        showToast('Выберите пояс и раздел');
        return;
      }
      STATE.profile.belt = selBelt.dataset.beltId;
      STATE.profile.division = selDiv.dataset.division;
      STATE.profile.club = clubInputEl ? sanitizeClub(clubInputEl.value) : '';
      const initData = getInitData();
      if (initData) {
        try {
          const res = await fetch(USER_API_BASE + '/profile_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              initData: initData,
              belt: STATE.profile.belt,
              division: STATE.profile.division,
              club: STATE.profile.club
            })
          });
          if (res.ok) { profileEditMode = false; showToast('Сохранено'); renderProfile(); return; }
          const errText = await res.text();
          let errMsg = 'Ошибка сохранения';
          try { const d = JSON.parse(errText); if (d && d.error) errMsg = 'Ошибка: ' + d.error; } catch (_) {}
          if (errMsg === 'Ошибка сохранения') errMsg = 'Ошибка: ' + res.status + (errText ? ' ' + errText.slice(0, 80) : '');
          showToast(errMsg);
        } catch (e) {
          showToast('Ошибка сети: ' + (e && e.message ? e.message : ''));
        }
      } else {
        saveJSON(KEY_PROFILE, STATE.profile);
        profileEditMode = false;
        showToast('Сохранено');
        renderProfile();
      }
    });
  }
  if (beltPickerEl && !beltPickerEl.dataset.bound) {
    beltPickerEl.dataset.bound = '1';
    beltPickerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.profile-belt-option');
      if (!btn) return;
      beltPickerEl.querySelectorAll('.profile-belt-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }
  if (divisionPickerEl && !divisionPickerEl.dataset.bound) {
    divisionPickerEl.dataset.bound = '1';
    divisionPickerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.profile-division-btn');
      if (!btn) return;
      divisionPickerEl.querySelectorAll('.profile-division-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  /* подсказки (?) для рейтинга, просмотров, уровня */
  const hintTexts = {
    rating: '🏆 Рейтинг — показатель вашего статуса среди пользователей, который растёт за активность и поддержку проекта.',
    watched: '📚 Курсов просмотрено — количество курсов, которые вы полностью отметили как просмотренные.',
    level: '⭐ Уровень — отражает ваш общий прогресс и растёт за счёт просмотренных курсов.'
  };
  const popover = $('#profileHintPopover');
  const backdrop = $('#profileHintBackdrop');
  const hintTextEl = $('#profileHintText');
  const closeHint = () => {
    if (popover) { popover.classList.remove('is-visible'); popover.setAttribute('aria-hidden', 'true'); }
    if (backdrop) { backdrop.classList.remove('is-visible'); backdrop.setAttribute('aria-hidden', 'true'); }
  };
  $all('.profile-hint-btn').forEach(btn => {
    if (btn.dataset.hintBound) return;
    btn.dataset.hintBound = '1';
    btn.addEventListener('click', () => {
      const key = btn.dataset.hint;
      if (hintTextEl && key && hintTexts[key]) {
        hintTextEl.textContent = hintTexts[key];
        if (backdrop) { backdrop.classList.add('is-visible'); backdrop.setAttribute('aria-hidden', 'false'); }
        if (popover) { popover.classList.add('is-visible'); popover.setAttribute('aria-hidden', 'false'); }
      }
    });
  });
  const hintCloseBtn = popover && popover.querySelector('.profile-hint-close');
  if (hintCloseBtn && !hintCloseBtn.dataset.bound) {
    hintCloseBtn.dataset.bound = '1';
    hintCloseBtn.addEventListener('click', closeHint);
  }
  if (backdrop && !backdrop.dataset.bound) {
    backdrop.dataset.bound = '1';
    backdrop.addEventListener('click', closeHint);
  }
  if (popover && !popover.dataset.bound) {
    popover.dataset.bound = '1';
    popover.addEventListener('click', (e) => { if (e.target === popover) closeHint(); });
  }
}

/* categories render (search field for categories is now part of main search) */
function renderCategories(){
  const mount = $('#categories');
  mount.innerHTML = '';
  const cats = STATE.categories.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  cats.forEach(c=>{
    const el = document.createElement('button'); el.className='category-chip' + (STATE.activeCategory===c.id ? ' active' : '');
    el.textContent = '#'+c.name;
    el.addEventListener('click', ()=>{
      if(STATE.activeCategory === c.id){
        // turning off filter
        STATE.activeCategory = null;
        $('#searchInput').value = '';
        STATE.query = '';
      } else {
        STATE.activeCategory = c.id;
        // put category name into search field so user sees active filter
        $('#searchInput').value = c.name;
        STATE.query = c.name;
      }
      $('#suggestBox').style.display='none';
      renderCategories();
      renderCatalog();
      $('#searchInput').focus();
    });
    mount.appendChild(el);
  });
}


$('#searchInput').addEventListener('input', (e) => {
  const q = (e.target.value || '').trim();
  // сохраняем запрос в STATE, чтобы другие функции (filterCourses и т.д.) могли его использовать
  STATE.query = q;

  if (q === '') {
    // если поле пустое — сбрасываем категорию и подсказки, ререндерим
    STATE.activeCategory = null;
    $('#suggestBox').style.display = 'none';
    renderCategories(); // обновить визуально чипы категорий
    renderCatalog();    // показать все курсы
    return;
  }

  // иначе показываем подсказки и фильтруем каталог
  renderSuggestions(q);
  renderCatalog();
});
$('#searchInput').addEventListener('keydown', (e)=>{
  if(e.key==='Escape') { $('#searchInput').value=''; STATE.query=''; $('#suggestBox').style.display='none'; renderCatalog(); }
});

/* suggestion click outside close */
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#suggestBox') && !e.target.closest('#searchInput')) $('#suggestBox').style.display='none';
});

/* navigation bottom */
$all('.nav-item').forEach(n=>{
  n.addEventListener('click', async ()=>{
    $all('.nav-item').forEach(x=>x.classList.remove('active'));
    n.classList.add('active');
    const target = n.dataset.target;
    $all('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    if (target === 'page-profile') {
      document.body.classList.add('profile-page-active');
      document.body.classList.remove('leaderboard-page-active');
      renderProfile();
    } else if (target === 'page-leaderboard') {
      document.body.classList.remove('profile-page-active');
      document.body.classList.add('leaderboard-page-active');
      if (!STATE.leaderboard) {
        renderLeaderboard();
        await fetchLeaderboard();
      }
      renderLeaderboard();
    } else {
      document.body.classList.remove('profile-page-active');
      document.body.classList.remove('leaderboard-page-active');
    }
    window.scrollTo(0,0);
  });
});

$('#searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = this.value.trim();
    
    // Сброс состояния
    STATE.query = query;
    STATE.activeCategory = null;
    
    // Скрываем подсказки
    $('#suggestBox').style.display = 'none';
    
    // Обновляем интерфейс
    renderCategories();
    renderCatalog();
    
    // Закрываем клавиатуру
    this.blur();
  }
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('#suggestBox') && !e.target.closest('#searchInput')) {
    $('#suggestBox').style.display = 'none';
    $('#searchInput').blur();
  }
});


/* promo open */
function openPromo(){ window.location.href = 'promo.html'; }

/* init */
window.addEventListener('DOMContentLoaded', ()=>{
  // init UI
  $('#countInfo').textContent = 'Загрузка...';
  loadData();
});

/* small utility: show errors to toast */
function showError(msg){ console.error(msg); showToast(msg); }

// Автопрокрутка
let carousel = document.getElementById("banner-carousel");
let banners = document.querySelectorAll("#banner-carousel .banner");
let index = 0;

function autoSlide() {
  index = (index + 1) % banners.length;
  carousel.scrollTo({
    left: banners[index].offsetLeft,
    behavior: "smooth"
  });
}

setInterval(autoSlide, 5000); // каждые 5 секунд

/* END */
