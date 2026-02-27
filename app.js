// Work Notes v3.0.0
// Ideal offline PWA with compatibility fixes (no structuredClone/replaceAll required)
const APP_VERSION = "v3.0.0";
const STORAGE_KEY = "work_notes_ideal_v3_state";

function clone(obj) {
  try { if (typeof structuredClone === "function") return structuredClone(obj); } catch(e) {}
  return JSON.parse(JSON.stringify(obj));
}
function normalize(s) { return String(s ?? "").trim(); }
function nowISO() { return new Date().toISOString(); }
function uid() { return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16); }

const DEFAULTS = {
  version: APP_VERSION,
  employees: ["Я"],
  models: ["Little Italy", "RA Success", "BRIDGE Scanner"],
  entries: [],
  quick: {
    colors: ["Чёрный", "Матовый", "Белый", "Серый"],
    sizes: ["36","38","40","42","44","46","48","50","52","54"]
  }
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(DEFAULTS);
  try {
    const s = JSON.parse(raw);
    const st = clone(DEFAULTS);
    if (Array.isArray(s.employees)) st.employees = s.employees;
    if (Array.isArray(s.models)) st.models = s.models;
    if (Array.isArray(s.entries)) st.entries = s.entries;
    if (s.quick && typeof s.quick === "object") {
      if (Array.isArray(s.quick.colors)) st.quick.colors = s.quick.colors;
      if (Array.isArray(s.quick.sizes)) st.quick.sizes = s.quick.sizes;
    }
    return st;
  } catch(e) {
    return clone(DEFAULTS);
  }
}
function saveState(st) { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); }

