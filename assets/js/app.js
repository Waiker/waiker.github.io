/* CONFIG */
const API_URL = 'https://cp.wtfbjj.ru/api/public.php?token=603B591160C537C6D962926C3A9AB2DF';

/* STATE + localStorage keys */
const KEY_BOOKMARKS = 'bookmarkedCourses';
const KEY_WATCHED = 'watchedCourses';
const KEY_BM_META = 'bookmarksMetaCourses';

let STATE = {
  courses: [],
  categories: [],
  activeCategory: null,
  query: '',
  bookmarks: loadJSON(KEY_BOOKMARKS, []),
  watched: loadJSON(KEY_WATCHED, []),
  bmMeta: loadJSON(KEY_BM_META, {}) // url -> {addedAt,name}
};

/* helpers */
function $(sel){ return document.querySelector(sel) }
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
      categories: (c.categories || []) // array of names
    }));
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
      categories:[STATE.categories[(i-1)%STATE.categories.length].name]
    });
  }
  renderAll();
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
function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* ---------- Rendering ---------- */
function renderAll(){
  buildAutocompleteIndex();
  renderCategoryChips();
  renderCatalog();
  renderBookmarks();
  renderWatched();
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

/* filtering logic (search + category + watched filter if needed) */
function filterCourses(){
  const q = (STATE.query || '').trim().toLowerCase();
  return STATE.courses.filter(c=>{
    // name or category names match
    const nameOk = (c.name||'').toLowerCase().includes(q);
    const catText = (c.categories||[]).join(' ').toLowerCase();
    const catOk = catText.includes(q);
    if(q && !(nameOk || catOk)) return false;
    if(STATE.activeCategory && !(c.category_ids||[]).includes(STATE.activeCategory)) return false;
    return true;
  });
}

function renderCatalog(){
  const list = filterCourses();
  const coursesWrap = $('#courses');
  coursesWrap.innerHTML = '';
  $('#countInfo').textContent = `${list.length} курса(ов)`;
  // sorting
  const sort = $('#sortSelect').value || 'name_asc';
  list.sort((a,b)=>{
    if(sort==='name_asc') return a.name.localeCompare(b.name,'ru');
    if(sort==='name_desc') return b.name.localeCompare(a.name,'ru');
    if(sort==='added_desc') return b.id - a.id;
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
    const bk = document.createElement('button'); bk.className='btn-icon'; bk.innerHTML = STATE.bookmarks.includes(c.url) ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    if(STATE.bookmarks.includes(c.url)) bk.classList.add('bookmarked');
    bk.addEventListener('click',(ev)=>{ ev.stopPropagation(); toggleBookmark(c); });

    const chkWrap = document.createElement('label'); chkWrap.className='watch-checkbox';
    // prevent label click from propagating to card
    chkWrap.addEventListener('click', ev=>{ ev.stopPropagation(); });

    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = STATE.watched.includes(c.url);
    // prevent click on checkbox from propagating and handle change
    cb.addEventListener('click', ev=>{ ev.stopPropagation(); });
    cb.addEventListener('change', (ev)=>{ ev.stopPropagation(); toggleWatched(c); });
    const cbLabel = document.createElement('span'); cbLabel.textContent='Просмотрено';
    chkWrap.appendChild(cb); chkWrap.appendChild(cbLabel);

    card.addEventListener('click', ()=>{ window.open(c.url,'_blank') });

    actions.appendChild(bk); actions.appendChild(chkWrap);
    card.appendChild(left); card.appendChild(actions);
    coursesWrap.appendChild(card);
  });
}

/* bookmarks */
function toggleBookmark(course){
  const i = STATE.bookmarks.indexOf(course.url);
  if(i>=0){ STATE.bookmarks.splice(i,1); delete STATE.bmMeta[course.url]; saveJSON(KEY_BOOKMARKS, STATE.bookmarks); saveJSON(KEY_BM_META, STATE.bmMeta); showToast('Удалено из закладок'); }
  else { STATE.bookmarks.push(course.url); STATE.bmMeta[course.url] = { addedAt: Date.now(), name: course.name }; saveJSON(KEY_BOOKMARKS, STATE.bookmarks); saveJSON(KEY_BM_META, STATE.bmMeta); showToast('Добавлено в закладки'); }
  renderCatalog(); renderBookmarks();
}
function renderBookmarks(){
  const mount = $('#bookmarksList'); mount.innerHTML='';
  const items = STATE.bookmarks.map(url => STATE.courses.find(c=>c.url===url)).filter(Boolean);
  const sortv = $('#bmSort')?$('#bmSort').value:'added_desc';
  items.sort((a,b)=>{
    if(sortv==='added_desc') return (STATE.bmMeta[b.url]?.addedAt||0) - (STATE.bmMeta[a.url]?.addedAt||0);
    if(sortv==='added_asc') return (STATE.bmMeta[a.url]?.addedAt||0) - (STATE.bmMeta[b.url]?.addedAt||0);
    if(sortv==='name_asc') return a.name.localeCompare(b.name,'ru');
    return 0;
  });
  if(items.length===0){ mount.innerHTML = '<div style="color:#888">Закладок нет</div>'; return; }
  items.forEach(c=>{
    const card = document.createElement('div'); card.className='course-card';
    const left = document.createElement('div'); left.className='course-left';
    left.innerHTML = `<div class="course-title">${escapeHtml(c.name)}</div><div class="course-meta">${escapeHtml(c.description||c.url)}</div>`;
    const actions = document.createElement('div'); actions.className='course-actions';
    const openBtn = document.createElement('button'); openBtn.className='btn-icon'; openBtn.innerHTML='<i class="fa-solid fa-arrow-up-right-from-square"></i>'; openBtn.onclick=()=>window.open(c.url,'_blank');
    const rm = document.createElement('button'); rm.className='btn-icon'; rm.innerHTML='<i class="fa-solid fa-trash"></i>'; rm.onclick=()=>{ toggleBookmark(c) };
    actions.appendChild(openBtn); actions.appendChild(rm);
    card.appendChild(left); card.appendChild(actions);
    mount.appendChild(card);
  });
}

/* watched */
function toggleWatched(course){
  const i = STATE.watched.indexOf(course.url);
  if(i>=0){ STATE.watched.splice(i,1); saveJSON(KEY_WATCHED, STATE.watched); showToast('Отмечено как непросмотренное'); }
  else { STATE.watched.push(course.url); saveJSON(KEY_WATCHED, STATE.watched); showToast('Отмечено как просмотрено'); }
  renderCatalog(); renderWatched();
}
function renderWatched(){
  const mount = $('#watchedList'); mount.innerHTML='';
  const items = STATE.watched.map(url => STATE.courses.find(c=>c.url===url)).filter(Boolean);
  if(items.length===0){ mount.innerHTML = '<div style="color:#888">Нет просмотренных курсов</div>'; return; }
  items.forEach(c=>{
    const card = document.createElement('div'); card.className='course-card';
    const left = document.createElement('div'); left.className='course-left';
    left.innerHTML = `<div class="course-title">${escapeHtml(c.name)}</div><div class="course-meta">${escapeHtml(c.description||c.url)}</div>`;
    const actions = document.createElement('div'); actions.className='course-actions';
    const openBtn = document.createElement('button'); openBtn.className='btn-icon'; openBtn.innerHTML='<i class="fa-solid fa-arrow-up-right-from-square"></i>'; openBtn.onclick=()=>window.open(c.url,'_blank');
    const rm = document.createElement('button'); rm.className='btn-icon'; rm.innerHTML='<i class="fa-solid fa-trash"></i>'; rm.onclick=()=>{ toggleWatched(c) };
    actions.appendChild(openBtn); actions.appendChild(rm);
    card.appendChild(left); card.appendChild(actions);
    mount.appendChild(card);
  });
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

/* search input behavior */
// $('#searchInput').addEventListener('input', (e)=>{
//   STATE.query = e.target.value;
//   renderSuggestions(STATE.query);
//   renderCatalog();
// });

// Замените текущий обработчик input на этот фрагмент
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
  n.addEventListener('click', ()=>{
    $all('.nav-item').forEach(x=>x.classList.remove('active'));
    n.classList.add('active');
    const target = n.dataset.target;
    $all('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    window.scrollTo(0,0);
  });
});

$('#searchInput').addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault(); // чтобы не было лишнего сабмита

    const query = this.value.trim();
    STATE.query = query;
    STATE.activeCategory = null; // сбрасываем фильтр по категории

    // Скрыть подсказки
    $('#suggestBox').style.display = "none";

    // Перерисовать список курсов
    renderCategories();
    renderCatalog();

    // Закрыть клавиатуру
    this.blur();
  }


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
