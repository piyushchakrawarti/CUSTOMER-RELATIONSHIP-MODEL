/*  NexusCRM — app.js
    Full frontend logic: routing, API calls, rendering, modals, drag-and-drop
    ======================================================================== */

const API = '';   // Same origin — FastAPI serves both

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  currentSection: 'dashboard',
  companies: [],
  contacts: [],
  deals: [],
  interactions: [],
  currentFilter: 'all',
  dealsView: 'kanban',
  editingId: null,
  editingType: null,
  draggedDealId: null,
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function fmt(val) {
  if (!val) return '<span class="text-slate-300">—</span>';
  return val;
}

function fmtMoney(val) {
  if (val === null || val === undefined || val === '') return '—';
  return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function avatar(name) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const colors = ['#6366f1','#06b6d4','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899'];
  const color = colors[name ? name.charCodeAt(0) % colors.length : 0];
  return `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:${color}">${initials}</div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  const colors = { success: '#10b981', error: '#ef4444', info: '#6366f1' };
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  inner.style.background = colors[type] || colors.info;
  icon.className = `fa-solid ${icons[type] || icons.info}`;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function showConfirm(msg, onOk) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  const cleanup = () => document.getElementById('confirm-overlay').classList.add('hidden');
  okBtn.onclick = () => { cleanup(); onOk(); };
  cancelBtn.onclick = cleanup;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + url, opts);
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const pageMeta = {
  dashboard:    { title: 'Dashboard',       subtitle: 'Overview of your CRM activity' },
  companies:    { title: 'Companies',        subtitle: 'Manage your organizations' },
  contacts:     { title: 'Contacts',         subtitle: 'People in your network' },
  deals:        { title: 'Deals Pipeline',   subtitle: 'Track and move deals through stages' },
  interactions: { title: 'Activity Log',     subtitle: 'Calls, emails, meetings & notes' },
};

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active','text-white');
    n.classList.add('text-slate-300');
  });
  const activeSection = document.getElementById(`section-${section}`);
  const activeNav = document.getElementById(`nav-${section}`);
  if (activeSection) activeSection.classList.add('active');
  if (activeNav) {
    activeNav.classList.add('active','text-white');
    activeNav.classList.remove('text-slate-300');
  }
  const meta = pageMeta[section] || {};
  document.getElementById('page-title').textContent = meta.title || section;
  document.getElementById('page-subtitle').textContent = meta.subtitle || '';
  state.currentSection = section;
  loadSection(section);
}

async function loadSection(section) {
  try {
    switch (section) {
      case 'dashboard':    await loadDashboard(); break;
      case 'companies':    await loadCompanies(); break;
      case 'contacts':     await loadContacts(); break;
      case 'deals':        await loadDeals(); break;
      case 'interactions': await loadInteractions(); break;
    }
  } catch (e) {
    showToast('Failed to load data: ' + e.message, 'error');
  }
}

// Nav click handlers
document.querySelectorAll('.nav-item[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(el.dataset.section);
  });
});

// Quick add button
document.getElementById('btn-quick-add').addEventListener('click', () => {
  const qMap = {
    dashboard: 'interaction', companies: 'company', contacts: 'contact',
    deals: 'deal', interactions: 'interaction',
  };
  openModal(qMap[state.currentSection] || 'company');
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const data = await apiFetch('/api/dashboard/stats');
  document.getElementById('stat-companies').textContent = data.total_companies;
  document.getElementById('stat-contacts').textContent = data.total_contacts;
  document.getElementById('stat-deals').textContent = data.active_deals;
  document.getElementById('stat-revenue').textContent = fmtMoney(data.total_revenue);
  renderRecentInteractions(data.recent_interactions);
}

function renderRecentInteractions(list) {
  const container = document.getElementById('recent-interactions-list');
  if (!list || list.length === 0) {
    container.innerHTML = `<div class="px-6 py-12 text-center text-slate-400 text-sm">No recent activity</div>`;
    return;
  }
  container.innerHTML = list.map(i => {
    const typeConfig = interactionTypeConfig(i.type);
    const who = i.contact_name || i.company_name || 'Unknown';
    return `<div class="px-6 py-4 flex items-start gap-4">
      <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${typeConfig.bg}">
        <i class="fa-solid ${typeConfig.icon} text-sm ${typeConfig.text}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-800 truncate">${who}</p>
          <span class="text-xs text-slate-400 shrink-0 ml-3">${fmtDatetime(i.interaction_date)}</span>
        </div>
        <p class="text-xs text-slate-500 truncate mt-0.5">${i.notes || 'No notes'}</p>
      </div>
    </div>`;
  }).join('');
}

function interactionTypeConfig(type) {
  const map = {
    call:    { icon: 'fa-phone', bg: 'bg-blue-100',   text: 'text-blue-600',   label: 'Call',    color: '#3b82f6' },
    email:   { icon: 'fa-envelope', bg: 'bg-purple-100', text: 'text-purple-600', label: 'Email',   color: '#8b5cf6' },
    meeting: { icon: 'fa-video', bg: 'bg-green-100',  text: 'text-green-600',  label: 'Meeting', color: '#10b981' },
    note:    { icon: 'fa-note-sticky', bg: 'bg-amber-100',  text: 'text-amber-600',  label: 'Note',    color: '#f59e0b' },
  };
  return map[type] || map.note;
}

// ─── COMPANIES ────────────────────────────────────────────────────────────────

async function loadCompanies() {
  state.companies = await apiFetch('/api/companies');
  renderCompanies(state.companies);
}

function renderCompanies(list) {
  const tbody = document.getElementById('companies-tbody');
  const empty = document.getElementById('companies-empty');
  if (!list || list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(c => `
    <tr data-id="${c.id}">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          ${avatar(c.name)}
          <div>
            <p class="font-semibold text-slate-800">${escHtml(c.name)}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-4">${fmt(c.industry ? `<span class="px-2 py-0.5 bg-slate-100 rounded-md text-xs font-medium">${escHtml(c.industry)}</span>` : null)}</td>
      <td class="px-6 py-4 text-slate-500">${fmt(c.email ? `<a href="mailto:${escHtml(c.email)}" class="hover:text-indigo-600">${escHtml(c.email)}</a>` : null)}</td>
      <td class="px-6 py-4 text-slate-500">${fmt(c.phone)}</td>
      <td class="px-6 py-4">${c.website ? `<a href="${escHtml(c.website)}" target="_blank" class="text-indigo-600 text-xs hover:underline">${escHtml(c.website)}</a>` : '—'}</td>
      <td class="px-6 py-4 text-slate-400 text-xs">${fmtDate(c.created_at)}</td>
      <td class="px-6 py-4 text-right">
        <button onclick="openEditModal('company',${c.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
        <button onclick="deleteItem('company',${c.id},'${escHtml(c.name)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
      </td>
    </tr>`).join('');
}

// Search
document.getElementById('companies-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderCompanies(state.companies.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.industry || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  ));
});

document.getElementById('btn-add-company').addEventListener('click', () => openModal('company'));

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

async function loadContacts() {
  state.contacts = await apiFetch('/api/contacts');
  renderContacts(state.contacts);
}

function renderContacts(list) {
  const tbody = document.getElementById('contacts-tbody');
  const empty = document.getElementById('contacts-empty');
  if (!list || list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(c => `
    <tr data-id="${c.id}">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          ${avatar(c.name)}
          <p class="font-semibold text-slate-800">${escHtml(c.name)}</p>
        </div>
      </td>
      <td class="px-6 py-4">${c.company_name ? `<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">${escHtml(c.company_name)}</span>` : '—'}</td>
      <td class="px-6 py-4 text-slate-500 text-sm">${fmt(c.position)}</td>
      <td class="px-6 py-4 text-slate-500">${c.email ? `<a href="mailto:${escHtml(c.email)}" class="hover:text-indigo-600 text-sm">${escHtml(c.email)}</a>` : '—'}</td>
      <td class="px-6 py-4 text-slate-500 text-sm">${fmt(c.phone)}</td>
      <td class="px-6 py-4 text-slate-400 text-xs">${fmtDate(c.created_at)}</td>
      <td class="px-6 py-4 text-right">
        <button onclick="openEditModal('contact',${c.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
        <button onclick="deleteItem('contact',${c.id},'${escHtml(c.name)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
      </td>
    </tr>`).join('');
}

document.getElementById('contacts-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderContacts(state.contacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.company_name || '').toLowerCase().includes(q)
  ));
});

document.getElementById('btn-add-contact').addEventListener('click', () => openModal('contact'));

// ─── DEALS ────────────────────────────────────────────────────────────────────

const STAGES = ['Lead', 'Contacted', 'Proposal', 'Closed-Won', 'Closed-Lost'];
const STAGE_COLORS = {
  'Lead':        { bg: 'bg-slate-100', header: 'bg-slate-200', text: 'text-slate-700', badge: 'bg-slate-200 text-slate-700', dot: '#94a3b8' },
  'Contacted':   { bg: 'bg-blue-50',   header: 'bg-blue-100',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700', dot: '#3b82f6' },
  'Proposal':    { bg: 'bg-amber-50',  header: 'bg-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', dot: '#f59e0b' },
  'Closed-Won':  { bg: 'bg-green-50',  header: 'bg-green-100', text: 'text-green-700', badge: 'bg-green-100 text-green-700', dot: '#10b981' },
  'Closed-Lost': { bg: 'bg-red-50',    header: 'bg-red-100',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700', dot: '#ef4444' },
};

async function loadDeals() {
  state.deals = await apiFetch('/api/deals');
  renderDeals();
}

function renderDeals() {
  if (state.dealsView === 'kanban') renderKanban();
  else renderDealsTable();
}

function setDealsView(view) {
  state.dealsView = view;
  document.getElementById('deals-kanban').classList.toggle('hidden', view !== 'kanban');
  document.getElementById('deals-table-view').classList.toggle('hidden', view !== 'table');
  document.getElementById('btn-kanban-view').className = view === 'kanban'
    ? 'px-4 py-1.5 text-sm rounded-lg font-medium transition-all bg-indigo-600 text-white'
    : 'px-4 py-1.5 text-sm rounded-lg font-medium transition-all text-slate-500 hover:bg-slate-100';
  document.getElementById('btn-table-view').className = view === 'table'
    ? 'px-4 py-1.5 text-sm rounded-lg font-medium transition-all bg-indigo-600 text-white'
    : 'px-4 py-1.5 text-sm rounded-lg font-medium transition-all text-slate-500 hover:bg-slate-100';
  renderDeals();
}

function renderKanban() {
  const container = document.getElementById('deals-kanban');
  container.innerHTML = STAGES.map(stage => {
    const stageDeals = state.deals.filter(d => d.stage === stage);
    const colors = STAGE_COLORS[stage];
    const total = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    return `
      <div class="flex flex-col" style="min-width:220px;">
        <div class="rounded-t-2xl px-4 py-3 ${colors.header} flex items-center justify-between mb-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" style="background:${colors.dot}"></div>
            <span class="text-xs font-bold ${colors.text} uppercase tracking-wide">${stage}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold ${colors.text} bg-white/60 px-2 py-0.5 rounded-full">${stageDeals.length}</span>
          </div>
        </div>
        ${total > 0 ? `<div class="text-xs text-slate-500 font-medium px-4 py-1 ${colors.bg}">${fmtMoney(total)}</div>` : ''}
        <div class="kanban-col flex-1 p-2 rounded-b-2xl space-y-2 ${colors.bg} min-h-[350px]"
             data-stage="${stage}"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDrop(event,'${stage}')">
          ${stageDeals.length === 0 ? `<div class="text-center py-8 text-xs text-slate-400"><i class="fa-regular fa-folder-open text-2xl mb-2 block"></i>No deals</div>` : ''}
          ${stageDeals.map(d => dealCard(d)).join('')}
        </div>
      </div>`;
  }).join('');
}

function dealCard(deal) {
  const colors = STAGE_COLORS[deal.stage] || STAGE_COLORS['Lead'];
  return `
    <div class="deal-card bg-white rounded-xl p-3 shadow-sm border border-slate-100"
         draggable="true"
         data-id="${deal.id}"
         ondragstart="onDragStart(event,${deal.id})"
         ondragend="onDragEnd(event)">
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-sm font-semibold text-slate-800 leading-tight">${escHtml(deal.title)}</p>
        <div class="flex gap-1 shrink-0">
          <button onclick="openEditModal('deal',${deal.id})" class="p-1 rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50"><i class="fa-solid fa-pen text-xs"></i></button>
          <button onclick="deleteItem('deal',${deal.id},'${escHtml(deal.title)}')" class="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      </div>
      ${deal.value ? `<p class="text-base font-bold text-indigo-600 mb-2">${fmtMoney(deal.value)}</p>` : ''}
      ${deal.company_name ? `<div class="flex items-center gap-1.5 mb-1"><i class="fa-solid fa-building text-[10px] text-slate-400"></i><span class="text-xs text-slate-500 truncate">${escHtml(deal.company_name)}</span></div>` : ''}
      ${deal.contact_name ? `<div class="flex items-center gap-1.5 mb-1"><i class="fa-solid fa-user text-[10px] text-slate-400"></i><span class="text-xs text-slate-500 truncate">${escHtml(deal.contact_name)}</span></div>` : ''}
      ${deal.close_date ? `<div class="flex items-center gap-1.5 mt-2"><i class="fa-regular fa-calendar text-[10px] text-slate-400"></i><span class="text-xs text-slate-400">${fmtDate(deal.close_date)}</span></div>` : ''}
    </div>`;
}

function renderDealsTable() {
  const tbody = document.getElementById('deals-tbody');
  if (!state.deals.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">No deals yet</td></tr>`;
    return;
  }
  tbody.innerHTML = state.deals.map(d => {
    const colors = STAGE_COLORS[d.stage] || STAGE_COLORS['Lead'];
    return `<tr data-id="${d.id}">
      <td class="px-6 py-4 font-semibold text-slate-800">${escHtml(d.title)}</td>
      <td class="px-6 py-4 text-slate-500">${fmt(d.company_name)}</td>
      <td class="px-6 py-4 text-slate-500">${fmt(d.contact_name)}</td>
      <td class="px-6 py-4 font-semibold text-indigo-600">${d.value ? fmtMoney(d.value) : '—'}</td>
      <td class="px-6 py-4"><span class="stage-badge ${colors.badge}">${d.stage}</span></td>
      <td class="px-6 py-4 text-slate-500">${fmtDate(d.close_date)}</td>
      <td class="px-6 py-4 text-right">
        <button onclick="openEditModal('deal',${d.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
        <button onclick="deleteItem('deal',${d.id},'${escHtml(d.title)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash text-xs"></i></button>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('btn-add-deal').addEventListener('click', () => openModal('deal'));

// Drag and Drop
function onDragStart(e, id) {
  state.draggedDealId = id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget.closest('.kanban-col') || e.currentTarget;
  col.classList.add('drag-over');
}
function onDragLeave(e) {
  const col = e.currentTarget.closest('.kanban-col') || e.currentTarget;
  col.classList.remove('drag-over');
}
async function onDrop(e, stage) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-over');
  if (!state.draggedDealId) return;
  const deal = state.deals.find(d => d.id === state.draggedDealId);
  if (!deal || deal.stage === stage) return;
  try {
    const updated = await apiFetch(`/api/deals/${state.draggedDealId}`, 'PUT', { stage });
    const idx = state.deals.findIndex(d => d.id === state.draggedDealId);
    if (idx > -1) state.deals[idx] = updated;
    renderKanban();
    showToast(`Deal moved to ${stage}`, 'success');
  } catch (err) {
    showToast('Failed to update deal: ' + err.message, 'error');
  }
  state.draggedDealId = null;
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────

async function loadInteractions() {
  state.interactions = await apiFetch('/api/interactions');
  renderInteractions();
}

function renderInteractions() {
  const list = state.interactions.filter(i => state.currentFilter === 'all' || i.type === state.currentFilter);
  const container = document.getElementById('interactions-timeline');
  const empty = document.getElementById('interactions-empty');
  if (!list.length) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.innerHTML = list.map(i => {
    const cfg = interactionTypeConfig(i.type);
    const who = [i.contact_name, i.company_name].filter(Boolean).join(' · ');
    return `
      <div class="timeline-item relative flex gap-4 pb-3 pl-1">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} z-10">
          <i class="fa-solid ${cfg.icon} text-sm ${cfg.text}"></i>
        </div>
        <div class="flex-1 bg-white rounded-2xl shadow-sm p-4 border border-slate-100">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold uppercase tracking-wider ${cfg.text} ${cfg.bg} px-2 py-0.5 rounded-full">${cfg.label}</span>
              ${who ? `<span class="text-sm font-medium text-slate-700">${escHtml(who)}</span>` : ''}
              ${i.deal_title ? `<span class="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">${escHtml(i.deal_title)}</span>` : ''}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-xs text-slate-400">${fmtDatetime(i.interaction_date)}</span>
              <button onclick="openEditModal('interaction',${i.id})" class="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 ml-1"><i class="fa-solid fa-pen text-xs"></i></button>
              <button onclick="deleteItem('interaction',${i.id},'this activity')" class="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
          </div>
          ${i.notes ? `<p class="text-sm text-slate-600 mt-2 leading-relaxed">${escHtml(i.notes)}</p>` : ''}
        </div>
      </div>`;
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.className = 'filter-btn px-3 py-1.5 text-xs font-semibold rounded-full bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';
    });
    btn.className = 'filter-btn px-3 py-1.5 text-xs font-semibold rounded-full bg-indigo-600 text-white';
    state.currentFilter = btn.dataset.filter;
    renderInteractions();
  });
});

document.getElementById('btn-add-interaction').addEventListener('click', () => openModal('interaction'));

// ─── MODAL ────────────────────────────────────────────────────────────────────

const modalOverlay = document.getElementById('modal-overlay');
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

function closeModal() {
  modalOverlay.classList.add('hidden');
  state.editingId = null;
  state.editingType = null;
}

function openModal(type, prefill = null) {
  state.editingId = null;
  state.editingType = type;
  buildForm(type, prefill);
  modalOverlay.classList.remove('hidden');
}

async function openEditModal(type, id) {
  state.editingId = id;
  state.editingType = type;
  try {
    const data = await apiFetch(`/api/${type}s/${id}`);
    buildForm(type, data);
    modalOverlay.classList.remove('hidden');
  } catch (e) {
    showToast('Failed to load item: ' + e.message, 'error');
  }
}

// Form Builder
async function buildForm(type, data = null) {
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const isEdit = !!data && !!state.editingId;
  title.textContent = `${isEdit ? 'Edit' : 'Add'} ${capitalize(type)}`;

  // Ensure state data is up-to-date for dropdowns
  if (state.companies.length === 0) {
    try { state.companies = await apiFetch('/api/companies'); } catch {}
  }
  if (state.contacts.length === 0) {
    try { state.contacts = await apiFetch('/api/contacts'); } catch {}
  }
  if (state.deals.length === 0 && type === 'interaction') {
    try { state.deals = await apiFetch('/api/deals'); } catch {}
  }

  const companyOptions = state.companies.map(c =>
    `<option value="${c.id}" ${data && data.company_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');
  const contactOptions = state.contacts.map(c =>
    `<option value="${c.id}" ${data && data.contact_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');
  const dealOptions = state.deals.map(d =>
    `<option value="${d.id}" ${data && data.deal_id === d.id ? 'selected' : ''}>${escHtml(d.title)}</option>`
  ).join('');

  const field = (id, label, type, value, required = false, extra = '') =>
    `<div>
      <label class="block text-xs font-semibold text-slate-600 mb-1.5">${label}${required ? ' <span class="text-red-400">*</span>' : ''}</label>
      <input id="${id}" type="${type}" value="${escAttr(value || '')}" ${required ? 'required' : ''} ${extra}
        class="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-colors" />
    </div>`;

  const select = (id, label, options, value = '', required = false) =>
    `<div>
      <label class="block text-xs font-semibold text-slate-600 mb-1.5">${label}${required ? ' <span class="text-red-400">*</span>' : ''}</label>
      <select id="${id}" ${required ? 'required' : ''}
        class="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-colors appearance-none">
        ${options}
      </select>
    </div>`;

  const textarea = (id, label, value = '') =>
    `<div>
      <label class="block text-xs font-semibold text-slate-600 mb-1.5">${label}</label>
      <textarea id="${id}" rows="3"
        class="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-colors resize-none">${escHtml(value || '')}</textarea>
    </div>`;

  const forms = {
    company: `
      ${field('f-name', 'Company Name', 'text', data?.name, true)}
      ${field('f-industry', 'Industry', 'text', data?.industry)}
      ${field('f-email', 'Email', 'email', data?.email)}
      ${field('f-phone', 'Phone', 'text', data?.phone)}
      ${field('f-website', 'Website', 'url', data?.website)}
      ${textarea('f-address', 'Address', data?.address)}`,

    contact: `
      ${field('f-name', 'Full Name', 'text', data?.name, true)}
      ${field('f-email', 'Email', 'email', data?.email)}
      ${field('f-phone', 'Phone', 'text', data?.phone)}
      ${field('f-position', 'Position / Title', 'text', data?.position)}
      ${select('f-company', 'Company', `<option value="">— Select Company —</option>${companyOptions}`, data?.company_id)}`,

    deal: `
      ${field('f-title', 'Deal Title', 'text', data?.title, true)}
      ${field('f-value', 'Value ($)', 'number', data?.value, false, 'min="0" step="0.01"')}
      ${select('f-stage', 'Stage', STAGES.map(s => `<option value="${s}" ${data?.stage === s ? 'selected' : ''}>${s}</option>`).join(''), data?.stage, true)}
      ${field('f-close-date', 'Expected Close Date', 'date', data?.close_date)}
      ${select('f-company', 'Company', `<option value="">— Select Company —</option>${companyOptions}`, data?.company_id)}
      ${select('f-contact', 'Contact', `<option value="">— Select Contact —</option>${contactOptions}`, data?.contact_id)}`,

    interaction: `
      ${select('f-type', 'Type', ['call','email','meeting','note'].map(t => `<option value="${t}" ${data?.type === t ? 'selected' : ''}>${capitalize(t)}</option>`).join(''), data?.type || 'note', true)}
      ${textarea('f-notes', 'Notes / Details', data?.notes)}
      ${field('f-date', 'Date & Time', 'datetime-local', data?.interaction_date ? data.interaction_date.substring(0,16) : '')}
      ${select('f-contact', 'Contact', `<option value="">— Select Contact —</option>${contactOptions}`, data?.contact_id)}
      ${select('f-company', 'Company', `<option value="">— Select Company —</option>${companyOptions}`, data?.company_id)}
      ${select('f-deal', 'Related Deal', `<option value="">— Select Deal —</option>${dealOptions}`, data?.deal_id)}`,
  };

  body.innerHTML = forms[type] || '<p class="text-slate-500">Unknown type</p>';
}

// Submit modal
document.getElementById('modal-submit').addEventListener('click', async () => {
  const type = state.editingType;
  const isEdit = !!state.editingId;
  const g = id => document.getElementById(id);
  const val = id => g(id)?.value || null;

  let payload = {};
  if (type === 'company') {
    if (!val('f-name')) { showToast('Company name is required', 'error'); return; }
    payload = {
      name: val('f-name'), industry: val('f-industry') || null,
      email: val('f-email') || null, phone: val('f-phone') || null,
      website: val('f-website') || null, address: val('f-address') || null,
    };
    const fn = () => g('f-address')?.value || null;
    payload.address = g('f-address')?.value || null;
  } else if (type === 'contact') {
    if (!val('f-name')) { showToast('Contact name is required', 'error'); return; }
    payload = {
      name: val('f-name'), email: val('f-email') || null,
      phone: val('f-phone') || null, position: val('f-position') || null,
      company_id: val('f-company') ? parseInt(val('f-company')) : null,
    };
  } else if (type === 'deal') {
    if (!val('f-title')) { showToast('Deal title is required', 'error'); return; }
    payload = {
      title: val('f-title'),
      value: val('f-value') ? parseFloat(val('f-value')) : null,
      stage: val('f-stage') || 'Lead',
      close_date: val('f-close-date') || null,
      company_id: val('f-company') ? parseInt(val('f-company')) : null,
      contact_id: val('f-contact') ? parseInt(val('f-contact')) : null,
    };
  } else if (type === 'interaction') {
    payload = {
      type: val('f-type') || 'note',
      notes: g('f-notes')?.value || null,
      interaction_date: val('f-date') ? new Date(val('f-date')).toISOString() : null,
      contact_id: val('f-contact') ? parseInt(val('f-contact')) : null,
      company_id: val('f-company') ? parseInt(val('f-company')) : null,
      deal_id: val('f-deal') ? parseInt(val('f-deal')) : null,
    };
  }

  const submitBtn = document.getElementById('modal-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const url = isEdit ? `/api/${type}s/${state.editingId}` : `/api/${type}s`;
    const method = isEdit ? 'PUT' : 'POST';
    await apiFetch(url, method, payload);
    showToast(`${capitalize(type)} ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
    closeModal();
    await loadSection(state.currentSection);
    if (state.currentSection !== 'dashboard') {
      state.companies = [];
      state.contacts = [];
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save';
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

function deleteItem(type, id, name) {
  showConfirm(`Delete "${name}"? This action cannot be undone.`, async () => {
    try {
      await apiFetch(`/api/${type}s/${id}`, 'DELETE');
      showToast(`${capitalize(type)} deleted`, 'success');
      // Refresh state
      if (type === 'company') {
        state.companies = state.companies.filter(c => c.id !== id);
        renderCompanies(state.companies);
      } else if (type === 'contact') {
        state.contacts = state.contacts.filter(c => c.id !== id);
        renderContacts(state.contacts);
      } else if (type === 'deal') {
        state.deals = state.deals.filter(d => d.id !== id);
        renderDeals();
      } else if (type === 'interaction') {
        state.interactions = state.interactions.filter(i => i.id !== id);
        renderInteractions();
      }
      // Refresh dashboard if visible
      if (state.currentSection === 'dashboard') loadDashboard();
    } catch (err) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    }
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

navigateTo('dashboard');