function formatDT(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { dateStyle:"short", timeStyle:"short" });
}
function toDateInputValue(d) {
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function parseDateInput(v) {
  if (!v) return null;
  const [y,m,d]=v.split("-").map(Number);
  if (!y||!m||!d) return null;
  return new Date(y,m-1,d,0,0,0,0);
}
function endOfDay(date) {
  const d=new Date(date);
  d.setHours(23,59,59,999);
  return d;
}
function escapeCSV(s) {
  const str=String(s ?? "");
  const safe=str.split('"').join('""');
  if (/[",\n]/.test(str)) return `"${safe}"`;
  return str;
}
function sortRU(arr) { return [...arr].sort((a,b)=>a.localeCompare(b,"ru")); }

const state = loadState();

function $(id) { return document.getElementById(id); }

const tabs = document.querySelectorAll(".tab");
const tabAdd=$("tab-add"), tabHistory=$("tab-history"), tabStats=$("tab-stats"), tabSettings=$("tab-settings");

const employeeSelect=$("employeeSelect"), addEmployeeBtn=$("addEmployeeBtn");
const modelSelect=$("modelSelect"), addModelBtn=$("addModelBtn");

const colorInput=$("colorInput"), sizeInput=$("sizeInput"), qtyInput=$("qtyInput"), noteInput=$("noteInput");
const quickColors=$("quickColors"), quickSizes=$("quickSizes");

const saveBtn=$("saveBtn"), clearBtn=$("clearBtn"), toast=$("toast");
const installBtn=$("installBtn"), installHint=$("installHint");

const historyList=$("historyList"), summaryBox=$("summaryBox");
const searchInput=$("searchInput"), filterEmployeeSelect=$("filterEmployeeSelect"), filterModelSelect=$("filterModelSelect");
const filterSizeInput=$("filterSizeInput"), dateFromInput=$("dateFromInput"), dateToInput=$("dateToInput");
const quickTodayBtn=$("quickTodayBtn"), quickWeekBtn=$("quickWeekBtn"), quickMonthBtn=$("quickMonthBtn"), quickAllBtn=$("quickAllBtn");

const exportCsvBtn=$("exportCsvBtn"), exportJsonBtn=$("exportJsonBtn"), wipeBtn=$("wipeBtn");

const statsRangeSelect=$("statsRangeSelect"), refreshStatsBtn=$("refreshStatsBtn");
const statsTotalQty=$("statsTotalQty"), statsTotalRows=$("statsTotalRows"), statsEmployees=$("statsEmployees"), statsModels=$("statsModels"), statsSizes=$("statsSizes");
const topEmployees=$("topEmployees"), topModels=$("topModels"), dailyBars=$("dailyBars");

const settingsColors=$("settingsColors"), settingsSizes=$("settingsSizes"), settingsModels=$("settingsModels"), settingsEmployees=$("settingsEmployees");
const saveSettingsBtn=$("saveSettingsBtn"), resetSettingsBtn=$("resetSettingsBtn"), settingsToast=$("settingsToast");

const importJsonBtn=$("importJsonBtn"), importFile=$("importFile");

function showToast(msg) {
  toast.textContent=msg;
  setTimeout(()=>{ if (toast.textContent===msg) toast.textContent=""; }, 1800);
}
function showSettingsToast(msg) {
  settingsToast.textContent=msg;
  setTimeout(()=>{ if (settingsToast.textContent===msg) settingsToast.textContent=""; }, 1800);
}

function switchTab(key) {
  tabs.forEach(t=>{
    const active=t.dataset.tab===key;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  tabAdd.classList.toggle("hidden", key!=="add");
  tabHistory.classList.toggle("hidden", key!=="history");
  tabStats.classList.toggle("hidden", key!=="stats");
  tabSettings.classList.toggle("hidden", key!=="settings");
  if (key==="history") renderHistory();
  if (key==="stats") renderStats();
  if (key==="settings") renderSettings();
}
tabs.forEach(t=>t.addEventListener("click", ()=>switchTab(t.dataset.tab)));

function renderSelects() {
  const emps=sortRU(state.employees);
  employeeSelect.innerHTML=emps.map(e=>`<option value="${e}">${e}</option>`).join("");
  filterEmployeeSelect.innerHTML=`<option value="">Все сотрудники</option>` + emps.map(e=>`<option value="${e}">${e}</option>`).join("");

  const models=sortRU(state.models);
  modelSelect.innerHTML=models.map(m=>`<option value="${m}">${m}</option>`).join("");
  filterModelSelect.innerHTML=`<option value="">Все модели</option>` + models.map(m=>`<option value="${m}">${m}</option>`).join("");
}

function renderQuickButtons() {
  quickColors.innerHTML="";
  quickSizes.innerHTML="";
  state.quick.colors.forEach(c=>{
    const b=document.createElement("div");
    b.className="pill";
    b.textContent=c;
    b.addEventListener("click", ()=>{ colorInput.value=c; colorInput.focus(); });
    quickColors.appendChild(b);
  });
  state.quick.sizes.forEach(s=>{
    const b=document.createElement("div");
    b.className="pill";
    b.textContent=s;
    b.addEventListener("click", ()=>{ sizeInput.value=s; sizeInput.focus(); });
    quickSizes.appendChild(b);
  });
}

addEmployeeBtn.addEventListener("click", ()=>{
  const name=prompt("Имя сотрудника:");
  if (!name) return;
  const clean=normalize(name);
  if (!clean) return;
  if (state.employees.some(x=>x.toLowerCase()===clean.toLowerCase())) return alert("Этот сотрудник уже есть 🙂");
  state.employees.push(clean);
  saveState(state);
  renderSelects();
  employeeSelect.value=clean;
  showToast("Сотрудник добавлен ✅");
});

addModelBtn.addEventListener("click", ()=>{
  const name=prompt("Название модели:");
  if (!name) return;
  const clean=normalize(name);
  if (!clean) return;
  if (state.models.some(x=>x.toLowerCase()===clean.toLowerCase())) return alert("Такая модель уже есть 🙂");
  state.models.push(clean);
  saveState(state);
  renderSelects();
  modelSelect.value=clean;
  showToast("Модель добавлена ✅");
});

clearBtn.addEventListener("click", ()=>{
  colorInput.value=""; sizeInput.value=""; qtyInput.value=""; noteInput.value="";
});

saveBtn.addEventListener("click", ()=>{
  const employee=employeeSelect.value;
  const model=modelSelect.value;
  const color=normalize(colorInput.value);
  const size=normalize(sizeInput.value);
  const qty=Number(qtyInput.value);
  const note=normalize(noteInput.value);

  if (!employee) return alert("Выбери сотрудника");
  if (!model) return alert("Выбери модель");
  if (!color) return alert("Введите цвет");
  if (!size) return alert("Введите размер");
  if (!Number.isFinite(qty) || qty<=0) return alert("Введите количество (больше 0)");

  state.entries.unshift({ id: uid(), createdAt: nowISO(), employee, model, color, size, qty, note });
  saveState(state);
  colorInput.value=""; sizeInput.value=""; qtyInput.value=""; noteInput.value="";
  showToast("Сохранено ✍️✅");
});

function matches(entry, q, empFilter, modelFilter, sizeFilter, dateFrom, dateTo) {
  if (empFilter && entry.employee!==empFilter) return false;
  if (modelFilter && entry.model!==modelFilter) return false;
  if (sizeFilter && entry.size.toLowerCase()!==sizeFilter.toLowerCase()) return false;

  const t=new Date(entry.createdAt).getTime();
  if (dateFrom && t<dateFrom.getTime()) return false;
  if (dateTo && t>dateTo.getTime()) return false;

  if (!q) return true;
  const hay=[entry.employee, entry.model, entry.color, entry.size, entry.note, entry.qty].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function getFilteredEntries() {
  const q=normalize(searchInput.value);
  const empFilter=filterEmployeeSelect.value;
  const modelFilter=filterModelSelect.value;
  const sizeFilter=normalize(filterSizeInput.value);
  const from=parseDateInput(dateFromInput.value);
  const to0=parseDateInput(dateToInput.value);
  const to=to0 ? endOfDay(to0) : null;
  return state.entries.filter(e=>matches(e,q,empFilter,modelFilter,sizeFilter,from,to));
}

function calcSummary(list) {
  const totalQty=list.reduce((s,e)=>s+(Number(e.qty)||0),0);
  const employees=new Set(list.map(e=>e.employee)).size;
  const models=new Set(list.map(e=>e.model)).size;
  const sizes=new Set(list.map(e=>e.size)).size;
  return { totalQty, count:list.length, employees, models, sizes };
}

function renderHistory() {
  const filtered=getFilteredEntries();
  const s=calcSummary(filtered);
  summaryBox.textContent=`Записей: ${s.count} | Сумма: ${s.totalQty} шт | Сотрудников: ${s.employees} | Моделей: ${s.models} | Размеров: ${s.sizes}`;
  historyList.innerHTML="";
  if (!filtered.length) {
    historyList.innerHTML=`<div class="item">Пока пусто. Добавь записи во вкладке “Добавить”.</div>`;
    return;
  }
  filtered.forEach(e=>{
    const el=document.createElement("div");
    el.className="item";
    el.innerHTML=`
      <div class="meta">
        <div>${formatDT(e.createdAt)}</div>
        <button class="btn danger tiny" data-del="${e.id}" type="button">Удалить</button>
      </div>
      <div class="main">
        <div class="row" style="flex-wrap:wrap">
          <span class="badge">👤 ${e.employee}</span>
          <span class="badge">📦 ${e.model}</span>
          <span class="badge">🎨 ${e.color}</span>
          <span class="badge">📏 ${e.size}</span>
          ${e.note ? `<span class="badge">💬 ${e.note}</span>` : ""}
        </div>
        <div class="qty">${e.qty} шт</div>
      </div>
    `;
    historyList.appendChild(el);
  });
  historyList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id=btn.getAttribute("data-del");
      if (!confirm("Удалить эту запись?")) return;
      state.entries=state.entries.filter(x=>x.id!==id);
      saveState(state);
      renderHistory();
    });
  });
}

function renderSettings() {
  settingsColors.value=state.quick.colors.join(", ");
  settingsSizes.value=state.quick.sizes.join(", ");
  settingsModels.value=state.models.join(", ");
  settingsEmployees.value=state.employees.join(", ");
}

["input","change"].forEach(evt=>{
  searchInput.addEventListener(evt, renderHistory);
  filterEmployeeSelect.addEventListener(evt, renderHistory);
  filterModelSelect.addEventListener(evt, renderHistory);
  filterSizeInput.addEventListener(evt, renderHistory);
  dateFromInput.addEventListener(evt, renderHistory);
  dateToInput.addEventListener(evt, renderHistory);
});

function setRange(range) {
  const today=new Date();
  const start=new Date(today);
  const end=new Date(today);
  if (range==="today") {
    dateFromInput.value=toDateInputValue(today);
    dateToInput.value=toDateInputValue(today);
  } else if (range==="week") {
    start.setDate(today.getDate()-6);
    dateFromInput.value=toDateInputValue(start);
    dateToInput.value=toDateInputValue(end);
  } else if (range==="month") {
    start.setDate(today.getDate()-29);
    dateFromInput.value=toDateInputValue(start);
    dateToInput.value=toDateInputValue(end);
  } else {
    dateFromInput.value="";
    dateToInput.value="";
  }
  renderHistory();
}
quickTodayBtn.addEventListener("click", ()=>setRange("today"));
quickWeekBtn.addEventListener("click", ()=>setRange("week"));
quickMonthBtn.addEventListener("click", ()=>setRange("month"));
quickAllBtn.addEventListener("click", ()=>setRange("all"));

function downloadBlob(blob, filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

exportCsvBtn.addEventListener("click", ()=>{
  const list=getFilteredEntries();
  const header=["Дата","Сотрудник","Модель","Цвет","Размер","Количество","Комментарий"];
  const rows=list.map(e=>[formatDT(e.createdAt),e.employee,e.model,e.color,e.size,e.qty,e.note ?? ""]);
  const csv=[header, ...rows].map(r=>r.map(escapeCSV).join(",")).join("\n");
  downloadBlob(new Blob([csv], {type:"text/csv;charset=utf-8"}), "work-notes.csv");
});

exportJsonBtn.addEventListener("click", ()=>{
  const backup={ exportedAt: nowISO(), version: 3, data: state };
  downloadBlob(new Blob([JSON.stringify(backup,null,2)], {type:"application/json"}), "work-notes-backup.json");
});

wipeBtn.addEventListener("click", ()=>{
  if (!confirm("Очистить ВСЕ записи? Это нельзя отменить.")) return;
  state.entries=[];
  saveState(state);
  renderHistory();
  showToast("История очищена 🧽");
});

importJsonBtn.addEventListener("click", ()=>importFile.click());
importFile.addEventListener("change", async ()=>{
  const file=importFile.files && importFile.files[0];
  if (!file) return;
  try {
    const text=await file.text();
    const obj=JSON.parse(text);
    const data=obj && (obj.data || obj);
    if (!data || !Array.isArray(data.entries)) throw new Error("bad format");
    if (!confirm("Импорт заменит данные на этом устройстве. Продолжить?")) return;

    const next=clone(DEFAULTS);
    if (Array.isArray(data.entries)) next.entries=data.entries;
    if (Array.isArray(data.models)) next.models=data.models;
    if (Array.isArray(data.employees)) next.employees=data.employees;
    if (data.quick && typeof data.quick==="object") {
      if (Array.isArray(data.quick.colors)) next.quick.colors=data.quick.colors;
      if (Array.isArray(data.quick.sizes)) next.quick.sizes=data.quick.sizes;
    }
    Object.assign(state, next);
    saveState(state);
    renderSelects();
    renderQuickButtons();
    showSettingsToast("Импорт выполнен ✅");
  } catch(e) {
    alert("Не получилось импортировать JSON. Проверь файл.");
  } finally {
    importFile.value="";
  }
});

function withinRange(entry, range) {
  if (range==="all") return true;
  const t=new Date(entry.createdAt);
  const now=new Date();
  if (range==="today") return t.toDateString()===now.toDateString();
  const days=(range==="week") ? 7 : 30;
  const start=new Date(now);
  start.setHours(0,0,0,0);
  start.setDate(now.getDate()-(days-1));
  return t.getTime()>=start.getTime();
}

function groupSum(list, keyFn) {
  const m=new Map();
  list.forEach(e=>{
    const k=keyFn(e);
    m.set(k, (m.get(k)||0) + (Number(e.qty)||0));
  });
  return [...m.entries()].sort((a,b)=>b[1]-a[1]);
}

function renderBarList(container, pairs, maxItems=10) {
  container.innerHTML="";
  const top=pairs.slice(0,maxItems);
  const maxVal=top.length ? top[0][1] : 0;
  if (!top.length) {
    container.innerHTML=`<div class="hint">Нет данных для выбранного периода.</div>`;
    return;
  }
  top.forEach(([name,val])=>{
    const row=document.createElement("div");
    row.className="barRow";
    const pct=maxVal ? Math.round((val/maxVal)*100) : 0;
    row.innerHTML=`
      <div class="barName" title="${name}">${name}</div>
      <div class="barTrack"><div class="barFill" style="width:${pct}%"></div></div>
      <div class="barVal">${val}</div>
    `;
    container.appendChild(row);
  });
}

function renderDaily(container, list, range) {
  container.innerHTML="";
  const now=new Date();
  let days=14;
  if (range==="today") days=1;
  if (range==="week") days=7;

  const start=new Date(now);
  start.setHours(0,0,0,0);
  start.setDate(now.getDate()-(days-1));

  const sums=new Map();
  for (let i=0;i<days;i++) {
    const d=new Date(start);
    d.setDate(start.getDate()+i);
    sums.set(d.toDateString(), 0);
  }

  list.forEach(e=>{
    const d=new Date(e.createdAt);
    const key=d.toDateString();
    if (sums.has(key)) sums.set(key, sums.get(key) + (Number(e.qty)||0));
  });

  const pairs=[...sums.entries()].map(([k,v])=>[new Date(k).toLocaleDateString("ru-RU", {month:"2-digit",day:"2-digit"}), v]);
  const maxVal=pairs.reduce((m, [,v])=>Math.max(m,v), 0);
  pairs.forEach(([label,val])=>{
    const row=document.createElement("div");
    row.className="barRow";
    const pct=maxVal ? Math.round((val/maxVal)*100) : 0;
    row.innerHTML=`
      <div class="barName">${label}</div>
      <div class="barTrack"><div class="barFill" style="width:${pct}%"></div></div>
      <div class="barVal">${val}</div>
    `;
    container.appendChild(row);
  });
}

function renderStats() {
  const range=statsRangeSelect.value;
  const list=state.entries.filter(e=>withinRange(e, range));
  const qty=list.reduce((a,e)=>a+(Number(e.qty)||0),0);
  statsTotalQty.textContent=String(qty);
  statsTotalRows.textContent=`${list.length} записей`;
  statsEmployees.textContent=String(new Set(list.map(e=>e.employee)).size);
  statsModels.textContent=String(new Set(list.map(e=>e.model)).size);
  statsSizes.textContent=String(new Set(list.map(e=>e.size)).size);

  renderBarList(topEmployees, groupSum(list, e=>e.employee), 10);
  renderBarList(topModels, groupSum(list, e=>e.model), 10);
  renderDaily(dailyBars, list, range);
}
refreshStatsBtn.addEventListener("click", renderStats);
statsRangeSelect.addEventListener("change", renderStats);

function splitCSVLike(text) { return String(text||"").split(",").map(x=>normalize(x)).filter(Boolean); }

saveSettingsBtn.addEventListener("click", ()=>{
  const colors=splitCSVLike(settingsColors.value);
  const sizes=splitCSVLike(settingsSizes.value);
  const models=splitCSVLike(settingsModels.value);
  const employees=splitCSVLike(settingsEmployees.value);

  if (colors.length) state.quick.colors=colors;
  if (sizes.length) state.quick.sizes=sizes;

  models.forEach(m=>{ if (!state.models.some(x=>x.toLowerCase()===m.toLowerCase())) state.models.push(m); });
  employees.forEach(e=>{ if (!state.employees.some(x=>x.toLowerCase()===e.toLowerCase())) state.employees.push(e); });

  saveState(state);
  renderSelects();
  renderQuickButtons();
  showSettingsToast("Сохранено ✅");
});

resetSettingsBtn.addEventListener("click", ()=>{
  if (!confirm("Сбросить быстрые кнопки к стандарту?")) return;
  state.quick=clone(DEFAULTS.quick);
  saveState(state);
  renderQuickButtons();
  renderSettings();
  showSettingsToast("Сброшено ✅");
});

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt=e;
  installBtn.classList.remove("hidden");
  installHint.textContent="Можно установить как приложение для офлайн-работы.";
});

installBtn.addEventListener("click", async ()=>{
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch(e) {}
  deferredPrompt=null;
  installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", ()=>{
  installHint.textContent="Установлено ✅";
  installBtn.classList.add("hidden");
});

// Init
renderSelects();
renderQuickButtons();
switchTab("add");
console.log("Work Notes loaded", APP_VERSION);
