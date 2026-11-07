/* ============================================================
   Siddheshwar Automobile — Short / Damaged Parts Tracker  v3.0
   Multi-user · Admin panel · Live sync · App lock · Activity log
   ============================================================ */

const APP_VERSION = '3.5.0';
const SUPABASE_URL = 'https://rcrjoulxjbvwqgqhcxsu.supabase.co';
// anon / public key (Supabase → Settings → API Keys)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcmpvdWx4amJ2d3FncWhjeHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjQ1MTAsImV4cCI6MjA5Njc0MDUxMH0.pbl-J6pao10rVr_YrncOMmzyJMriOGD5xXHClmjv_9U';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── DEVICE ID (one per browser) ───────────────────────────── */
const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem('sp_device_id');
    if(!id){
      id = (crypto.randomUUID ? crypto.randomUUID() : 'd-'+Date.now().toString(36)+Math.random().toString(36).slice(2,10));
      localStorage.setItem('sp_device_id', id);
    }
    return id;
  } catch(e){ return 'd-'+Date.now().toString(36); }
})();

/* ── STATE ─────────────────────────────────────────────────── */
const S = {
  searchScope: 'all',
  screen: 'login',
  user: null, role: null, token: null,
  appLocked: false, lockedBy: null,
  sheets: [], sheetsData: {}, orders: [],
  newStep: 'sheet', selectedSheet: null, query: '', expandedPart: null, _tempPartData: {},
  cart: [], editingOrder: null, _cartRestored: false,
  histSearch: '', histStatusFilter: new Set(['all']), histUser: 'all', histLimit: 50,
  statusDetailFilter: 'short', _sdQuery: '',
  adminTab: 'users', logFilter: 'all',
  users: [], devices: [], logRows: [], storage: null,
  deviceLabel: '',
};
const ADMIN_SCREENS = ['sheets', 'admin', 'reports'];

/* ── ICONS (inline SVG line icons) ─────────────────────────── */
const _i = (p, extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
const ICONS = {
  logo:    _i('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  home:    _i('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  plus:    _i('<path d="M12 5v14M5 12h14"/>'),
  history: _i('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  sheet:   _i('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  shield:  _i('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  user:    _i('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
  users:   _i('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c3 .2 5.5 2.4 5.5 5.3"/>'),
  logout:  _i('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'),
  search:  _i('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  close:   _i('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevR:   _i('<path d="m9 6 6 6-6 6"/>'),
  chevD:   _i('<path d="m6 9 6 6 6-6"/>'),
  back:    _i('<path d="M15 6l-6 6 6 6"/>'),
  save:    _i('<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h8V3"/><rect x="8" y="13" width="8" height="6" rx="1"/>'),
  edit:    _i('<path class="ic-pen" d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  tag:     _i('<path class="ic-tag" d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>'),
  download:_i('<path d="M12 4v11"/><path class="ic-arrow" d="m7 11 5 5 5-5"/><path d="M4 20h16"/>'),
  file:    _i('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path class="ic-lines" d="M9 13h6M9 17h6"/>'),
  trash:   _i('<path class="ic-lid" d="M4 7h16M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
  lock:    _i('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  unlock:  _i('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>'),
  key:     _i('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>'),
  eye:     _i('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff:  _i('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  copy:    _i('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  power:   _i('<path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>'),
  phone:   _i('<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  desktop: _i('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  tablet:  _i('<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  activity:_i('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  database:_i('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
  refresh: _i('<path d="M20 11a8 8 0 0 0-14.3-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.5L21 15"/><path d="M21 20v-5h-5"/>'),
  check:   _i('<path d="m5 12 5 5 9-10"/>'),
  alert:   _i('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>'),
  info:    _i('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  box:     _i('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>'),
  truck:   _i('<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  receipt: _i('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  calendar:_i('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  menu:    _i('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  upload:  _i('<path d="M12 16V5"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>'),
  restore: _i('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  sparkle: _i('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  chart:   _i('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  wand:    _i('<path d="m4 20 11-11M14 4v2M19 9h2M17.5 5.5 19 4M9 4l1 2M19 14l-2-1"/>'),
  dots:    _i('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'),
  status_short:   _i('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M12 9v4M12 16v.5"/>'),
  status_damaged: _i('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m9 10 2 3-2 3M15 10l-2 3 2 3"/>'),
  status_received:_i('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>'),
  status_wrong:   _i('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M9.5 10a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1V14M12 17v.3"/>'),
};

const STATUS = {
  all:      { label:'All Parts',      short:'All',      color:'#4B3FD1', bg:'#EEEDFD', border:'#CDC8FB', text:'#382EA8', icon:'box' },
  short:    { label:'Short Parts',    short:'Short',    color:'#F59E0B', bg:'#FFF8EB', border:'#FDE3A7', text:'#92400E', icon:'status_short' },
  damaged:  { label:'Damaged Parts',  short:'Damaged',  color:'#EF4444', bg:'#FEF2F2', border:'#FECACA', text:'#991B1B', icon:'status_damaged' },
  received: { label:'Received Parts', short:'Received', color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0', text:'#065F46', icon:'status_received' },
  wrong:    { label:'Wrong Items',    short:'Wrong',    color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE', text:'#5B21B6', icon:'status_wrong' },
};
const PART_STATUSES = ['short','damaged','received','wrong'];

/* ── HELPERS ───────────────────────────────────────────────── */
const app = document.getElementById('app');
function fmt(n)  { return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtI(n) { return Number(n||0).toLocaleString('en-IN'); }
function fmtDate(d){ if(!d) return '-'; const x = parseDateLocal(d); return isNaN(x) ? '-' : x.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function fmtDateTime(t){ const x = new Date(t); return isNaN(x) ? '' : x.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }
function fmtDMY(d){ const x = parseDateLocal(d); if(isNaN(x)) return String(d||''); return String(x.getDate()).padStart(2,'0')+'/'+String(x.getMonth()+1).padStart(2,'0')+'/'+x.getFullYear(); }
// "2026-11-04" must be read as a LOCAL date (new Date('2026-11-04') is UTC midnight → wrong day in some zones)
function parseDateLocal(d){
  if(d instanceof Date) return d;
  const s = String(d||'');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  return new Date(s);
}
function localISODate(d=new Date()){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
/* Escape text and wrap the part that matches the search in <mark>.
   Matching ignores case, and ignores dashes/spaces when the plain text doesn't match
   (so "son723" highlights "SON-723"). */
const markMatch = (t, q) => hl(t, q);
function hl(text, q){
  text = String(text ?? ''); q = String(q ?? '').trim();
  if(!q || !text) return esc(text);
  const low = text.toLowerCase(), ql = q.toLowerCase();
  let s = low.indexOf(ql), e = s >= 0 ? s + ql.length : -1;
  if(s < 0){
    const qc = ql.replace(/[-\s]/g,''); if(!qc) return esc(text);
    const map = []; let norm = '';
    for(let i=0;i<low.length;i++) if(!/[-\s]/.test(low[i])){ map.push(i); norm += low[i]; }
    const k = norm.indexOf(qc); if(k < 0) return esc(text);
    s = map[k]; e = map[k+qc.length-1] + 1;
  }
  return esc(text.slice(0,s)) + '<mark class="hl">' + esc(text.slice(s,e)) + '</mark>' + esc(text.slice(e));
}
function esc(s)  { return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function num(v)  { if(typeof v==='number') return isFinite(v)?v:0; const n=parseFloat(String(v??'').replace(/[,₹\s]/g,'')); return isFinite(n)?n:0; }
function qtyOf(p){ return Math.max(1, parseInt(p?.qty)||1); }
function timeAgo(t){
  const d = new Date(t); const s = (Date.now()-d.getTime())/1000;
  if(s < 45) return 'just now';
  if(s < 3600) return Math.round(s/60)+' min ago';
  if(s < 86400) return Math.round(s/3600)+'h ago';
  const days = Math.floor((new Date(localISODate()) - new Date(localISODate(d)))/86400000);
  if(days <= 1) return 'yesterday';
  if(days < 7) return days+' days ago';
  return fmtDate(d);
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function isDraft(o){ return String(o?.invoice_no||'').toUpperCase().startsWith('DRAFT'); }
function isAdmin(){ return S.role === 'admin'; }
function plural(n, w){ return `${fmtI(n)} ${w}${n===1?'':'s'}`; }
function initials(n){ return String(n||'?').trim().slice(0,1).toUpperCase(); }
function statusBadge(s, small){
  const c = STATUS[s] || STATUS.short;
  const name = c.short==='Wrong'?'Wrong Item':c.short;
  return `<span class="badge st-${s||'short'} ${small?'badge-sm':''}" title="${name}"><span class="dot"></span><span class="b-txt">${name}</span></span>`;
}
function partTotals(p){
  const q = qtyOf(p);
  return { a: num(p.actual_mrp)*q, p: num(p.printed_mrp)*q, i: num(p.invoice_mrp)*q, q };
}
function orderTotals(parts){
  return (parts||[]).reduce((t,p)=>{ const x=partTotals(p); t.actual+=x.a; t.printed+=x.p; t.invoice+=x.i; t.units+=x.q; return t; },{actual:0,printed:0,invoice:0,units:0});
}
function withTotals(p){ const x = partTotals(p); return {...p, qty:x.q, total_actual:x.a, total_printed:x.p, total_invoice:x.i}; }
function prefersReducedMotion(){ return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

/* ── TOAST ─────────────────────────────────────────────────── */
let _toastTimer = null;
function toast(msg, type='success'){
  clearTimeout(_toastTimer);
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  const ic = type==='error' ? ICONS.alert : type==='info' ? ICONS.info : ICONS.check;
  t.className = 'toast toast-'+type + (document.querySelector('.modal-ov') ? ' toast-top' : '');
  t.innerHTML = `<span class="toast-ic">${ic}</span><span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  _toastTimer = setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 260); }, 3200);
}

/* ── TOP PROGRESS BAR ──────────────────────────────────────── */
let _progTimer = null;
function progress(on){
  let bar = document.getElementById('top-progress');
  if(!bar){ bar = document.createElement('div'); bar.id='top-progress'; document.body.appendChild(bar); }
  clearTimeout(_progTimer);
  if(on){ bar.className='run'; }
  else { bar.className='done'; _progTimer=setTimeout(()=>{ bar.className=''; }, 400); }
}

/* ── BUTTON BUSY STATE ─────────────────────────────────────── */
function setBusy(btn, busy, label){
  if(!btn) return;
  if(busy){ btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span>${label?'<span>'+esc(label)+'</span>':''}`; btn.disabled = true; }
  else { if(btn.dataset.label) btn.innerHTML = btn.dataset.label; btn.disabled = false; }
}

/* ── MODALS (bottom sheet on phones, centred card on desktop) ─ */
function openModal({ title='', sub='', icon='', tone='brand', body='', footer='', size='md', dismissable=true, onClose=null, cls='' }){
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `
    <div class="modal modal-${size} ${cls}" role="dialog" aria-modal="true">
      <div class="modal-grab"></div>
      ${title ? `<div class="modal-head">
        ${icon ? `<div class="modal-ic tone-${tone}">${ICONS[icon]||icon}</div>` : ''}
        <div class="modal-titles"><div class="modal-title">${title}</div>${sub?`<div class="modal-sub">${sub}</div>`:''}</div>
        ${dismissable ? `<button class="icon-btn modal-x" aria-label="Close">${ICONS.close}</button>` : ''}
      </div>` : ''}
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if(closed) return; closed = true;
    ov.classList.add('closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(()=>{ ov.remove(); if(!document.querySelector('.modal-ov')) document.body.classList.remove('modal-open'); }, 200);
    onClose && onClose();
  };
  const onKey = e => { if(e.key==='Escape' && dismissable) close(); };
  document.addEventListener('keydown', onKey);
  if(dismissable){
    ov.addEventListener('mousedown', e => { if(e.target===ov) close(); });
    ov.querySelector('.modal-x')?.addEventListener('click', close);
  }
  const q = sel => ov.querySelector(sel);
  return { root: ov, close, q };
}

function showNotice({ tone='brand', icon='info', title='', body='', button='OK' }){
  return new Promise(res=>{
    const m = openModal({ title, icon, tone, size:'sm', body:`<div class="notice-body">${body}</div>`,
      footer:`<button class="btn btn-primary btn-block" data-ok>${esc(button)}</button>`, onClose:()=>res() });
    m.q('[data-ok]').onclick = m.close;
    setTimeout(()=>m.q('[data-ok]')?.focus(), 50);
  });
}

function confirmDialog({ title, body, confirm='Confirm', tone='danger', icon='alert', typeToConfirm=null }){
  return new Promise(res=>{
    let answered = false;
    const m = openModal({ title, icon, tone, size:'sm',
      body:`<div class="notice-body">${body}</div>${typeToConfirm?`<label class="field-label" style="margin-top:14px">Type <b>${esc(typeToConfirm)}</b> to confirm</label><input class="field" data-type autocomplete="off"/>`:''}`,
      footer:`<button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-${tone==='danger'?'danger-solid':'primary'}" data-yes ${typeToConfirm?'disabled':''}>${esc(confirm)}</button>`,
      onClose:()=>{ if(!answered) res(false); } });
    const yes = m.q('[data-yes]');
    m.q('[data-no]').onclick = m.close;
    yes.onclick = ()=>{ answered = true; res(true); m.close(); };
    const ti = m.q('[data-type]');
    if(ti){ ti.oninput = ()=>{ yes.disabled = ti.value.trim() !== typeToConfirm; }; setTimeout(()=>ti.focus(),60); }
  });
}

/* ── APP LOCK WRITE GUARD ───────────────────────────────────────
   Every change to short_orders / sheets / parts goes through
   sb.from(...). While the admin has locked the app, any such change
   by a normal user is stopped here (nothing reaches the database),
   the user is logged out and told why. Reads are not affected. ── */
const LOCK_GUARDED_TABLES = new Set(['short_orders','sheets','parts']);
function lockBlocksMe(){ return !!(S.appLocked && S.user && !isAdmin()); }
function lockedResult(){
  const res = Promise.resolve({ data:null, error:{ message:'The app is locked by the admin', code:'APP_LOCKED' } });
  const chain = new Proxy(function(){}, {
    get(_, prop){
      if(prop==='then') return res.then.bind(res);
      if(prop==='catch') return res.catch.bind(res);
      if(prop==='finally') return res.finally.bind(res);
      return () => chain;
    },
  });
  return chain;
}
const _sbFrom = sb.from.bind(sb);
sb.from = (table) => {
  const qb = _sbFrom(table);
  if(!LOCK_GUARDED_TABLES.has(table)) return qb;
  ['insert','update','upsert','delete'].forEach(m=>{
    const orig = qb[m].bind(qb);
    qb[m] = (...args) => {
      if(lockBlocksMe()){ setTimeout(handleLockedAttempt, 0); return lockedResult(); }
      return orig(...args);
    };
  });
  return qb;
};

/* ── SESSION ───────────────────────────────────────────────── */
function setSession(user, role, token){
  S.user = user; S.role = role; S.token = token || S.token;
  try {
    localStorage.setItem('sp_session', JSON.stringify({ user, role, token: S.token, at: Date.now() }));
  } catch(e){}
}
function readStoredSession(){
  try { const s = JSON.parse(localStorage.getItem('sp_session')||'null'); return s && s.token ? s : null; } catch(e){ return null; }
}
function clearStoredSession(){
  try { localStorage.removeItem('sp_session'); ['sp_session_user','sp_session_time','sp_user','sp_pass'].forEach(k=>localStorage.removeItem(k)); } catch(e){}
}
function isMissingFunction(err){
  return err && (err.code==='PGRST202' || err.code==='42883' || /could not find the function|does not exist/i.test(err.message||''));
}

// 'valid' | 'invalid' | 'unknown' (network problem — never locks anyone out)
async function checkSession(){
  const token = S.token;
  if(!token) return 'invalid';
  try {
    const { data, error } = await sb.rpc('app_session_check', { p_token: token });
    if(error) return 'unknown';
    if(!data || !data.length) return 'invalid';
    const row = data[0];
    if(S.user && (row.user_name !== S.user || row.user_role !== S.role)) applyIdentityChange(row.user_name, row.user_role);
    return 'valid';
  } catch(e){ return 'unknown'; }
}
function applyIdentityChange(name, role){
  const roleChanged = role !== S.role;
  const nameChanged = name !== S.user;
  setSession(name, role, S.token);
  if(nameChanged) toast(`Your username is now "${name}"`, 'info');
  if(roleChanged) toast(role==='admin' ? 'You are now an admin' : 'Your admin access was removed', 'info');
  if(roleChanged && !isAdmin() && ADMIN_SCREENS.includes(S.screen)) { setScreen('home'); return; }
  loadOrders().then(()=>{ if(S.screen!=='login') renderShell(); });
}

/* ── ACTIVITY LOG (written through the database, user is stamped server-side) */
function logActivity(type, action, entityId, entityName, details, before=null, after=null){
  if(!S.token) return;
  sb.rpc('app_log', {
    p_token: S.token, p_device_id: DEVICE_ID, p_type: type, p_action: action,
    p_entity_id: entityId==null ? null : String(entityId), p_entity_name: entityName ?? null,
    p_details: details ?? null, p_before: before, p_after: after,
  }).then(({error})=>{ if(error) console.warn('[log]', error.message); }, ()=>{});
}

/* ── DEVICE DETECTION + HEARTBEAT ──────────────────────────── */
async function detectDevice(){
  const ua = navigator.userAgent || '';
  let os = 'Device', browser = 'Browser', type = 'desktop', model = '';
  if(/Android/i.test(ua)) { os='Android'; type = /Mobile/i.test(ua) ? 'phone' : 'tablet'; const m = ua.match(/Android [\d.]+; ([^;)]+)/); if(m && !/^K$/.test(m[1].trim())) model = m[1].trim(); }
  else if(/iPhone/i.test(ua)) { os='iPhone'; type='phone'; }
  else if(/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) { os='iPad'; type='tablet'; }
  else if(/Windows/i.test(ua)) os='Windows';
  else if(/Mac OS X/i.test(ua)) os='Mac';
  else if(/CrOS/i.test(ua)) os='ChromeOS';
  else if(/Linux/i.test(ua)) os='Linux';
  if(/Edg\//.test(ua)) browser='Edge'; else if(/OPR\//.test(ua)) browser='Opera';
  else if(/SamsungBrowser/.test(ua)) browser='Samsung Internet'; else if(/Chrome\//.test(ua)) browser='Chrome';
  else if(/Firefox\//.test(ua)) browser='Firefox'; else if(/Safari\//.test(ua)) browser='Safari';
  try {
    if(navigator.userAgentData?.getHighEntropyValues){
      const h = await navigator.userAgentData.getHighEntropyValues(['platformVersion','model']);
      if(os==='Windows' && h.platformVersion){ os = parseInt(h.platformVersion.split('.')[0]) >= 13 ? 'Windows 11' : 'Windows 10'; }
      if(h.model) model = h.model;
      if(navigator.userAgentData.mobile) type = 'phone';
    }
  } catch(e){}
  const label = [model || os, browser].filter(Boolean).join(' · ');
  return { label, type, ua };
}
let _devInfo = null, _hbTimer = null;
async function registerDeviceSession(){
  if(!S.token) return;
  if(!_devInfo) _devInfo = await detectDevice();
  if(!S.deviceLabel) S.deviceLabel = _devInfo.label;
  try {
    await sb.rpc('app_device_heartbeat', { p_token:S.token, p_device_id:DEVICE_ID, p_label:_devInfo.label, p_type:_devInfo.type, p_ua:_devInfo.ua });
  } catch(e){}
  clearInterval(_hbTimer);
  _hbTimer = setInterval(()=>{ if(S.token && !document.hidden) sb.rpc('app_device_heartbeat', { p_token:S.token, p_device_id:DEVICE_ID, p_label:_devInfo.label, p_type:_devInfo.type, p_ua:_devInfo.ua }).then(()=>{},()=>{}); }, 60000);
}
function deviceDisplayName(){ return S.deviceLabel || _devInfo?.label || 'this device'; }
function setDeviceLabel(custom){ S.deviceLabel = custom || _devInfo?.label || ''; }
/* ── DATA LOADING ──────────────────────────────────────────── */
function sortOrders(list){
  return list.sort((a,b)=>{
    const d = String(b.invoice_date||'').localeCompare(String(a.invoice_date||''));
    if(d) return d;
    const c = String(b.created_at||'').localeCompare(String(a.created_at||''));
    return c || (b.id - a.id);
  });
}
function ordersSignature(list){ return list.map(o=>o.id+':'+(o.updated_at||'')).join('|'); }

// Pages through results — a plain select is capped at 1,000 rows by Supabase
async function loadOrders(){
  if(!S.user){ S.orders = []; return false; }
  try {
    let all = [], from = 0; const CHUNK = 1000;
    while(true){
      let q = sb.from('short_orders').select('*').order('invoice_date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false});
      if(!isAdmin()) q = q.eq('created_by', S.user);
      const { data, error } = await q.range(from, from+CHUNK-1);
      if(error) { console.warn('[loadOrders]', error.message); return false; }   // keep what we had
      all = all.concat(data||[]);
      if(!data || data.length < CHUNK) break;
      from += CHUNK;
    }
    const changed = ordersSignature(all) !== ordersSignature(S.orders);
    S.orders = all;
    try { idle(()=>localStorage.setItem('sp_orders_cache', JSON.stringify({ user:S.user, orders: all.slice(0,400) }))); } catch(e){}
    return changed;
  } catch(e){ return false; }
}
// Cheap consistency check: compares only (id, updated_at) with the database.
// If anything differs (a missed live update, another device, a network blip) → full reload.
let _lastVerify = 0;
async function verifyOrders(force){
  if(!S.user) return false;
  if(!force && Date.now()-_lastVerify < 15000) return false;
  _lastVerify = Date.now();
  try {
    let all = [], from = 0;
    while(true){
      let q = sb.from('short_orders').select('id,updated_at').order('id',{ascending:true});
      if(!isAdmin()) q = q.eq('created_by', S.user);
      const { data, error } = await q.range(from, from+999);
      if(error) return false;
      all = all.concat(data||[]);
      if(!data || data.length < 1000) break;
      from += 1000;
    }
    const fp = list => list.map(o=>o.id+':'+(Date.parse(o.updated_at)||0)).sort().join('|');
    if(fp(all) === fp(S.orders)) return false;
    const changed = await loadOrders();
    if(changed){ await reconcileEditingOrder(); softRefresh('orders'); }
    return changed;
  } catch(e){ return false; }
}
let _lastSheetsLoad = 0;
function maybeLoadSheets(screen){
  if(Date.now()-_lastSheetsLoad < 30000 && S.sheets.length) return;
  _lastSheetsLoad = Date.now();
  loadSheets().then(()=>{ if(S.screen===screen) softRefresh('sheets'); });
}
function restoreOrdersCache(){
  try {
    const c = JSON.parse(localStorage.getItem('sp_orders_cache')||'null');
    if(c && c.user === S.user && Array.isArray(c.orders)) S.orders = c.orders;
  } catch(e){}
}
async function loadSheets(){
  try {
    const { data, error } = await sb.from('sheets').select('*').order('created_at',{ascending:false});
    if(!error && data) S.sheets = data;
  } catch(e){}
}
async function loadAppLock(){
  try {
    const { data, error } = await sb.from('app_settings').select('*').eq('id',1).maybeSingle();
    if(!error && data) applyLockState(data);
  } catch(e){}
}
function applyLockState(row){
  const was = S.appLocked;
  S.appLocked = !!row.locked; S.lockedBy = row.locked_by || null;
  renderLockBanner();
  if(was !== S.appLocked && S.user){
    if(S.appLocked && !isAdmin()) toast('The admin has locked the app — you can view, but changes are paused', 'error');
    if(!S.appLocked && was) toast('The app is unlocked — you can make changes again', 'success');
    if(S.screen==='admin') renderPage();
  }
}
function idle(fn){ (window.requestIdleCallback || (f=>setTimeout(f, 60)))(()=>{ try{ fn(); }catch(e){} }); }

/* ── PARTS CATALOGUE (cached per sheet) ────────────────────── */
function searchKey(p){
  if(p._k === undefined){
    const code = String(p.part_code||'').toLowerCase(), alt = String(p.alt_code||'').toLowerCase();
    Object.defineProperty(p, '_k', { value: code+'\u0001'+code.replace(/[-\s]/g,'')+'\u0001'+alt+'\u0001'+alt.replace(/[-\s]/g,'')+'\u0001'+String(p.description||'').toLowerCase(), enumerable:false });
  }
  return p._k;
}
// The in-memory copy is dropped; the saved copy is re-checked against part_count
// on next use (and topped up with just the new parts when only additions happened).
function invalidateSheetCache(id){
  delete S.sheetsData[id];
  if(!S.sheets.some(s=>String(s.id)===String(id))) idbDel('p_'+id);   // sheet removed
}
/* Parts catalogue cache — IndexedDB (localStorage tops out at ~5 MB, too small
   for a 60k+ part catalogue, so the old cache silently failed and re-downloaded). */
const _idb = { db:null, p:null };
function idbOpen(){
  if(_idb.p) return _idb.p;
  _idb.p = new Promise(res=>{
    try {
      const r = indexedDB.open('sa-parts', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('sheets');
      r.onsuccess = () => res(_idb.db = r.result);
      r.onerror = r.onblocked = () => res(null);
    } catch(e){ res(null); }
  });
  return _idb.p;
}
async function idbGet(k){
  const db = await idbOpen(); if(!db) return null;
  return new Promise(res=>{ try { const r = db.transaction('sheets').objectStore('sheets').get(k); r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null); } catch(e){ res(null); } });
}
async function idbSet(k, v){
  const db = await idbOpen(); if(!db) return;
  return new Promise(res=>{ try { const t = db.transaction('sheets','readwrite'); t.objectStore('sheets').put(v, k); t.oncomplete=t.onerror=t.onabort=()=>res(); } catch(e){ res(); } });
}
async function idbDel(k){
  const db = await idbOpen(); if(!db) return;
  try { db.transaction('sheets','readwrite').objectStore('sheets').delete(k); } catch(e){}
}
// one-time clean-up of the old (often half-written) localStorage cache
try { Object.keys(localStorage).filter(k=>k.startsWith('sp_parts_')).forEach(k=>localStorage.removeItem(k)); } catch(e){}

const PART_COLS = ['id','part_code','alt_code','description','price','hsn_no','is_blocked'];
function unpackParts(rows, sheetId){
  const out = new Array(rows.length);
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    out[i] = { id:r[0], sheet_id:sheetId, part_code:r[1], alt_code:r[2]||'', description:r[3]||'', price:Number(r[4])||0, hsn_no:r[5]||'', is_blocked:r[6]||'N' };
  }
  return out;
}
const packParts = list => list.map(p=>[p.id,p.part_code,p.alt_code,p.description,p.price,p.hsn_no,p.is_blocked]);

// Run async jobs with a fixed number in flight
async function pool(jobs, n){
  const res = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({length:Math.min(n, jobs.length)}, async ()=>{ while(i < jobs.length){ const k = i++; res[k] = await jobs[k](); } }));
  return res;
}

let _rpcParts = null;   // null = unknown, false = function not installed (old setup.sql)
const _partsLoading = {};
function loadParts(sheetId, onProgress){
  const key = String(sheetId);
  if(S.sheetsData[sheetId]) return Promise.resolve(S.sheetsData[sheetId]);
  if(_partsLoading[key]){                     // already on its way (e.g. background prefetch) → share it
    if(onProgress) _partsLoading[key].listeners.push(onProgress);
    return _partsLoading[key].p;
  }
  const job = { listeners: onProgress ? [onProgress] : [] };
  const report = (n,t) => job.listeners.forEach(f=>{ try { f(n,t); } catch(e){} });
  job.p = _loadPartsNow(sheetId, report).finally(()=>{ delete _partsLoading[key]; });
  _partsLoading[key] = job;
  return job.p;
}
async function _loadPartsNow(sheetId, report){
  const sheet = S.sheets.find(s=>String(s.id)===String(sheetId));
  if(sheet) sheetId = sheet.id;
  const ck = 'p_'+sheetId;
  const c = await idbGet(ck);
  const fresh = c && c.rows?.length && (Date.now()-c.savedAt) < 14*86400000;
  if(fresh && (!sheet || c.part_count === sheet.part_count)){
    return (S.sheetsData[sheetId] = unpackParts(c.rows, sheetId));
  }
  // Parts were only added since the save → download just the new ones
  if(fresh && sheet && sheet.part_count > c.part_count && sheet.part_count - c.part_count <= 5000){
    try {
      let maxId = 0; for(const r of c.rows) if(r[0] > maxId) maxId = r[0];
      const { data, error } = await sb.from('parts').select(PART_COLS.join(',')).eq('sheet_id', sheetId).gt('id', maxId).order('id',{ascending:true}).limit(5000);
      if(!error && c.rows.length + (data||[]).length === sheet.part_count){
        const rows = c.rows.concat((data||[]).map(p=>[p.id,p.part_code,p.alt_code,p.description,p.price,p.hsn_no,p.is_blocked]));
        idle(()=>idbSet(ck, { rows, part_count: sheet.part_count, savedAt: Date.now() }));
        return (S.sheetsData[sheetId] = unpackParts(rows, sheetId));
      }
    } catch(e){}
  }
  const total = sheet?.part_count || 0;
  let rows = null, done = 0;
  const bump = n => { done += n; report(done, total); };

  // 1) fast path — compact chunks of 20,000 from app_sheet_parts, 4 at a time
  if(_rpcParts !== false){
    try {
      const CH = 20000, chunks = Math.max(1, Math.ceil((total || CH) / CH));
      const get = off => async () => {
        const { data, error } = await sb.rpc('app_sheet_parts', { p_sheet_id: sheetId, p_offset: off, p_limit: CH });
        if(error) throw error;
        const d = data || []; bump(d.length); return d;
      };
      const parts = await pool(Array.from({length:chunks}, (_,i)=>get(i*CH)), 4);
      rows = [].concat(...parts);
      // the catalogue grew since part_count was taken → keep reading until a short chunk
      let off = chunks*CH;
      while(parts.length && parts[parts.length-1].length === CH){
        const more = await get(off)(); rows = rows.concat(more); parts.push(more); off += CH;
      }
      _rpcParts = true;
    } catch(e){
      if(e && (e.code==='PGRST202' || /Could not find the function/i.test(e.message||''))){ _rpcParts = false; rows = null; done = 0; }
      else throw e;
    }
  }
  // 2) fallback (setup.sql not re-run yet) — 1,000-row pages, 8 in parallel
  if(!rows){
    const PG = 1000, pages = Math.max(1, Math.ceil((total || PG) / PG));
    const get = from => async () => {
      const { data, error } = await sb.from('parts').select(PART_COLS.join(',')).eq('sheet_id', sheetId).order('id',{ascending:true}).range(from, from+PG-1);
      if(error) throw error;
      const d = (data||[]).map(p=>[p.id,p.part_code,p.alt_code,p.description,p.price,p.hsn_no,p.is_blocked]); bump(d.length); return d;
    };
    const parts = await pool(Array.from({length:pages}, (_,i)=>get(i*PG)), 8);
    rows = [].concat(...parts);
    let from = pages*PG;
    while(parts[parts.length-1].length === PG){ const more = await get(from)(); rows = rows.concat(more); parts.push(more); from += PG; }
  }
  // de-duplicate by id (a part added mid-download can shift an offset page)
  const seen = new Set(); rows = rows.filter(r=>!seen.has(r[0]) && seen.add(r[0]));
  const list = unpackParts(rows, sheetId);
  S.sheetsData[sheetId] = list;
  idle(()=>idbSet(ck, { rows, part_count: sheet ? sheet.part_count : rows.length, savedAt: Date.now() }));
  return list;
}
// Refresh the cached copy after a local change (part added) without a re-download
function cachePartsNow(sheetId){
  const list = S.sheetsData[sheetId]; if(!list) return;
  const sheet = S.sheets.find(s=>String(s.id)===String(sheetId));
  idle(()=>idbSet('p_'+sheetId, { rows: packParts(list), part_count: sheet ? sheet.part_count : list.length, savedAt: Date.now() }));
}
function dropCachedParts(sheetId){ delete S.sheetsData[sheetId]; idbDel('p_'+sheetId); }
// After login: quietly get the catalogue used last ready, so search opens instantly
function prefetchLastSheet(){
  let id = null; try { id = localStorage.getItem('sp_last_sheet'); } catch(e){}
  const sh = id && S.sheets.find(s=>String(s.id)===String(id));
  if(sh && !(sh.part_count<0) && !S.sheetsData[sh.id]) loadParts(sh.id).catch(()=>{});
}

/* ── LIVE SYNC (Supabase Realtime + safety net) ────────────── */
let _rt = null, _rtOk = null, _rtEver = false;
let _orderEvents = [], _changedSheetIds = new Set();
const _resyncTimers = {};
let _pollTimer = null, _sessionTimer = null;

function initRealtimeSync(){
  if(_rt) return;
  _rt = sb.channel('sa-short-parts-sync')
    .on('postgres_changes', {event:'*', schema:'public', table:'short_orders'}, p => { _orderEvents.push(p); scheduleResync('orders'); })
    .on('postgres_changes', {event:'*', schema:'public', table:'sheets'}, p => {
      const id = (p.new && p.new.id) || (p.old && p.old.id);
      if(id != null) _changedSheetIds.add(String(id));
      scheduleResync('sheets');
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'app_settings'}, p => { if(p.new && p.new.id===1) applyLockState(p.new); })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'activity_log'}, p => {
      // An admin renamed / re-passworded / disabled a user → re-check this login now
      if(p.new && (p.new.entity_type==='user') && S.user){
        checkSession().then(st=>{ if(st==='invalid' && S.user) handleSessionInvalid(); });
      }
      scheduleResync('log');
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'device_sessions'}, p => {
      if(p.new && p.new.device_id === DEVICE_ID){
        if(p.new.revoked && S.user) handleDeviceRevoked();
        else setDeviceLabel(p.new.custom_name || '');
      }
      scheduleResync('devices');
    })
    .subscribe(status => {
      const ok = status === 'SUBSCRIBED';
      if(ok && _rtEver && _rtOk === false) resyncAll();
      if(ok) _rtEver = true;
      _rtOk = ok;
      renderSyncDot();
    });
}
function stopRealtimeSync(){
  try { if(_rt) sb.removeChannel(_rt); } catch(e){}
  _rt = null; _rtOk = null; _rtEver = false;
  clearInterval(_pollTimer); clearInterval(_sessionTimer); clearInterval(_hbTimer);
}
function scheduleResync(kind){
  clearTimeout(_resyncTimers[kind]);
  _resyncTimers[kind] = setTimeout(()=>runResync(kind), 250);
}
async function runResync(kind){
  if(!S.user) return;
  if(kind==='orders'){
    const evs = _orderEvents.splice(0);
    let changed;
    if(applyOrderEvents(evs)) changed = true;
    else changed = await loadOrders();
    await reconcileEditingOrder();
    if(changed) softRefresh('orders');
  }
  else if(kind==='sheets'){
    const ids = [..._changedSheetIds]; _changedSheetIds.clear();
    await loadSheets();
    ids.forEach(id => invalidateSheetCache(id));
    if(S.screen==='new' && S.newStep==='search' && typeof ensureAllSheets==='function') setTimeout(ensureAllSheets, 0);
    if(S.selectedSheet && ids.includes(String(S.selectedSheet.id))){
      const fresh = S.sheets.find(s=>String(s.id)===String(S.selectedSheet.id));
      if(!fresh && S.screen==='new' && S.newStep==='search'){
        S.selectedSheet = null; S.newStep = 'sheet'; renderNew();
        showNotice({ tone:'warn', icon:'sheet', title:'Catalogue removed', body:'The admin removed the parts sheet you were searching. Parts already in this order are kept — choose another catalogue to add more.' });
      }
      if(fresh){
        S.selectedSheet = fresh;
        if(S.screen==='new' && S.newStep==='search') loadParts(fresh.id).then(()=>updateSugg()).catch(()=>{});
      }
    }
    softRefresh('sheets');
  }
  else if(kind==='log'){ if(S.screen==='admin' && (S.adminTab==='activity' || S.adminTab==='users')) adminReload(S.adminTab, true); }
  else if(kind==='devices'){ if(S.screen==='admin' && (S.adminTab==='devices' || S.adminTab==='users')) adminReload(S.adminTab, true); }
}
async function resyncAll(){
  if(!S.user) return;
  const st = await checkSession();
  if(st==='invalid'){ handleSessionInvalid(); return; }
  await Promise.all([loadOrders(), loadSheets(), loadAppLock()]);
  _lastVerify = Date.now(); _lastSheetsLoad = Date.now();
  await reconcileEditingOrder();
  softRefresh('all');
}
function startSafetyNet(){
  clearInterval(_pollTimer); clearInterval(_sessionTimer);
  // every 30 s: re-check login + lock; if realtime is down, re-fetch everything
  _sessionTimer = setInterval(async ()=>{
    if(!S.user || document.hidden) return;
    const st = await checkSession();
    if(st==='invalid'){ handleSessionInvalid(); return; }
    loadAppLock();
    if(_rtOk === false) resyncAll(); else verifyOrders(true);
  }, 30000);
}
window.addEventListener('online', ()=>{ if(S.user) resyncAll(); renderSyncDot(); });
window.addEventListener('offline', ()=>renderSyncDot());
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ flushPendingCartSave(); saveLocal(); }
  else if(S.user) resyncAll();
});
window.addEventListener('beforeunload', ()=>{ saveLocal(); flushPendingCartSave(); });

// Apply live order changes straight to the list. Returns false if any event
// lacks the data needed (then the caller re-downloads instead).
function applyOrderEvents(events){
  if(!events || !events.length) return false;
  const mine = o => isAdmin() || o.created_by === S.user;
  let list = S.orders.slice();
  for(const ev of events){
    const type = ev.eventType || ev.type;
    if(type==='DELETE'){
      const id = ev.old && ev.old.id;
      if(id == null) return false;
      list = list.filter(o=>o.id!==id);
    } else if(type==='INSERT' || type==='UPDATE'){
      const row = ev.new;
      if(!row || row.id==null || !Array.isArray(row.parts) || !row.invoice_date || !('created_by' in row)) return false;
      list = list.filter(o=>o.id!==row.id);
      if(mine(row)) list.push(row);
    } else return false;
  }
  S.orders = sortOrders(list);
  return true;
}

// Compares carts by content (Postgres jsonb re-orders keys, so JSON text compare lies)
function cartSignature(parts){
  return JSON.stringify((parts||[]).map(p=>[p.part_code, qtyOf(p), num(p.actual_mrp), num(p.printed_mrp), num(p.invoice_mrp), p.status||'', String(p.sr_no??''), p.dc_no||'', p.lr_no||'', p.credit_note||'']));
}

let _deletedNoticeFor = null;
async function reconcileEditingOrder(){
  if(!S.editingOrder?.id || _draftCreating) return;
  const fresh = S.orders.find(o=>o.id===S.editingOrder.id);
  if(!fresh){
    // Not in my list — really deleted, or just moved (user renamed)?
    try {
      const chk = await sb.from('short_orders').select('id').eq('id', S.editingOrder.id).limit(1);
      if(chk.error) return;
      if(chk.data && chk.data.length){ await checkSession(); return; }
    } catch(e){ return; }
    if(!S.editingOrder?.id) return;
    if(S.screen==='new') handleOrderDeletedElsewhere(S.editingOrder.id);
    else { cancelPendingCartSave(); S.editingOrder=null; S.cart=[]; clearLocalCart(); }
    return;
  }
  // Keep the name in step so a later save here doesn't rename it back
  S.editingOrder = { ...S.editingOrder, invoice_no: fresh.invoice_no, invoice_date: fresh.invoice_date, updated_at: fresh.updated_at };
  const remoteChanged = cartSignature(fresh.parts) !== cartSignature(S.editingOrder.parts);
  const localClean = !_pendingCartSave && cartSignature(S.cart) === cartSignature(S.editingOrder.parts);
  if(remoteChanged && localClean){
    S.editingOrder = { ...S.editingOrder, parts: fresh.parts||[], total_invoice_mrp: fresh.total_invoice_mrp };
    S.cart = (fresh.parts||[]).map(p=>({...p}));
    saveLocal();
    if(S.screen==='new'){
      const focused = document.activeElement && document.getElementById('step-body')?.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if(!focused){ if(S.newStep==='cart') renderCart(); else if(S.newStep==='search') updateSugg(); }
      toast('This order was updated on another device', 'info');
    }
  }
  if(S.screen==='new'){ const t = document.querySelector('.top-bar-title'); if(t && S.editingOrder) t.textContent = (isDraft(S.editingOrder)?'':'Edit #') + S.editingOrder.invoice_no; }
}

async function handleOrderDeletedElsewhere(orderId){
  if(orderId==null || _deletedNoticeFor===orderId) return;
  _deletedNoticeFor = orderId;
  const name = (S.editingOrder?.id===orderId ? S.editingOrder.invoice_no : null) || 'this order';
  cancelPendingCartSave();
  clearLocalCart();
  document.querySelectorAll('.modal-ov').forEach(o=>o.remove());
  document.body.classList.remove('modal-open');
  S.editingOrder = null; S.cart = [];
  if(S.screen==='new'){ S.newStep='sheet'; setScreen('home'); }
  let who = null;
  for(let i=0; i<8 && !who; i++){
    try {
      const { data } = await sb.from('activity_log').select('user_name,device_name').eq('entity_type','order').eq('action','deleted').eq('entity_id', String(orderId)).order('created_at',{ascending:false}).limit(1);
      if(data && data[0]) who = data[0];
    } catch(e){}
    if(!who) await new Promise(r=>setTimeout(r,300));
  }
  if(!S.user) return;
  const by = who?.user_name;
  const byText = !by ? 'Another user' : by===S.user ? `You (on ${esc(who.device_name||'another device')})` : `<b>${esc(by)}</b>`;
  showNotice({ tone:'danger', icon:'trash', title:'Order deleted',
    body:`${byText} deleted the order <b>${esc(name)}</b> while you had it open.<br><br>You've been taken back to Home. Changes not yet saved to this order were not kept.${isAdmin()?'<br><br>You can restore it from Admin → Activity.':'<br><br>If it was a mistake, ask the admin to restore it.'}` });
  setTimeout(()=>{ if(_deletedNoticeFor===orderId) _deletedNoticeFor=null; }, 5000);
}

// Redraws the current screen with fresh data — but never while someone is typing
function softRefresh(kind){
  if(!S.user || S.screen==='login') return;
  const ae = document.activeElement;
  const typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && document.getElementById('page-area')?.contains(ae);
  renderNavBadges();
  switch(S.screen){
    case 'home': renderPage(true); break;
    case 'history':
      if(typing || document.querySelector('#hist-list .edit-panel')) { S._histDirty = true; return; }
      document.getElementById('page-area')?.classList.add('no-anim'); updateHistList(); break;
    case 'statusDetail': if(!typing) renderPage(true); break;
    case 'reports': if(!typing && (kind==='orders'||kind==='all')) renderPage(true); break;
    case 'sheets': if(kind==='sheets' || kind==='all') renderPage(true); break;
    case 'new': if(S.newStep==='sheet' && (kind==='sheets'||kind==='all')) renderSheet1(); break;
    case 'admin': if(!typing && !document.querySelector('.modal-ov') && (kind==='orders'||kind==='all')) renderPage(true); break;
  }
}

/* ── FORCED SIGN-OUTS ──────────────────────────────────────── */
let _lockHandling = false;
async function handleLockedAttempt(){
  if(_lockHandling || !lockBlocksMe()) return;
  _lockHandling = true;
  cancelPendingCartSave();
  saveLocal();   // unsaved work stays on this device; it becomes a draft after unlock
  const by = S.lockedBy;
  await logoutLocal();
  await showNotice({ tone:'warn', icon:'lock', title:'App is locked',
    body:`The admin${by?' (<b>'+esc(by)+'</b>)':''} has locked the app, so changes can't be saved right now and you've been logged out.<br><br>Your unsaved parts are kept on this device and will be saved as a draft when you log in after the app is unlocked.` });
  _lockHandling = false;
}
let _invalidHandling = false;
async function handleSessionInvalid(msg){
  if(_invalidHandling || !S.user) return;
  _invalidHandling = true;
  saveLocal();
  await logoutLocal(true);
  await showNotice({ tone:'warn', icon:'key', title:'Signed out',
    body: msg || 'Your login is no longer valid — the admin may have changed your password, renamed, disabled or removed your account.<br><br>Please sign in again, or contact the admin.' });
  _invalidHandling = false;
}
function handleDeviceRevoked(){ handleSessionInvalid('The admin signed this device out.<br><br>Sign in again to continue.'); }
/* ── LOCAL (ON-DEVICE) CART — tagged with its owner ────────── */
function saveLocal(){
  try {
    if(!S.user) return;
    if(!S.cart.length){
      // Only an open editor that was emptied may clear the device copy. Otherwise an empty
      // cart just means "nothing loaded yet" — never wipe parts kept from a locked/offline session.
      if(S.screen !== 'new') return;
      const raw = JSON.parse(localStorage.getItem('sp_cart')||'null');
      if(raw && raw.owner === S.user) localStorage.removeItem('sp_cart');
      return;
    }
    localStorage.setItem('sp_cart', JSON.stringify({ owner:S.user, cart:S.cart, sheetId:S.selectedSheet?.id||null, sheetName:S.selectedSheet?.name||'', editingOrderId:S.editingOrder?.id||null, savedAt:Date.now() }));
  } catch(e){}
}
function clearLocalCart(){ try { localStorage.removeItem('sp_cart'); } catch(e){} }

// Unsaved parts left on this device (e.g. app closed, network lost, app locked)
async function restoreLocal(){
  let sv;
  try { sv = JSON.parse(localStorage.getItem('sp_cart')||'null'); } catch(e){ clearLocalCart(); return; }
  if(!sv || !sv.cart?.length) return;
  if(sv.owner !== S.user) return;                          // belongs to someone else on this device
  if((Date.now()-sv.savedAt) > 7*86400000){ clearLocalCart(); return; }
  const sheet = sv.sheetId ? (S.sheets.find(s=>s.id===sv.sheetId) || {id:sv.sheetId, name:sv.sheetName}) : null;
  if(sv.editingOrderId){
    const order = S.orders.find(o=>o.id===sv.editingOrderId);
    if(!order){ clearLocalCart(); return; }                // deleted meanwhile — don't bring it back
    if(cartSignature(order.parts) === cartSignature(sv.cart)){ clearLocalCart(); return; }   // already saved
    if(new Date(order.updated_at).getTime() > sv.savedAt){ clearLocalCart(); return; }      // newer version elsewhere
    if(lockBlocksMe()) return;
    const parts = sv.cart.map(withTotals), t = orderTotals(parts);
    const { data, error } = await sb.from('short_orders').update({ parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:new Date().toISOString() }).eq('id', order.id).select().maybeSingle();
    if(!error && data){
      Object.assign(order, data); clearLocalCart();
      logActivity('order','updated',order.id,order.invoice_no,`Restored ${parts.length} unsaved parts from this device`, {parts:order.parts}, {parts});
      S.resumeOrderId = order.id;
      toast(`Saved ${parts.length} unsaved parts to ${order.invoice_no}`, 'info');
    }
    return;
  }
  if(lockBlocksMe()) return;
  // never saved → becomes a draft now
  S.cart = sv.cart; S.selectedSheet = sheet; S.editingOrder = null;
  const d = await autoSaveNewCartAsDraft(true);
  if(d){ S.resumeOrderId = d.id; toast(`Restored ${sv.cart.length} unsaved parts as ${d.invoice_no}`, 'info'); }
  S.cart = []; S.selectedSheet = null; S.editingOrder = null;
}

/* ── SAFE AUTO-SAVE OF THE ORDER BEING EDITED ──────────────────
   Debounced 800 ms; saves a SNAPSHOT taken at the moment of the
   change, never "whatever the cart holds later".               */
let _saveTimer = null, _pendingCartSave = null, _draftTimer = null, _draftCreating = null;

function cancelPendingCartSave(){
  clearTimeout(_saveTimer); _saveTimer = null; _pendingCartSave = null;
  clearTimeout(_draftTimer); _draftTimer = null;
}
function flushPendingCartSave(){
  const run = _pendingCartSave;
  clearTimeout(_saveTimer); _saveTimer = null; _pendingCartSave = null;
  return run ? run() : Promise.resolve();
}
function scheduleOrderAutoSave(){
  clearTimeout(_saveTimer);
  const ord = S.editingOrder;
  const orderId = ord.id, name = ord.invoice_no;
  const before = { parts: ord.parts, total_invoice_mrp: ord.total_invoice_mrp };
  const partsSnap = S.cart.map(p=>withTotals(p));
  const run = () => persistOrderParts(orderId, name, partsSnap, before);
  _pendingCartSave = run;
  _saveTimer = setTimeout(()=>{ _saveTimer=null; _pendingCartSave=null; run(); }, 800);
}
async function persistOrderParts(orderId, name, parts, before){
  const t = orderTotals(parts);
  setSaveState('saving');
  try {
    const { data, error } = await sb.from('short_orders').update({
      parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:new Date().toISOString(),
    }).eq('id', orderId).select('id,updated_at');
    if(error){ setSaveState(error.code==='APP_LOCKED' ? 'idle' : 'error'); return; }
    if(!data || !data.length){
      if(S.editingOrder?.id===orderId) handleOrderDeletedElsewhere(orderId);   // never re-create a deleted order
      return;
    }
    queueOrderLog(orderId, name, before, { parts, total_invoice_mrp:t.invoice });
    if(S.editingOrder?.id===orderId){
      S.editingOrder = { ...S.editingOrder, parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:data[0].updated_at };
    }
    const o = S.orders.find(x=>x.id===orderId);
    if(o) Object.assign(o, { parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:data[0].updated_at });
    if(S.editingOrder?.id===orderId && cartSignature(S.cart)===cartSignature(parts)) clearLocalCart();
    setSaveState('saved');
  } catch(e){ setSaveState('error'); }
}

// One log entry per editing burst (keeps the FIRST "before" for restore)
const _logBuf = {};
function queueOrderLog(id, name, before, after){
  const b = _logBuf[id] || (_logBuf[id] = { before, name });
  b.after = after; b.name = name;
  clearTimeout(b.timer);
  b.timer = setTimeout(()=>flushOrderLog(id), 20000);
}
function flushOrderLog(id){
  const ids = id!=null ? [id] : Object.keys(_logBuf);
  ids.forEach(k=>{
    const b = _logBuf[k]; if(!b) return;
    clearTimeout(b.timer); delete _logBuf[k];
    logActivity('order','updated',k,b.name,`Edited — ${plural(b.after.parts.length,'part')}, ₹${fmt(b.after.total_invoice_mrp)}`, b.before, b.after);
  });
}

/* ── DRAFTS — exactly one per cart ─────────────────────────── */
function draftName(){
  const n = new Date();
  const dd = String(n.getDate()).padStart(2,'0'), mm = String(n.getMonth()+1).padStart(2,'0');
  const h12 = n.getHours()%12||12, mi = String(n.getMinutes()).padStart(2,'0');
  return `DRAFT ${dd}-${mm}-${n.getFullYear()} ${String(h12).padStart(2,'0')}:${mi} ${n.getHours()>=12?'PM':'AM'}`;
}
function autoSaveNewCartAsDraft(silent){
  if(_draftCreating) return _draftCreating;
  if(S.editingOrder?.id) return Promise.resolve(S.editingOrder);
  if(!S.cart.length || lockBlocksMe()) return Promise.resolve(null);
  _draftCreating = _createDraft(silent).finally(()=>{ _draftCreating = null; });
  return _draftCreating;
}
async function _createDraft(silent){
  const cartRef = S.cart;
  const parts = S.cart.map(withTotals), t = orderTotals(parts);
  const sheet = S.selectedSheet;
  const row = { invoice_no: draftName(), invoice_date: localISODate(), sheet_id: sheet?.id||null, sheet_name: sheet?.name||'',
    parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, created_by:S.user,
    created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
  setSaveState('saving');
  try {
    const { data, error } = await sb.from('short_orders').insert([row]).select().single();
    if(error || !data){
      setSaveState(error?.code==='APP_LOCKED'?'idle':'error');
      // not saved — make sure the parts survive on this device
      if(error?.code!=='APP_LOCKED' && S.cart !== cartRef){
        try { localStorage.setItem('sp_cart', JSON.stringify({ owner:S.user, cart:parts, sheetId:sheet?.id||null, sheetName:sheet?.name||'', editingOrderId:null, savedAt:Date.now() })); } catch(e){}
      }
      return null;
    }
    logActivity('order','created',data.id,data.invoice_no,`Draft created — ${plural(parts.length,'part')}`, null, { parts });
    if(!S.orders.some(o=>o.id===data.id)) { S.orders.push(data); sortOrders(S.orders); }
    if(S.cart === cartRef){
      S.editingOrder = data;
      saveLocal();
      if(cartSignature(S.cart) !== cartSignature(parts)) scheduleOrderAutoSave();   // parts added while saving
      else clearLocalCart();
      if(S.screen==='new'){ const t2=document.querySelector('.top-bar-title'); if(t2) t2.textContent=data.invoice_no; }
    } else {
      // user already left the editor — the copy kept on the device is now safely in the database
      try { const lc = JSON.parse(localStorage.getItem('sp_cart')||'null');
        if(lc && lc.owner===S.user && !lc.editingOrderId && cartSignature(lc.cart)===cartSignature(parts)) clearLocalCart(); } catch(e){}
    }
    setSaveState('saved');
    if(!silent) toast('Draft auto-saved to History');
    renderNavBadges();
    return data;
  } catch(e){ setSaveState('error'); return null; }
}

// Called after EVERY cart change
function schedAuto(){
  S._cartRestored = false;
  saveLocal();
  if(lockBlocksMe()){ handleLockedAttempt(); return; }
  if(S.editingOrder?.id){ scheduleOrderAutoSave(); return; }
  if(S.cart.length){
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(()=>autoSaveNewCartAsDraft(), 1000);
  }
}

/* ── SAVE STATE PILL (top bar) ─────────────────────────────── */
let _saveStateTimer = null;
function setSaveState(st){
  const el = document.getElementById('save-state'); if(!el) return;
  clearTimeout(_saveStateTimer);
  el.className = 'save-state ss-'+st;
  el.innerHTML = st==='saving' ? '<span class="spinner spinner-dark"></span>Saving…' : st==='saved' ? ICONS.check+'Saved' : st==='error' ? ICONS.alert+'Not saved — will retry' : '';
  if(st==='saved') _saveStateTimer = setTimeout(()=>{ el.className='save-state'; el.innerHTML=''; }, 2200);
  if(st==='error') _saveStateTimer = setTimeout(()=>{ if(S.editingOrder?.id && S.cart.length) scheduleOrderAutoSave(); }, 5000);
}

/* ── NAVIGATION ────────────────────────────────────────────── */
function setScreen(screen, opts={}){
  if(!S.user) return;
  if(ADMIN_SCREENS.includes(screen) && !isAdmin()) screen = 'home';
  flushPendingCartSave();
  const leavingEditor = S.screen==='new' && screen!=='new';
  const unsavedNew = leavingEditor && S.cart.length>0 && !S.editingOrder?.id;
  if(leavingEditor) flushOrderLog();
  if(unsavedNew){
    clearTimeout(_draftTimer);
    if(lockBlocksMe()) saveLocal();
    else autoSaveNewCartAsDraft();          // snapshots the cart synchronously, then saves in background
  }
  S.screen = screen;
  if(leavingEditor){ closeOrderEditor(!unsavedNew || !lockBlocksMe()); S._editReturn = null; }
  if(screen==='new' && !S.editingOrder && !opts.keep){
    S.newStep='sheet'; S.cart=[]; S.query=''; S.selectedSheet=null; S.expandedPart=null; S._tempPartData={};
  }
  dispatchScreenLoad(screen);
}
// Leaving New Order: the order is saved (or being saved), so let go of it.
function closeOrderEditor(clearLocal=true){
  S.cart = []; S.editingOrder = null; S.newStep='sheet'; S.query=''; S.selectedSheet=null; S.expandedPart=null; S._tempPartData={};
  if(clearLocal && !_draftCreating) clearLocalCart();
}
function dispatchScreenLoad(screen){
  renderShell(); scrollTop();
  // Screens open instantly from memory. Live sync keeps memory current; a cheap
  // (id, updated_at) check confirms it at most every 15 s — no full re-download per click.
  if(['home','history','statusDetail','admin','reports'].includes(screen)) verifyOrders();
  if(screen==='sheets' || screen==='new') maybeLoadSheets(screen);
  if(screen==='admin') adminReload(S.adminTab, true);
}
function scrollTop(){ window.scrollTo(0,0); document.getElementById('main-scroll')?.scrollTo(0,0); }

async function editOrder(order){
  flushPendingCartSave();                                         // saves a snapshot in the background
  if(S.cart.length && !S.editingOrder?.id) autoSaveNewCartAsDraft(true);   // snapshots synchronously
  flushOrderLog();
  const fresh = S.orders.find(o=>o.id===order.id) || order;
  S._editReturn = ['home','history','statusDetail','admin'].includes(S.screen) ? S.screen : 'home';
  S.editingOrder = { ...fresh };
  S.selectedSheet = S.sheets.find(s=>s.id===fresh.sheet_id) || (fresh.sheet_id ? { id:fresh.sheet_id, name:fresh.sheet_name } : null);
  S.cart = (fresh.parts||[]).map(p=>({...p}));
  S.newStep = 'cart'; S.query=''; S.expandedPart=null; S._tempPartData={};
  S.screen = 'new';
  dispatchScreenLoad('new');
  if(S.selectedSheet?.id && !S.sheetsData[S.selectedSheet.id]) loadParts(S.selectedSheet.id).catch(()=>{});
}
/* ── LOGIN ─────────────────────────────────────────────────── */
function renderLogin(){
  S.screen = 'login';
  app.innerHTML = `
  <div class="login-wrap">
    <section class="login-hero">
      <div class="hero-grid"></div>
      <div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>
      <div class="login-hero-inner">
        <div class="brand-row">
          <div class="brand-mark">${ICONS.logo}</div>
          <div><div class="brand-name">Siddheshwar Automobile</div><div class="brand-sub">Short / Damaged Parts Tracker</div></div>
        </div>
        <div class="login-headline">Every short &amp; damaged part,<br><span class="grad-text">tracked in real time.</span></div>
        <div class="login-copy">Invoice-wise tracking with 3-tier MRP, challans &amp; credit notes, live sync across every counter and phone.</div>
        <ul class="feature-list">
          ${[['shield','Personal logins with admin control'],['refresh','Live sync across all devices'],['receipt','Actual · Printed · Invoice MRP'],['truck','DC, LR & credit-note tracking'],['download','Excel & PDF reports'],['save','Auto-saved drafts — nothing lost']]
            .map(([i,t],k)=>`<li style="animation-delay:${.15+k*.07}s"><span>${ICONS[i]}</span>${t}</li>`).join('')}
        </ul>
      </div>
      <div class="login-foot">v${APP_VERSION} · © Siddheshwar Automobile</div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <div class="login-card-brand"><div class="brand-mark sm">${ICONS.logo}</div><div><b>Siddheshwar Automobile</b><span>Short / Damaged Parts Tracker</span></div></div>
        <h1 class="login-title">Welcome back</h1>
        <p class="login-sub">Sign in with the username and password the admin gave you.</p>
        <label class="field-label" for="li-u">Username</label>
        <div class="input-group"><span class="ig-ic">${ICONS.user}</span><input id="li-u" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Username"/></div>
        <label class="field-label" for="li-p" style="margin-top:14px">Password</label>
        <div class="input-group"><span class="ig-ic">${ICONS.lock}</span><input id="li-p" type="password" autocomplete="current-password" placeholder="Password"/>
          <button class="ig-btn" id="li-eye" type="button" aria-label="Show password">${ICONS.eye}</button></div>
        <div id="li-err" class="form-err"></div>
        <button id="li-btn" class="btn btn-primary btn-xl btn-block"><span>Sign in</span>${ICONS.chevR}</button>
        <div class="login-help">${ICONS.info}<span>New here or forgot your password? Contact the admin.</span></div>
      </div>
    </section>
  </div>`;
  const u = document.getElementById('li-u'), p = document.getElementById('li-p');
  try { const last = localStorage.getItem('sp_last_user'); if(last){ u.value = last; } } catch(e){}
  document.getElementById('li-btn').onclick = doLogin;
  p.onkeydown = e => { if(e.key==='Enter') doLogin(); };
  u.onkeydown = e => { if(e.key==='Enter') p.focus(); };
  document.getElementById('li-eye').onclick = () => { const show = p.type==='password'; p.type = show?'text':'password'; document.getElementById('li-eye').innerHTML = show?ICONS.eyeOff:ICONS.eye; };
  (u.value ? p : u).focus();
}

function doLogin(){
  const u = document.getElementById('li-u').value.trim();
  const p = document.getElementById('li-p').value;
  const err = document.getElementById('li-err');
  const btn = document.getElementById('li-btn');
  if(!u || !p){ err.textContent = 'Please enter username and password'; shake(btn); return; }
  if(btn.disabled) return;
  setBusy(btn, true, 'Signing in…');
  const reset = msg => { err.textContent = msg||''; setBusy(btn, false); };
  (async () => {
    try {
      const r = await sb.rpc('app_login2', { p_username:u, p_password:p, p_device_id:DEVICE_ID });
      if(r.error){
        if(isMissingFunction(r.error)){ reset(''); showDbSetupNeeded(); return; }
        throw r.error;
      }
      const row = (r.data && r.data[0]) || { status:'no_user' };
      if(row.status==='no_user'){
        reset(''); shake(btn);
        showNotice({ tone:'warn', icon:'users', title:'User not found', body:`There's no user named <b>${esc(u)}</b>.<br><br>Please contact the admin to add you and get your username and password.` });
        return;
      }
      if(row.status==='disabled'){
        reset('');
        showNotice({ tone:'danger', icon:'power', title:'Account disabled', body:`The account <b>${esc(u)}</b> has been disabled.<br><br>Please contact the admin.` });
        return;
      }
      if(row.status==='wrong_password'){
        const n = row.failed_today || 1;
        const pi = document.getElementById('li-p'); pi.value = ''; pi.focus(); shake(btn);
        if(n >= 3){
          reset('Incorrect password');
          showNotice({ tone:'warn', icon:'key', title:'Forgot your password?', body:`A wrong password has been entered <b>${n} times today</b> for <b>${esc(u)}</b>.<br><br>Please <b>call the admin</b> to know your password or to change it.` });
        } else reset(`Incorrect password — ${3-n} ${3-n===1?'try':'tries'} left before you're asked to call the admin`);
        return;
      }
      try { localStorage.setItem('sp_last_user', row.user_name); } catch(e){}
      setSession(row.user_name, row.user_role, row.session_token);
      registerDeviceSession();     // no need to wait for it
      logActivity('device','login',DEVICE_ID,deviceDisplayName(),`Logged in as "${row.user_name}" on ${deviceDisplayName()}`);
      await enterApp();
    } catch(e){
      reset(navigator.onLine ? 'Could not sign in — please try again' : 'No internet connection');
    }
  })();
}
function shake(el){ if(!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

async function enterApp(){
  // show the app immediately (skeleton), then fill it in
  S._booting = true; S.orders = []; S.screen = 'home';
  renderShell();
  initRealtimeSync();
  startSafetyNet();
  await Promise.all([loadSheets(), loadOrders(), loadAppLock()]);
  _lastVerify = Date.now(); _lastSheetsLoad = Date.now();
  S._booting = false;
  if(S.screen==='home') renderPage(true); else softRefresh('all');
  renderNavBadges();
  await restoreLocal();
  if(S.resumeOrderId && S.screen==='home') renderPage(true);
  if(S.appLocked && !isAdmin()) toast('The app is locked by the admin — you can view, but changes are paused','error');
  idle(()=>prefetchLastSheet());                          // catalogue used last → ready before it's needed
  if(isAdmin()) idle(()=>adminReload('users', true));     // warm the admin panel
}

function showDbSetupNeeded(){
  showNotice({ tone:'warn', icon:'database', title:'Database update needed',
    body:`This version of the app needs the new <b>setup.sql</b>.<br><br>Open Supabase → SQL Editor → paste the whole <code>setup.sql</code> → Run. Then sign in with <b>admin / admin123</b>.` });
}

async function doLogout(){
  const ok = await confirmDialog({ title:'Log out?', body:'You will need your username and password to sign in again on this device.', confirm:'Log out', tone:'brand', icon:'logout' });
  if(!ok) return;
  await flushPendingCartSave();
  if(_draftCreating) await _draftCreating;
  if(S.cart.length && !S.editingOrder?.id && !lockBlocksMe()) await autoSaveNewCartAsDraft(true);
  flushOrderLog();
  logActivity('device','logout',DEVICE_ID,deviceDisplayName(),`Logged out from ${deviceDisplayName()}`);
  try { await sb.rpc('app_logout', { p_token:S.token }); } catch(e){}
  if(S.editingOrder?.id || !S.cart.length) clearLocalCart();
  await logoutLocal();
}
async function logoutLocal(keepLocalCart){
  cancelPendingCartSave();
  stopRealtimeSync();
  document.querySelectorAll('.modal-ov').forEach(o=>o.remove());
  document.body.classList.remove('modal-open');
  Object.assign(S, { user:null, role:null, token:null, orders:[], sheetsData:{}, cart:[], editingOrder:null, selectedSheet:null,
    users:[], devices:[], logRows:[], storage:null, newStep:'sheet', histUser:'all', resumeOrderId:null, appLocked:false });
  clearStoredSession();
  renderLogin();
}

/* ── SHELL (sidebar + bottom nav on phones) ─────────────────── */
function navItems(){
  const items = [
    { id:'home',    icon:'home',    label:'Dashboard' },
    { id:'new',     icon:'plus',    label:'New Order' },
    { id:'history', icon:'history', label:'Order History' },
  ];
  const admin = isAdmin() ? [
    { id:'reports', icon:'chart',   label:'Reports' },
    { id:'sheets',  icon:'sheet',   label:'Parts Sheets' },
    { id:'admin',   icon:'shield',  label:'Admin Panel' },
  ] : [];
  return { items, admin };
}
function renderShell(){
  if(!S.user){ renderLogin(); return; }
  if(!document.querySelector('.app-layout')){
    app.innerHTML = `
    <div class="app-layout">
      <div class="sb-overlay" id="sb-ov"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sb-glow"></div>
        <div class="sb-brand">
          <div class="brand-mark">${ICONS.logo}</div>
          <div><div class="sb-brand-name">Siddheshwar</div><div class="sb-brand-sub">Automobile · Parts Tracker</div></div>
        </div>
        <nav class="sb-nav" id="sb-nav"></nav>
        <div class="sb-footer">
          <div class="sync-row" id="sync-dot"></div>
          <button class="sb-user" id="sb-user-btn"></button>
          <button class="sb-logout" id="sb-logout" title="Sign out of this device"><span class="lo-ic">${ICONS.logout}</span><span class="lo-txt">Log out</span><span class="lo-kbd">Sign out</span></button>
        </div>
      </aside>
      <div class="main-content" id="main-scroll">
        <div id="lock-banner"></div>
        <div id="page-area"></div>
      </div>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>`;
    document.getElementById('sb-ov').onclick = closeSidebar;
    document.getElementById('sb-logout').onclick = doLogout;
    document.getElementById('sb-user-btn').onclick = () => { closeSidebar(); setScreen('account'); };
  }
  const { items, admin } = navItems();
  const navBtn = n => `<button class="sb-item ${S.screen===n.id || (n.id==='home'&&S.screen==='statusDetail')?'active':''}" data-screen="${n.id}"><span class="sb-ic">${ICONS[n.icon]}</span><span class="sb-label">${n.label}</span><span class="sb-badge" data-badge="${n.id}"></span></button>`;
  document.getElementById('sb-nav').innerHTML = `
    <div class="sb-section">Workspace</div>${items.map(navBtn).join('')}
    ${admin.length ? `<div class="sb-section">Management</div>${admin.map(navBtn).join('')}` : ''}`;
  document.getElementById('sb-user-btn').innerHTML = `
    <span class="avatar">${esc(initials(S.user))}</span>
    <span class="sb-user-txt"><b>${esc(S.user)}</b><small>${isAdmin()?'Administrator':'Staff'} · ${esc(deviceDisplayName())}</small></span>
    <span class="sb-user-chev">${ICONS.chevR}</span>`;
  document.getElementById('sb-user-btn').classList.toggle('active', S.screen==='account');
  const bn = [
    { id:'home', icon:'home', label:'Home' },
    { id:'history', icon:'history', label:'History' },
    { id:'new', icon:'plus', label:'New', fab:true },
    isAdmin() ? { id:'admin', icon:'shield', label:'Admin' } : { id:'account', icon:'user', label:'Account' },
    { id:'_menu', icon:'menu', label:'Menu' },
  ];
  document.getElementById('bottom-nav').innerHTML = bn.map(n=>`
    <button class="bn-item ${n.fab?'bn-fab':''} ${S.screen===n.id||(n.id==='home'&&S.screen==='statusDetail')?'active':''}" data-screen="${n.id}">
      <span class="bn-ic">${ICONS[n.icon]}</span><span class="bn-label">${n.label}</span></button>`).join('');
  document.querySelectorAll('[data-screen]').forEach(b=>{
    b.onclick = () => {
      const sc = b.dataset.screen;
      if(sc==='_menu'){ openSidebar(); return; }
      closeSidebar();
      if(sc==='new'){ startNewOrder(); return; }
      setScreen(sc);
    };
  });
  renderNavBadges(); renderSyncDot(); renderLockBanner();
  renderPage();
}
// "New Order" always starts a fresh order; whatever was open is saved first
function startNewOrder(){
  if(S.screen==='new' && !S.cart.length && !S.editingOrder) { S.newStep='sheet'; renderPage(); return; }
  if(S.screen==='new'){
    flushPendingCartSave(); flushOrderLog();
    const unsaved = S.cart.length && !S.editingOrder?.id;
    if(unsaved){ clearTimeout(_draftTimer); if(lockBlocksMe()) saveLocal(); else autoSaveNewCartAsDraft(); }
    closeOrderEditor(!(unsaved && lockBlocksMe()));
    S.screen = 'home';
  }
  S.editingOrder = null; S._editReturn = null;
  setScreen('new');
}
function openSidebar(){ document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sb-ov')?.classList.add('visible'); }
function closeSidebar(){ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sb-ov')?.classList.remove('visible'); }
function renderNavBadges(){
  const drafts = S.orders.filter(isDraft).length;
  document.querySelectorAll('[data-badge="history"]').forEach(b=>{ b.textContent = drafts ? String(drafts) : ''; b.title = drafts ? plural(drafts,'draft') : ''; b.style.display = drafts?'':'none'; });
  document.querySelectorAll('[data-badge]:not([data-badge="history"])').forEach(b=>b.style.display='none');
}
function renderSyncDot(){
  const el = document.getElementById('sync-dot'); if(!el) return;
  const off = !navigator.onLine;
  const st = off ? ['off','Offline — changes sync when back'] : _rtOk ? ['on','Live sync on'] : _rtOk===false ? ['warn','Reconnecting…'] : ['warn','Connecting…'];
  el.className = 'sync-row sync-'+st[0];
  el.innerHTML = `<span class="pulse-dot"></span><span>${st[1]}</span>`;
}
function renderLockBanner(){
  const el = document.getElementById('lock-banner'); if(!el) return;
  if(!S.appLocked || !S.user){ el.innerHTML=''; el.className=''; return; }
  if(isAdmin()){
    el.className = 'lock-banner lock-admin';
    el.innerHTML = `<span class="lb-ic">${ICONS.lock}</span><span><b>App locked</b> — staff can only view. You can still make changes.</span><button class="btn btn-sm btn-white" id="lb-unlock">${ICONS.unlock}Unlock</button>`;
    document.getElementById('lb-unlock').onclick = () => setAppLock(false);
  } else {
    el.className = 'lock-banner lock-user';
    el.innerHTML = `<span class="lb-ic">${ICONS.lock}</span><span><b>Locked by the admin</b>${S.lockedBy?' ('+esc(S.lockedBy)+')':''} — you can look around, but changes are paused.</span>`;
  }
}

// soft = live refresh from another device: redraw quietly (no entrance animations / counters)
function renderPage(soft){
  const area = document.getElementById('page-area');
  if(!area) return;
  S._soft = !!soft;
  if(soft) area.classList.add('no-anim');
  else { area.classList.remove('no-anim','page-enter'); void area.offsetWidth; area.classList.add('page-enter'); }
  switch(S.screen){
    case 'home':         renderHome(area); break;
    case 'statusDetail': renderStatusDetail(area); break;
    case 'new':          renderNew(area); break;
    case 'history':      renderHistory(area); break;
    case 'sheets':       renderSheets(area); break;
    case 'admin':        renderAdmin(area); break;
    case 'reports':      renderReports(area); break;
    case 'account':      renderAccount(area); break;
    default:             renderHome(area);
  }
}

/* ── TOP BAR ───────────────────────────────────────────────── */
function topBar(title, sub='', back=false, right=''){
  return `
  <header class="top-bar">
    <button class="icon-btn tb-menu" onclick="openSidebar()" aria-label="Menu">${ICONS.menu}</button>
    ${back ? `<button class="icon-btn tb-back" id="tb-back" aria-label="Back">${ICONS.back}</button>` : ''}
    <div class="tb-titles"><div class="top-bar-title">${title}</div>${sub?`<div class="top-bar-sub">${sub}</div>`:''}</div>
    <div class="tb-right">${right}</div>
  </header>`;
}
/* ── HOME / DASHBOARD ──────────────────────────────────────── */
function statusStats(orders){
  const st = { short:{n:0,v:0}, damaged:{n:0,v:0}, received:{n:0,v:0}, wrong:{n:0,v:0} };
  orders.forEach(o=>(o.parts||[]).forEach(p=>{ const s = st[p.status] || st.short; s.n++; s.v += partTotals(p).i; }));
  return st;
}
function greeting(){ const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; }

function renderHome(area){
  const now = new Date();
  const thisMonth = S.orders.filter(o=>{ const d = parseDateLocal(o.invoice_date||o.created_at); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const st = statusStats(S.orders);
  const pendingVal = st.short.v + st.damaged.v + st.wrong.v;
  const drafts = S.orders.filter(o=>isDraft(o) && o.created_by===S.user);
  const resume = S.resumeOrderId ? S.orders.find(o=>o.id===S.resumeOrderId) : drafts[0];
  const recent = S.orders.slice(0,6);
  const cards = [
    { k:'all', label:'Total Orders', n:S.orders.length, sub:`${thisMonth.length} this month`, ic:'receipt' },
    { k:'short', label:'Short Parts', n:st.short.n, sub:'₹'+fmt(st.short.v), ic:STATUS.short.icon },
    { k:'damaged', label:'Damaged', n:st.damaged.n, sub:'₹'+fmt(st.damaged.v), ic:STATUS.damaged.icon },
    { k:'received', label:'Received', n:st.received.n, sub:'₹'+fmt(st.received.v), ic:STATUS.received.icon },
    { k:'wrong', label:'Wrong Items', n:st.wrong.n, sub:'₹'+fmt(st.wrong.v), ic:STATUS.wrong.icon },
  ];
  area.innerHTML = `
  ${topBar('Dashboard', esc(greeting())+', '+esc(S.user), false, `<button class="btn btn-primary btn-md hide-sm" id="hn-btn">${ICONS.plus}<span>New Order</span></button>`)}
  <div class="page-body">
    <section class="hero anim-up">
      <div class="hero-grid"></div><div class="hero-scan"></div>
      <div class="orb orb-1"></div><div class="orb orb-2"></div>
      <div class="hero-content">
        <div class="hero-eyebrow"><span class="live-chip"><span class="pulse-dot"></span>LIVE</span> SIDDHESHWAR AUTOMOBILE</div>
        <div class="hero-title">Short &amp; Damaged<br>Parts Control Center</div>
        <div class="hero-sub">${isAdmin()?'All staff orders':'Your orders'} · ${plural(thisMonth.length,'invoice')} this month</div>
        <div class="hero-actions">
          <button class="btn btn-white btn-md" id="hn-btn2">${ICONS.plus}<span>Create Order</span></button>
          <button class="btn btn-glass btn-md" id="hn-hist">${ICONS.history}<span>History</span></button>
        </div>
      </div>
      <div class="hero-metric">
        <div class="hm-label">Pending value</div>
        <div class="hm-val">₹<span data-count="${pendingVal}" data-dec="2">${fmt(pendingVal)}</span></div>
        <div class="hm-sub">Short + damaged + wrong (invoice MRP)</div>
      </div>
    </section>

    ${resume ? `
    <button class="resume-card anim-up1" id="resume-btn" data-id="${resume.id}">
      <span class="resume-ic">${ICONS.edit}</span>
      <span class="resume-txt"><b>Continue where you left off</b><small>${esc(resume.invoice_no)} · ${plural((resume.parts||[]).length,'part')} · ₹${fmt(resume.total_invoice_mrp)}</small></span>
      <span class="resume-go">Open ${ICONS.chevR}</span>
    </button>` : ''}

    <div class="stats-row anim-up1">
      ${cards.map((c,i)=>`
        <button class="stat-card st-card-${c.k}" data-status="${c.k}" style="animation-delay:${.05+i*.05}s">
          <div class="stat-top"><span class="stat-ic">${ICONS[c.ic]}</span><span class="stat-arrow">${ICONS.chevR}</span></div>
          <div class="stat-val" data-count="${S._booting?0:c.n}">${S._booting?'<span class="skel-line w50"></span>':fmtI(c.n)}</div>
          <div class="stat-label">${c.label}</div>
          <div class="stat-sub">${c.sub}</div>
          <div class="stat-bar"></div>
        </button>`).join('')}
    </div>

    <div class="anim-up2">
      <div class="sec-head"><div class="sec-title">Recent Orders</div><button class="btn btn-ghost btn-sm" id="hn-all">View all ${ICONS.chevR}</button></div>
      <div class="order-list">
        ${S._booting ? skeleton(4) : recent.length===0 ? emptyState('receipt','No orders yet', isAdmin()?'Orders created by anyone will show here':'Your orders will show here — create your first one') :
          recent.map((o,i)=>orderRowHTML(o,i)).join('')}
      </div>
    </div>
  </div>`;
  ['hn-btn','hn-btn2'].forEach(id=>document.getElementById(id)?.addEventListener('click', startNewOrder));
  document.getElementById('hn-hist').onclick = () => setScreen('history');
  document.getElementById('hn-all').onclick = () => setScreen('history');
  document.getElementById('resume-btn')?.addEventListener('click', e=>{ const o = S.orders.find(x=>x.id==e.currentTarget.dataset.id); S.resumeOrderId=null; if(o) editOrder(o); });
  area.querySelectorAll('.stat-card').forEach(c=>c.onclick=()=>{ S.statusDetailFilter=c.dataset.status; S._sdQuery=''; setScreen('statusDetail'); });
  area.querySelectorAll('.order-row').forEach(c=>c.onclick=()=>{ const o=S.orders.find(x=>x.id==c.dataset.id); if(o) editOrder(o); });
  animateCounters(area);
}

function orderRowHTML(o, i=0){
  const pts = o.parts||[];
  const counts = PART_STATUSES.map(s=>[s, pts.filter(p=>p.status===s).length]).filter(x=>x[1]);
  return `<div class="order-row" data-id="${o.id}" style="animation-delay:${Math.min(i*.04,.3)}s">
    <span class="order-ic ${isDraft(o)?'is-draft':''}">${isDraft(o)?ICONS.edit:ICONS.receipt}</span>
    <span class="order-main">
      <span class="order-inv">${isDraft(o)?'':'#'}${esc(o.invoice_no)} ${isDraft(o)?'<span class="chip chip-draft">Draft</span>':''}</span>
      <span class="order-meta">${fmtDate(o.invoice_date)} · ${plural(pts.length,'part')} ${counts.map(([s,n])=>`<span class="mini-dot st-${s}"></span>${n}`).join(' ')}${isAdmin()&&o.created_by?` · <span class="owner">${ICONS.user}${esc(o.created_by)}</span>`:''}</span>
    </span>
    <span class="order-amt"><b>₹${fmt(o.total_invoice_mrp)}</b><small>Invoice MRP</small></span>
  </div>`;
}
function emptyState(icon, title, sub){
  return `<div class="empty"><div class="empty-ic">${ICONS[icon]||icon}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}
function animateCounters(root){
  if(prefersReducedMotion() || S._soft) return;
  root.querySelectorAll('[data-count]').forEach(el=>{
    const target = parseFloat(el.dataset.count)||0, dec = parseInt(el.dataset.dec)||0;
    if(!target) return;
    const t0 = performance.now(), dur = 400;
    const step = now => {
      const k = Math.min(1,(now-t0)/dur), e = 1-Math.pow(1-k,3);
      el.textContent = dec ? fmt(target*e) : fmtI(Math.round(target*e));
      if(k<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ── STATUS DETAIL (all parts with one status, across invoices) ─ */
function renderStatusDetail(area){
  const st = S.statusDetailFilter || 'short';
  const c = STATUS[st] || STATUS.short;
  const allParts = [];
  S.orders.forEach(o=>{
    (o.parts||[]).filter(p=>st==='all' || p.status===st).forEach(p=>allParts.push({...p, invoice_no:o.invoice_no, invoice_date:o.invoice_date, created_by:o.created_by}));
  });
  allParts.sort((a,b)=> String(b.invoice_date||'').localeCompare(String(a.invoice_date||'')) || String(a.invoice_no||'').localeCompare(String(b.invoice_no||'')) || ((parseInt(a.sr_no)||0)-(parseInt(b.sr_no)||0)));
  const q = (S._sdQuery||'').toLowerCase().trim();
  const filtered = q ? allParts.filter(p=>[p.part_code,p.description,p.invoice_no,p.hsn_no,p.created_by,p.dc_no,p.credit_note].some(v=>String(v||'').toLowerCase().includes(q))) : allParts;
  const hl = t => markMatch(t, q);
  const invCount = new Set(allParts.map(p=>p.invoice_no)).size;
  // every figure is computed from the same rows that are listed
  const T = filtered.reduce((t,p)=>{ const x=partTotals(p); t.a+=x.a; t.p+=x.p; t.i+=x.i; t.q+=x.q; return t; },{a:0,p:0,i:0,q:0});
  if(S._sdKey !== st+'|'+q){ S._sdKey = st+'|'+q; S._sdLimit = 60; }
  if(S._sdDense === undefined){ try { S._sdDense = localStorage.getItem('sp_dense')!=='0'; } catch(e){ S._sdDense = true; } }
  const money = v => `<span class="cur">₹</span>${fmt(v)}`;
  const rowHTML = (p,i) => {
    const x = partTotals(p);
    // secondary details as quiet text (not chips) so the row stays calm and narrow
    const meta = [];
    if(p.hsn_no) meta.push(`<span class="pm">HSN <b>${hl(p.hsn_no)}</b></span>`);
    if(p.credit_note) meta.push(`<span class="pm pm-cn">${ICONS.receipt}CN <b>${hl(p.credit_note)}</b> · ₹${fmt(p.credit_note_amount)}</span>`);
    else if(p.dc_no) meta.push(`<span class="pm pm-dc">${ICONS.truck}DC <b>${hl(p.dc_no)}</b>${p.lr_no?` · LR <b>${hl(p.lr_no)}</b>`:''}</span>`);
    if(isAdmin() && p.created_by) meta.push(`<span class="pm pm-user">${ICONS.user}${hl(p.created_by)}</span>`);
    return `<tr class="row-${p.status||'short'}">
      <td class="n" data-label="#">${i+1}</td>
      <td class="part" data-label="Part"><div class="p-wrap">
        <div class="p-line"><span class="code">${hl(p.part_code)}</span>${st==='all'?statusBadge(p.status,true):''}</div>
        <div class="desc" title="${esc(p.description||'')}">${hl(p.description||'-')}</div>
        ${meta.length?`<div class="p-meta">${meta.join('')}</div>`:''}</div></td>
      <td class="inv" data-label="Invoice" title="#${esc(p.invoice_no)} · ${fmtDate(p.invoice_date)}"><div class="inv-no">#${hl(p.invoice_no)}</div><div class="inv-meta"><span class="inv-date">${fmtDate(p.invoice_date)}</span><span class="sr-pill">Sr ${esc(p.sr_no||'–')}</span></div></td>
      <td class="r num" data-label="Actual MRP">${money(p.actual_mrp)}</td>
      <td class="r num" data-label="Printed MRP">${money(p.printed_mrp)}</td>
      <td class="r num b" data-label="Inv MRP">${money(p.invoice_mrp)}</td>
      <td class="r num dq" data-label="Qty"><span class="qty-pill">${x.q}</span></td>
      <td class="r num total" data-label="Total (Qty × Inv MRP)">${money(x.i)}</td>
    </tr>`;
  };
  const shown = filtered.slice(0, S._sdLimit);

  area.innerHTML = `
  ${topBar(c.label, `${plural(allParts.length,'part')} · ${plural(invCount,'invoice')}`, true,
     `<button class="btn btn-primary btn-md" id="sd-export">${ICONS.download}<span class="hide-xs">Export</span></button>`)}
  <div class="page-body page-wide sd-page">
    <div class="sd-head" style="--st:${c.color};--st-bg:${c.bg}">
      <span class="sd-ic">${ICONS[c.icon]}</span>
      <div class="sd-figs">
        <div><small>Parts</small><b>${fmtI(filtered.length)}</b></div>
        <div><small>Units</small><b>${fmtI(T.q)}</b></div>
        <div><small>Actual MRP</small><b>₹${fmt(T.a)}</b></div>
        <div class="sd-main"><small>Invoice MRP</small><b>₹${fmt(T.i)}</b></div>
      </div>
    </div>
    <div class="sd-toolbar">
      <div class="status-tabs">
        ${['all',...PART_STATUSES].map(k=>`<button class="status-tab ${k===st?'active':''}" data-st="${k}" style="--st:${STATUS[k].color}"><span class="dot"></span>${STATUS[k].short}</button>`).join('')}
      </div>
      ${allParts.length ? `<div class="search-box sd-search" id="sd-box">
        <span class="sb-ic">${ICONS.search}</span>
        <input id="sd-search" type="text" value="${esc(S._sdQuery||'')}" placeholder="Search invoice, part, HSN, DC${isAdmin()?', user':''}…" autocomplete="off"/>
        ${S._sdQuery?`<button class="search-clear" id="sd-clear">${ICONS.close}</button>`:''}
      </div>` : ''}
      <div class="density" role="group" aria-label="Row size">
        <button class="${S._sdDense?'':'on'}" data-dense="0" title="Comfortable rows">${ICONS.menu}<span>Comfortable</span></button>
        <button class="${S._sdDense?'on':''}" data-dense="1" title="Compact rows — more entries on screen">${ICONS.sheet}<span>Compact</span></button>
      </div>
    </div>
    ${allParts.length===0 ? emptyState(c.icon, 'No '+c.label.toLowerCase()+' yet', 'Parts with this status will appear here') : `
    ${q?`<div class="match-note">${fmtI(filtered.length)} of ${fmtI(allParts.length)} match “${esc(q)}”</div>`:''}
    <div class="data-table ${S._sdDense?'dense':''}" style="--st:${c.color};--st-t:${c.text}">
      <div class="dt-scroll" id="dt-scroll" tabindex="0" aria-label="Parts table — scroll sideways for more columns">
      <table class="dt">
        <thead><tr><th class="n">#</th><th class="part">Part</th><th class="inv">Invoice</th><th class="r">Actual MRP</th><th class="r">Printed MRP</th><th class="r">Inv MRP</th><th class="r">Qty</th><th class="r">Total</th></tr></thead>
        <tbody id="sd-rows">
        ${shown.length===0 ? `<tr class="dt-empty-row"><td colspan="8" class="dt-empty">No parts match “${esc(q)}”</td></tr>` : shown.map(rowHTML).join('')}
        </tbody>
        <tfoot><tr>
          <td class="n"></td><td class="part" data-label="Totals"><b>Totals</b> <span class="muted">· ${plural(filtered.length,'part')}</span></td><td class="inv"></td>
          <td class="r num" data-label="Actual value">${money(T.a)}<small class="tf-cap">qty × actual</small></td><td class="r num" data-label="Printed value">${money(T.p)}<small class="tf-cap">qty × printed</small></td><td class="r num muted" data-label="">—</td>
          <td class="r num" data-label="Units">${fmtI(T.q)}<small class="tf-cap">units</small></td><td class="r num total" data-label="Invoice value">${money(T.i)}<small class="tf-cap">qty × inv MRP</small></td></tr></tfoot>
      </table>
      </div>
      <div class="dt-status" id="sd-status">${filtered.length>shown.length?`Showing <b>${fmtI(shown.length)}</b> of ${fmtI(filtered.length)} · scroll for more <button class="link-btn" id="sd-more">Show all</button>`:`All <b>${fmtI(filtered.length)}</b> rows shown`}</div>
    </div>`}
  </div>`;
  document.getElementById('tb-back').onclick = () => { S._sdQuery=''; setScreen('home'); };
  document.getElementById('sd-export').onclick = () => showStatusExportModal(st);
  area.querySelectorAll('.status-tab').forEach(b=>b.onclick=()=>{ S.statusDetailFilter=b.dataset.st; renderPage(true); });
  area.querySelectorAll('[data-dense]').forEach(b=>b.onclick=()=>{
    S._sdDense = b.dataset.dense==='1'; try { localStorage.setItem('sp_dense', S._sdDense?'1':'0'); } catch(e){}
    area.querySelector('.data-table')?.classList.toggle('dense', S._sdDense);
    area.querySelectorAll('[data-dense]').forEach(x=>x.classList.toggle('on', x===b));
  });
  // more rows load by themselves as you scroll (appended, not re-drawn → smooth)
  const appendMore = (all) => {
    const tb = document.getElementById('sd-rows'); if(!tb) return;
    const from = S._sdLimit, to = all ? filtered.length : Math.min(filtered.length, from+200);
    if(from >= to) return;
    tb.insertAdjacentHTML('beforeend', filtered.slice(from, to).map((p,k)=>rowHTML(p, from+k)).join(''));
    S._sdLimit = to;
    const stEl = document.getElementById('sd-status');
    if(stEl) stEl.innerHTML = filtered.length>to ? `Showing <b>${fmtI(to)}</b> of ${fmtI(filtered.length)} · scroll for more <button class="link-btn" id="sd-more">Show all</button>` : `All <b>${fmtI(filtered.length)}</b> rows shown`;
    document.getElementById('sd-more')?.addEventListener('click', ()=>appendMore(true));
  };
  document.getElementById('sd-more')?.addEventListener('click', ()=>appendMore(true));
  if(S._sdObs) S._sdObs.disconnect();
  const sentinel = document.getElementById('sd-status');
  if(sentinel && 'IntersectionObserver' in window){
    S._sdObs = new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting) && S.screen==='statusDetail') appendMore(false); }, { rootMargin:'600px 0px' });
    S._sdObs.observe(sentinel);
  }
  // inside the table's own scroll area: load more near the bottom, show edge shadows
  const sc = document.getElementById('dt-scroll');
  if(sc){
    const box = sc.parentElement;
    const edges = () => {
      box.classList.toggle('sx-left', sc.scrollLeft > 2);
      box.classList.toggle('sx-right', sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2);
    };
    let raf = 0;
    sc.addEventListener('scroll', ()=>{ if(raf) return; raf = requestAnimationFrame(()=>{ raf = 0; edges();
      if(sc.scrollTop + sc.clientHeight > sc.scrollHeight - 500) appendMore(false); }); }, { passive:true });
    // height: the table box (scroll area + status line) always fits below the top bar,
    // so its header row can never slide out of view
    const fit = () => {
      if(!sc.isConnected || getComputedStyle(sc).overflowY === 'visible') { sc.style.maxHeight=''; return; }
      const tb = document.querySelector('.top-bar')?.getBoundingClientRect().height || 70;
      const lock = document.querySelector('.lock-banner')?.getBoundingClientRect().height || 0;
      const extra = box.offsetHeight - sc.offsetHeight;                  // status line + borders
      const pb = parseFloat(getComputedStyle(box.closest('.page-body')||box).paddingBottom) || 0;
      sc.style.maxHeight = Math.max(320, window.innerHeight - tb - lock - extra - pb - 14) + 'px';
      edges();
    };
    fit();
    if(S._sdFit) window.removeEventListener('resize', S._sdFit);
    S._sdFit = fit; window.addEventListener('resize', fit, { passive:true });
    if('ResizeObserver' in window){ if(S._sdRO) S._sdRO.disconnect(); S._sdRO = new ResizeObserver(edges); S._sdRO.observe(sc); }
  }
  const inp = document.getElementById('sd-search');
  if(inp){
    const rerender = debounce(()=>{
      S._soft = true; renderStatusDetail(area);
      const n = document.getElementById('sd-search'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    }, 180);
    inp.oninput = () => { S._sdQuery = inp.value; rerender(); };
  }
  document.getElementById('sd-clear')?.addEventListener('click', ()=>{ S._sdQuery=''; renderStatusDetail(area); document.getElementById('sd-search')?.focus(); });
}
/* ── SHARED PART EDITOR (search panel · cart · history) ────── */
function receiptHTML(p){
  if(p.status!=='received') return '';
  if(p.credit_note) return `<div class="receipt rc-cn"><span class="rc-ic">${ICONS.receipt}</span><div><small>Credit note</small><b>${esc(p.credit_note)} · ₹${fmt(p.credit_note_amount)}</b></div><button class="btn btn-sm btn-ghost pe-receipt">Change</button></div>`;
  if(p.dc_no) return `<div class="receipt rc-dc"><span class="rc-ic">${ICONS.truck}</span><div><small>Delivery challan</small><b>DC ${esc(p.dc_no)}${p.lr_no?' · LR '+esc(p.lr_no):''}</b>${p.transport_name?`<span>${esc(p.transport_name)}</span>`:''}</div><button class="btn btn-sm btn-ghost pe-receipt">Change</button></div>`;
  return `<div class="receipt rc-missing"><span class="rc-ic">${ICONS.alert}</span><div><small>Receipt details missing</small><b>Add challan or credit note</b></div><button class="btn btn-sm btn-primary pe-receipt">Add</button></div>`;
}
function partEditorHTML(p, opts={}){
  const tot = partTotals(p).i;
  return `
  <div class="pe">
    <div class="pe-label">Part status</div>
    <div class="pe-status">
      ${PART_STATUSES.map(s=>`<button type="button" class="pe-st st-${s} ${ (p.status||'short')===s?'on':''}" data-st="${s}">${ICONS[STATUS[s].icon]}<span>${STATUS[s].short}</span></button>`).join('')}
    </div>
    <div class="pe-receipt-wrap">${receiptHTML(p)}</div>
    <div class="pe-grid">
      <label class="pe-f pe-sr"><span>Inv Sr No <i>*</i></span><input type="number" inputmode="numeric" min="1" data-f="sr_no" value="${esc(p.sr_no??'')}" placeholder="1"/></label>
      <label class="pe-f"><span>Actual MRP</span><input type="number" inputmode="decimal" min="0" step="0.01" data-f="actual_mrp" value="${num(p.actual_mrp)}"/></label>
      <label class="pe-f"><span>Printed MRP</span><input type="number" inputmode="decimal" min="0" step="0.01" data-f="printed_mrp" value="${num(p.printed_mrp)}"/></label>
      <label class="pe-f"><span>Invoice MRP</span><input type="number" inputmode="decimal" min="0" step="0.01" data-f="invoice_mrp" value="${num(p.invoice_mrp)}"/></label>
    </div>
    <div class="pe-foot">
      <div class="qty">
        <button type="button" class="qty-btn" data-q="-1" aria-label="Less">−</button>
        <input type="number" inputmode="numeric" min="1" data-f="qty" value="${qtyOf(p)}"/>
        <button type="button" class="qty-btn qty-plus" data-q="1" aria-label="More">+</button>
      </div>
      <div class="pe-total"><small>Inv total</small><b>₹${fmt(tot)}</b></div>
      ${opts.action||''}
    </div>
    <div class="pe-err"></div>
  </div>`;
}
// getPart() returns the live object to edit; onChange(field) after each change
function bindPartEditor(root, getPart, onChange){
  const pe = root.querySelector('.pe'); if(!pe) return;
  const refreshTotal = () => { const b = pe.querySelector('.pe-total b'); if(b) b.textContent = '₹'+fmt(partTotals(getPart()).i); };
  pe.querySelectorAll('.pe-st').forEach(b=>b.onclick = e => {
    e.stopPropagation();
    const p = getPart(); const was = p.status;
    p.status = b.dataset.st;
    if(p.status!=='received'){ p.dc_no=''; p.lr_no=''; p.transport_name=''; p.credit_note=''; p.credit_note_amount=''; }
    pe.querySelectorAll('.pe-st').forEach(x=>x.classList.toggle('on', x===b));
    pe.querySelector('.pe-receipt-wrap').innerHTML = receiptHTML(p);
    bindReceipt();
    onChange('status', was);
  });
  const bindReceipt = () => pe.querySelector('.pe-receipt')?.addEventListener('click', e=>{
    e.stopPropagation();
    showDCDialog(getPart(), { onSave:()=>{ pe.querySelector('.pe-receipt-wrap').innerHTML = receiptHTML(getPart()); bindReceipt(); onChange('receipt'); } });
  });
  bindReceipt();
  pe.querySelectorAll('input[data-f]').forEach(inp=>{
    inp.onclick = e => e.stopPropagation();
    inp.oninput = () => {
      const p = getPart(), f = inp.dataset.f;
      if(f==='sr_no'){ p.sr_no = inp.value==='' ? '' : (parseInt(inp.value)||''); inp.classList.remove('invalid'); pe.querySelector('.pe-err').textContent=''; }
      else if(f==='qty'){ p.qty = Math.max(1, parseInt(inp.value)||1); }
      else p[f] = num(inp.value);
      refreshTotal(); onChange(f);
    };
    if(inp.dataset.f==='qty') inp.onblur = () => { if(!inp.value || parseInt(inp.value)<1) inp.value = 1; };
  });
  pe.querySelectorAll('.qty-btn').forEach(b=>b.onclick = e => {
    e.stopPropagation();
    const p = getPart(); p.qty = Math.max(1, qtyOf(p) + parseInt(b.dataset.q));
    pe.querySelector('input[data-f="qty"]').value = p.qty;
    refreshTotal(); onChange('qty');
  });
}
function markSrMissing(root){
  const pe = root.querySelector('.pe'); if(!pe) return;
  const inp = pe.querySelector('input[data-f="sr_no"]');
  inp?.classList.add('invalid'); inp?.focus();
  pe.querySelector('.pe-err').textContent = 'Enter the Sr. No. of this part on the supplier invoice';
}

/* ── NEW ORDER ─────────────────────────────────────────────── */
function renderNew(area){
  area = area || document.getElementById('page-area');
  const steps = ['sheet','search','cart'], ci = steps.indexOf(S.newStep);
  const title = S.editingOrder ? (isDraft(S.editingOrder) ? S.editingOrder.invoice_no : 'Edit #'+S.editingOrder.invoice_no) : 'New Order';
  const sub = S.selectedSheet ? esc(S.selectedSheet.name) : 'Short / damaged parts order';
  area.innerHTML = `
  ${topBar(esc(title), sub, true, `<span class="save-state" id="save-state"></span>${S.newStep!=='sheet'&&S.cart.length?`<button class="btn btn-primary btn-md" id="tb-save">${ICONS.save}<span class="hide-xs">Save Order</span></button>`:''}`)}
  <div class="stepper">
    ${[['Catalogue','sheet'],['Search parts','search'],['Review & save','cart']].map(([l,id],i)=>`
      <button class="step ${i<ci?'done':i===ci?'active':''}" data-step="${id}" ${i>ci && !(id==='cart'&&S.cart.length) && !(id==='search'&&S.selectedSheet)?'disabled':''}>
        <span class="step-n">${i<ci?ICONS.check:i+1}</span><span>${l}</span>${id==='cart'&&S.cart.length?`<span class="step-count">${S.cart.length}</span>`:''}
      </button>`).join('<span class="step-line"></span>')}
  </div>
  <div class="page-body" id="step-body"></div>`;
  document.getElementById('tb-back').onclick = () => {
    if(S.newStep==='search'){ S.newStep = S._editReturn && S.cart.length ? 'cart' : 'sheet'; renderNew(); }
    else if(S.newStep==='cart'){
      // an existing order opened from a list → Back returns to that list in one tap
      if(S._editReturn){ setScreen(S._editReturn); return; }
      S.newStep = S.selectedSheet ? 'search' : 'sheet'; renderNew();
    }
    else if(S._editReturn && S.cart.length){ S.newStep='cart'; renderNew(); }
    else setScreen(S._editReturn || 'home');
  };
  document.getElementById('tb-save')?.addEventListener('click', showSaveModal);
  area.querySelectorAll('.step').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.newStep=b.dataset.step; renderNew(); });
  if(S.newStep==='sheet') renderSheet1();
  else if(S.newStep==='search') renderSearch();
  else renderCart();
}

/* Step 1 — catalogue */
function renderSheet1(){
  const body = document.getElementById('step-body'); if(!body) return;
  body.innerHTML = `
  <div class="anim-up">
    <div class="step-head"><h2>Choose catalogue</h2><p>Pick the main catalogue for this order — search also looks in every other catalogue</p></div>
    <div class="sheet-list">
      ${S.sheets.length===0 ? `${emptyState('sheet','No parts sheets yet', isAdmin()?'Upload your Excel catalogue in Parts Sheets':'Ask the admin to upload the parts catalogue')}
        ${isAdmin()?`<div style="text-align:center"><button class="btn btn-primary btn-md" id="go-sheets">${ICONS.upload}<span>Upload sheet</span></button></div>`:''}` :
        S.sheets.filter(s=>!(s.part_count<0)).map((s,i)=>`
        <button class="sheet-card ${S.selectedSheet?.id===s.id?'active':''}" data-id="${s.id}" style="animation-delay:${i*.05}s">
          <span class="sheet-ic">${ICONS.sheet}</span>
          <span class="sheet-txt"><b>${esc(s.name)}</b><small>${plural(s.part_count||0,'part')} · ${fmtDate(s.created_at)}</small></span>
          <span class="sheet-go">${ICONS.chevR}</span>
        </button>`).join('')}
    </div>
    ${S.cart.length?`<button class="btn btn-ghost btn-block" id="skip-cart" style="margin-top:14px">Review ${plural(S.cart.length,'part')} in this order ${ICONS.chevR}</button>`:''}
  </div>`;
  body.querySelectorAll('.sheet-card').forEach(c=>{ const warm=()=>loadParts(c.dataset.id).catch(()=>{}); c.addEventListener('pointerenter', warm, {once:true}); c.addEventListener('touchstart', warm, {once:true, passive:true}); });
  body.querySelectorAll('.sheet-card').forEach(c=>c.onclick=()=>{
    S.selectedSheet = S.sheets.find(s=>String(s.id)===c.dataset.id);
    try { localStorage.setItem('sp_last_sheet', c.dataset.id); } catch(e){}
    S.newStep = 'search'; S.query=''; S.expandedPart=null; renderNew();
  });
  document.getElementById('go-sheets')?.addEventListener('click', ()=>setScreen('sheets'));
  document.getElementById('skip-cart')?.addEventListener('click', ()=>{ S.newStep='cart'; renderNew(); });
}

function showPartsLoader(body){
  body.innerHTML = `
  <div class="loader-card anim-up">
    <div class="ring"><span></span>${ICONS.box}</div>
    <b>Loading parts catalogue</b>
    <small id="ld-msg">Connecting…</small>
    <div class="ld-bar"><div id="ld-bar"></div></div>
    <small class="muted">First load can take a little while. It's cached afterwards.</small>
  </div>`;
}

/* Step 2 — search */
// Catalogues searched: the selected one first, then the rest (finished uploads only)
function searchSheets(){
  const sel = S.selectedSheet;
  const rest = S.sheets.filter(x=>!(x.part_count<0) && (!sel || String(x.id)!==String(sel.id)));
  return (sel ? [S.sheets.find(x=>String(x.id)===String(sel.id)) || sel] : []).concat(rest);
}
// Search every loaded catalogue. Order: best match first (exact code → code starts
// with → code contains → alt code → description); for equal matches the selected
// catalogue comes first, then catalogue order, then row order.
// Also counts every match, in total and per catalogue (for the filter chips).
function filterParts(q){
  S._matchCount = 0; S._matchBySheet = {};
  if(!q.trim()) return [];
  const ql = q.toLowerCase().trim(), qc = ql.replace(/[-\s]/g,'');
  const LIMIT = 30, best = [];
  const cmp = (x,y)=>x[0]-y[0]||x[1]-y[1]||x[2]-y[2];
  let total = 0;
  searchSheets().forEach((sh, si) => {
    const list = S.sheetsData[sh.id]; if(!list) return;
    const counted = S.searchScope==='all' || String(S.searchScope)===String(sh.id);
    let n = 0;
    for(let i=0;i<list.length;i++){
      const p = list[i], k = searchKey(p);
      if(!(k.includes(ql) || (qc && k.includes(qc)))) continue;
      n++;
      if(!counted) continue;
      total++;
      const code = k.slice(0, k.indexOf('\u0001')), codeC = code.replace(/[-\s]/g,'');
      const alt = String(p.alt_code||'').toLowerCase();
      const r = (code===ql || codeC===qc) ? 0 : (code.startsWith(ql) || codeC.startsWith(qc)) ? 1 :
                (code.includes(ql) || codeC.includes(qc)) ? 2 : (alt && (alt.includes(ql) || alt.replace(/[-\s]/g,'').includes(qc))) ? 3 : 4;
      const e = [r, si, i, p, sh];
      if(best.length < LIMIT){ best.push(e); if(best.length===LIMIT) best.sort(cmp); }
      else if(cmp(e, best[LIMIT-1]) < 0){ best[LIMIT-1] = e; best.sort(cmp); }
    }
    S._matchBySheet[sh.id] = n;
  });
  best.sort(cmp);
  S._matchCount = total;
  return best.map(x=>({ p:x[3], sheet:x[4] }));
}
// Load every other catalogue in the background (from the device cache when possible)
function ensureAllSheets(){
  const todo = searchSheets().filter(sh=>!S.sheetsData[sh.id]);
  S._sheetsLoading = todo.length;
  todo.forEach(sh => {
    loadParts(sh.id, (n,t)=>{ S._sheetProgress = S._sheetProgress||{}; S._sheetProgress[sh.id] = t ? n/t : 0; drawSearchStatus(); })
      .catch(()=>{ S.sheetsData[sh.id] = S.sheetsData[sh.id] || null; })
      .finally(()=>{
        S._sheetsLoading = searchSheets().filter(x=>!S.sheetsData[x.id]).length;
        if(S.screen==='new' && S.newStep==='search'){
          // don't redraw an open part editor while someone is typing in it
          const typing = document.activeElement && document.activeElement.closest?.('.result-panel');
          if(S.query && !typing) updateSugg(); else drawSearchStatus();
        }
      });
  });
  drawSearchStatus();
}
function drawSearchStatus(){
  const el = document.getElementById('sb-status'); if(!el) return;
  const all = searchSheets(), ready = all.filter(x=>S.sheetsData[x.id]);
  const loading = all.filter(x=>!S.sheetsData[x.id]);
  const pct = loading.length ? Math.round(loading.reduce((a,x)=>a+((S._sheetProgress||{})[x.id]||0),0)/loading.length*100) : 100;
  const parts = ready.reduce((a,x)=>a+(S.sheetsData[x.id]?.length||0),0);
  el.innerHTML = `${ICONS.sheet}<span>Searching <b>${plural(ready.length,'catalogue')}</b> · ${fmtI(parts)} parts${loading.length?` · <span class="sb-loading">loading ${esc(loading.map(x=>x.name).join(', '))} ${pct}%</span>`:''}</span>`;
}

function renderSearch(){
  const body = document.getElementById('step-body'); if(!body) return;
  const sid = S.selectedSheet?.id;
  if(sid && !S.sheetsData[sid]){
    showPartsLoader(body);
    loadParts(sid, (n,total)=>{
      const m=document.getElementById('ld-msg'), b=document.getElementById('ld-bar');
      if(m) m.textContent = `Loaded ${fmtI(n)}${total?' of '+fmtI(total):''} parts…`;
      if(b) b.style.width = Math.min(98, total ? n/total*100 : n/500) + '%';
    }).then(()=>{ if(S.screen==='new' && S.newStep==='search'){ toast(`${fmtI(S.sheetsData[sid].length)} parts ready`); renderSearch(); } })
      .catch(e=>{ S.sheetsData[sid] = []; toast('Could not load parts: '+(e.message||''),'error'); renderSearch(); });
    return;
  }
  body.innerHTML = `
  <div class="anim-up search-page">
    <div class="search-box search-lg" id="sb-box">
      <span class="sb-ic">${ICONS.search}</span>
      <input id="sb-inp" value="${esc(S.query)}" placeholder="Search part code, alt code or description…" autocomplete="off" spellcheck="false"/>
      <button class="search-clear" id="sb-clear" style="${S.query?'':'display:none'}">${ICONS.close}</button>
    </div>
    <div class="sb-status" id="sb-status"></div>
    <div id="sugg-area"></div>
    <div id="cart-chip-slot"></div>
  </div>`;
  const si = document.getElementById('sb-inp');
  let raf = 0;
  si.oninput = () => { S.query = si.value; S.expandedPart = null; document.getElementById('sb-clear').style.display = S.query?'':'none'; cancelAnimationFrame(raf); raf = requestAnimationFrame(updateSugg); };
  document.getElementById('sb-clear').onclick = () => { S.query=''; si.value=''; S.expandedPart=null; document.getElementById('sb-clear').style.display='none'; si.focus(); updateSugg(); };
  if(window.innerWidth > 760 || !S.query) si.focus();
  if(S.searchScope!=='all' && !searchSheets().some(x=>String(x.id)===String(S.searchScope))) S.searchScope = 'all';
  updateSugg();
  ensureAllSheets();
}
const resultKey = (p, sheet) => (sheet ? sheet.id : 0) + '|' + p.part_code;
function tempPart(p, sheet){
  const code = p.part_code, key = resultKey(p, sheet);
  if(!S._tempPartData[key]){
    const inCart = S.cart.find(c=>c.part_code===code);
    const mrp = num(p.price);
    S._tempPartData[key] = inCart ? {...inCart} : { part_code:code, alt_code:p.alt_code||'', description:p.description||'', hsn_no:p.hsn_no||'',
      actual_mrp:mrp, printed_mrp:mrp, invoice_mrp:mrp, qty:1, status:'short', sr_no:'', dc_no:'', lr_no:'', transport_name:'', credit_note:'', credit_note_amount:'',
      sheet_name: sheet ? sheet.name : '' };
  }
  return S._tempPartData[key];
}
function updateSugg(){
  const area = document.getElementById('sugg-area'); if(!area) return;
  drawSearchStatus();
  const suggs = filterParts(S.query);
  if(!S.query){
    area.innerHTML = `<div class="hint">${ICONS.sparkle}<span>Search by part code like <code>SON-723</code> or a keyword like <code>oil filter</code>. Tap a result to set status, MRP and quantity.</span></div>`;
  } else if(!suggs.length){
    area.innerHTML = scopeChipsHTML() + `<div class="no-results">No parts found for “<b>${esc(S.query)}</b>”${S.searchScope!=='all'?' in this catalogue':' in any catalogue'}${S._sheetsLoading?' (still loading some catalogues…)':''}</div>`;
    bindScopeChips(area);
  } else {
    const selId = S.selectedSheet ? String(S.selectedSheet.id) : '';
    area.innerHTML = scopeChipsHTML() + `<div class="results"><div class="results-head">${S._matchCount > suggs.length ? `Top ${suggs.length} of ${fmtI(S._matchCount)} matches` : `${fmtI(suggs.length)} match${suggs.length===1?'':'es'}`} · tap a part to configure &amp; add</div>
      ${suggs.map(({p, sheet})=>{
        const key = resultKey(p, sheet);
        const added = S.cart.some(c=>c.part_code===p.part_code);
        const blocked = String(p.is_blocked||'N').toUpperCase()==='Y';
        const open = S.expandedPart===key;
        const mine = String(sheet.id)===selId;
        return `<div class="result ${open?'open':''} ${added?'added':''}" data-key="${esc(key)}" data-code="${esc(p.part_code)}">
          <div class="result-row">
            <div class="result-main">
              <div class="result-tags"><span class="code">${hl(p.part_code, S.query)}</span>
                ${blocked?`<span class="chip chip-red">Blocked</span>`:`<span class="chip chip-green">Available</span>`}
                ${added?`<span class="chip chip-blue">${ICONS.check}In order</span>`:''}
                ${p.alt_code?`<span class="chip">Alt ${hl(p.alt_code, S.query)}</span>`:''}</div>
              <div class="desc">${p.description ? hl(p.description, S.query) : '-'}</div>
              <div class="hsn">HSN ${esc(p.hsn_no||'-')}<span class="src-sheet ${mine?'mine':''}" title="Catalogue this part comes from">${ICONS.sheet}${esc(sheet.name)}</span></div>
            </div>
            <div class="result-side"><b class="price">₹${fmt(p.price)}</b><span class="result-toggle">${open?'Close':added?'Edit':'+ Add'}</span></div>
          </div>
          ${open ? `<div class="result-panel">${partEditorHTML(tempPart(p, sheet), { action:`<button class="btn btn-primary pe-add">${added?ICONS.check+'<span>Update</span>':ICONS.plus+'<span>Add to order</span>'}</button>` })}</div>` : ''}
        </div>`;
      }).join('')}</div>`;
    bindScopeChips(area);
    area.querySelectorAll('.result-row').forEach(r=>r.onclick=()=>{
      const key = r.parentElement.dataset.key;
      S.expandedPart = S.expandedPart===key ? null : key;
      updateSugg();
      setTimeout(()=>document.querySelector(`.result[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({behavior:'smooth', block:'nearest'}), 40);
    });
    const open = area.querySelector('.result.open');
    if(open){
      const code = open.dataset.code, key = open.dataset.key;
      const tp = () => S._tempPartData[key];
      bindPartEditor(open, tp, () => {
        const ci = S.cart.findIndex(c=>c.part_code===code);
        if(ci>=0){ S.cart[ci] = withTotals({...tp()}); schedAuto(); renderCartChip(); }
      });
      open.querySelector('.pe-add').onclick = e => {
        e.stopPropagation();
        const p = tp();
        if(p.sr_no==='' || p.sr_no==null){ markSrMissing(open); shake(e.currentTarget); return; }
        const ci = S.cart.findIndex(c=>c.part_code===code);
        const item = withTotals({...p});
        if(ci>=0){ S.cart[ci] = item; toast(`Updated ${code}`); }
        else { S.cart.unshift(item); toast(`Added ${code}`); }
        schedAuto();
        S.expandedPart = null; Object.keys(S._tempPartData).forEach(k=>{ if(k.endsWith('|'+code)) delete S._tempPartData[k]; });
        updateSugg();
        if(item.status==='received' && !item.dc_no && !item.credit_note){
          const live = S.cart.find(c=>c.part_code===code);
          showDCDialog(live, { onSave:()=>{ Object.assign(live, withTotals(live)); schedAuto(); updateSugg(); },
                               onCancel:()=>{ live.status='short'; schedAuto(); updateSugg(); } });
        }
        document.getElementById('sb-inp')?.focus();
      };
    }
  }
  renderCartChip();
}
// "All catalogues (312) · nov-2026 Pricelist (150) · AllParts (162)"
function scopeChipsHTML(){
  const sh = searchSheets().filter(x=>S.sheetsData[x.id]);
  if(sh.length < 2 || !S.query) return '';
  const all = Object.values(S._matchBySheet||{}).reduce((a,b)=>a+b,0);
  const chip = (id, label, n) => `<button class="scope-chip ${String(S.searchScope)===String(id)?'on':''}" data-scope="${id}">${label}<span>${fmtI(n)}</span></button>`;
  return `<div class="scope-chips" role="group" aria-label="Catalogues">${chip('all','All catalogues', all)}${sh.map(x=>chip(x.id, esc(x.name), (S._matchBySheet||{})[x.id]||0)).join('')}</div>`;
}
function bindScopeChips(area){
  area.querySelectorAll('.scope-chip').forEach(b=>b.onclick=()=>{ S.searchScope = b.dataset.scope==='all' ? 'all' : b.dataset.scope; S.expandedPart = null; updateSugg(); });
}
function renderCartChip(){
  const slot = document.getElementById('cart-chip-slot'); if(!slot) return;
  if(!S.cart.length){ slot.innerHTML=''; return; }
  const t = orderTotals(S.cart);
  slot.innerHTML = `<button class="cart-chip">
    <span class="cc-count">${S.cart.length}</span><span class="cc-txt"><b>parts in this order</b><small>${plural(t.units,'unit')}</small></span>
    <span class="cc-amt">₹${fmt(t.invoice)}</span><span class="cc-go">Review ${ICONS.chevR}</span></button>`;
  slot.querySelector('.cart-chip').onclick = () => { S.newStep='cart'; renderNew(); };
}

/* Step 3 — review */
function renderCart(){
  const body = document.getElementById('step-body'); if(!body) return;
  const t = orderTotals(S.cart);
  body.innerHTML = `
  <div class="anim-up">
    <div class="sec-head"><div class="sec-title">Review order <span class="muted">(${plural(S.cart.length,'part')})</span></div>
      <button class="btn btn-ghost btn-sm" id="add-more">${ICONS.plus}<span>Add more</span></button></div>
    <div class="cart-list" id="cart-list">
      ${S.cart.length===0 ? emptyState('box','No parts added','Search the catalogue and add parts to this order') :
        S.cart.map((p,i)=>`
        <div class="cart-item" data-i="${i}" style="animation-delay:${Math.min(i*.03,.3)}s">
          <div class="ci-head">
            <div class="ci-main">
              <div class="ci-tags"><span class="code">${esc(p.part_code)}</span>${statusBadge(p.status)}${p.sheet_name && p.sheet_name!==S.selectedSheet?.name?`<span class="src-sheet">${ICONS.sheet}${esc(p.sheet_name)}</span>`:''}${p.alt_code?`<span class="chip">Alt ${hl(p.alt_code, S.query)}</span>`:''}</div>
              <div class="desc">${p.description ? hl(p.description, S.query) : '-'}</div><div class="hsn">HSN ${esc(p.hsn_no||'-')}</div>
            </div>
            <button class="icon-btn danger ci-remove" aria-label="Remove">${ICONS.trash}</button>
          </div>
          ${partEditorHTML(p)}
        </div>`).join('')}
    </div>
    ${S.cart.length ? `
    <div class="grand">
      <div class="grand-glow"></div>
      <div class="grand-label">Order totals</div>
      <div class="grand-row"><span>Actual MRP total</span><b id="gt-a">₹${fmt(t.actual)}</b></div>
      <div class="grand-row"><span>Printed MRP total</span><b id="gt-p">₹${fmt(t.printed)}</b></div>
      <div class="grand-row grand-main"><span>Invoice MRP total</span><b id="gt-i">₹${fmt(t.invoice)}</b></div>
      <div class="grand-row"><span id="gt-u">${plural(S.cart.length,'part')} · ${plural(t.units,'unit')}</span></div>
    </div>
    <button class="btn btn-primary btn-xl btn-block" id="do-save" style="margin-top:16px">${ICONS.save}<span>Save Order</span></button>` : ''}
  </div>`;
  document.getElementById('add-more').onclick = () => { S.newStep = S.selectedSheet ? 'search' : 'sheet'; renderNew(); };
  document.getElementById('do-save')?.addEventListener('click', showSaveModal);
  body.querySelectorAll('.cart-item').forEach(el=>{
    const i = Number(el.dataset.i);
    bindPartEditor(el, () => S.cart[i], (f, was) => {
      Object.assign(S.cart[i], withTotals(S.cart[i]));
      schedAuto(); updateGT();
      if(f==='status'){
        el.querySelector('.ci-tags .badge').outerHTML = statusBadge(S.cart[i].status);
        if(S.cart[i].status==='received' && was!=='received'){
          const live = S.cart[i];
          showDCDialog(live, { onSave:()=>{ schedAuto(); renderCart(); }, onCancel:()=>{ live.status='short'; schedAuto(); renderCart(); } });
        }
      }
    });
    el.querySelector('.ci-remove').onclick = async () => {
      const p = S.cart[i];
      el.classList.add('removing');
      setTimeout(()=>{ S.cart.splice(i,1); schedAuto(); renderCart(); toast(`Removed ${p.part_code}`, 'info'); }, 180);
    };
  });
}
function updateGT(){
  const t = orderTotals(S.cart);
  const set = (id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('gt-a','₹'+fmt(t.actual)); set('gt-p','₹'+fmt(t.printed)); set('gt-i','₹'+fmt(t.invoice));
  set('gt-u', `${plural(S.cart.length,'part')} · ${plural(t.units,'unit')}`);
}

/* ── RECEIPT DIALOG (challan or credit note) ───────────────── */
function showDCDialog(part, { onSave, onCancel } = {}){
  let saved = false;
  const choose = () => `
    <div class="choice-list">
      <button class="choice ch-blue" data-mode="challan"><span class="ch-ic">${ICONS.truck}</span><span><b>Delivery challan</b><small>DC No · LR No · Transport</small></span>${ICONS.chevR}</button>
      <button class="choice ch-orange" data-mode="credit"><span class="ch-ic">${ICONS.receipt}</span><span><b>Credit note</b><small>Reference No · Amount</small></span>${ICONS.chevR}</button>
    </div>`;
  const m = openModal({ title:'Part received', sub:`<span class="mono">${esc(part.part_code)}</span> — how was it received?`, icon:'status_received', tone:'green', size:'sm',
    body:`<div id="dc-body">${choose()}</div>`,
    footer:`<button class="btn btn-ghost btn-block" id="dc-cancel">Cancel — keep as ${part.status==='received'&&(part.dc_no||part.credit_note)?'before':'Short'}</button>`,
    onClose:()=>{ if(!saved) onCancel && onCancel(); } });
  const bodyEl = m.q('#dc-body');
  m.q('#dc-cancel').onclick = m.close;
  const field = (id, label, val, ph, type='text', icon='') => `
    <label class="field-label" for="${id}">${label} <i class="req">*</i></label>
    <div class="input-group">${icon?`<span class="ig-ic">${ICONS[icon]}</span>`:''}<input id="${id}" type="${type}" value="${esc(val)}" placeholder="${ph}" ${type==='number'?'inputmode="decimal" step="0.01" min="0"':''}/></div>
    <div class="form-err" data-for="${id}"></div>`;
  const showForm = mode => {
    if(mode==='challan'){
      bodyEl.innerHTML = `<button class="link-back" id="dc-back">${ICONS.back}Back</button>
        ${field('dc-v','Delivery challan No.', part.dc_no||'', 'e.g. DC/2026/001','text','file')}
        ${field('lr-v','LR number (lorry receipt)', part.lr_no||'', 'e.g. LR/2026/0123','text','receipt')}
        ${field('tr-v','Transport company', part.transport_name||'', 'e.g. Shree Transport','text','truck')}
        <button class="btn btn-green btn-block btn-lg" id="dc-ok">${ICONS.check}<span>Save challan details</span></button>`;
    } else {
      bodyEl.innerHTML = `<button class="link-back" id="dc-back">${ICONS.back}Back</button>
        ${field('cn-amt','Credit note amount (₹)', part.credit_note_amount || partTotals(part).i || '', 'e.g. 5000','number','receipt')}
        ${field('cn-ref','Credit note reference No.', part.credit_note||'', 'e.g. CN/2026/001','text','tag')}
        <button class="btn btn-orange btn-block btn-lg" id="dc-ok">${ICONS.check}<span>Save credit note</span></button>`;
    }
    bodyEl.classList.remove('slide-in'); void bodyEl.offsetWidth; bodyEl.classList.add('slide-in');
    m.q('#dc-back').onclick = () => { bodyEl.innerHTML = choose(); bindChoice(); };
    const ids = mode==='challan' ? ['dc-v','lr-v','tr-v'] : ['cn-amt','cn-ref'];
    ids.forEach((id,k)=>{ const inp = m.q('#'+id); inp.oninput = () => { inp.closest('.input-group').classList.remove('invalid'); m.q(`[data-for="${id}"]`).textContent=''; };
      inp.onkeydown = e => { if(e.key==='Enter'){ const nx = ids[k+1]; nx ? m.q('#'+nx).focus() : m.q('#dc-ok').click(); } }; });
    setTimeout(()=>m.q('#'+ids[0])?.focus(), 80);
    m.q('#dc-ok').onclick = () => {
      let ok = true;
      ids.forEach(id=>{
        const inp = m.q('#'+id); const v = inp.value.trim();
        const bad = id==='cn-amt' ? !(num(v)>0) : !v;
        if(bad){ ok=false; inp.closest('.input-group').classList.add('invalid'); m.q(`[data-for="${id}"]`).textContent = id==='cn-amt'?'Enter an amount greater than 0':'Required'; }
      });
      if(!ok) return;
      if(mode==='challan'){
        Object.assign(part, { dc_no:m.q('#dc-v').value.trim(), lr_no:m.q('#lr-v').value.trim(), transport_name:m.q('#tr-v').value.trim(), credit_note:'', credit_note_amount:'' });
        toast('Challan details saved');
      } else {
        Object.assign(part, { credit_note:m.q('#cn-ref').value.trim(), credit_note_amount:num(m.q('#cn-amt').value), dc_no:'', lr_no:'', transport_name:'' });
        toast('Credit note saved: '+part.credit_note);
      }
      part.status = 'received';
      saved = true; m.close(); onSave && onSave();
    };
  };
  const bindChoice = () => bodyEl.querySelectorAll('.choice').forEach(b=>b.onclick=()=>showForm(b.dataset.mode));
  bindChoice();
  if(part.credit_note) showForm('credit'); else if(part.dc_no) showForm('challan');
}

/* ── SAVE ORDER ────────────────────────────────────────────── */
function showSaveModal(){
  if(!S.cart.length){ toast('Add parts first','error'); return; }
  if(lockBlocksMe()){ handleLockedAttempt(); return; }
  const ord = S.editingOrder;
  const ed = ord && !isDraft(ord) && ord.invoice_date ? String(ord.invoice_date).slice(0,10) : localISODate();
  const ei = ord && !isDraft(ord) ? ord.invoice_no : '';
  const t = orderTotals(S.cart);
  const missing = S.cart.filter(p=>p.sr_no==='' || p.sr_no==null);
  const m = openModal({ title:'Save order', sub:'Enter the supplier invoice details', icon:'save', size:'md',
    body:`
      ${missing.length?`<div class="alert alert-red">${ICONS.alert}<div><b>Sr. No. missing for ${missing.length} part${missing.length>1?'s':''}</b><span>${missing.map(p=>`<code>${esc(p.part_code)}</code>`).join(' ')} — go back and enter each part's Sr. No. on the invoice.</span></div></div>`:''}
      <label class="field-label" for="sv-inv">Invoice number</label>
      <div class="input-group"><span class="ig-ic">${ICONS.receipt}</span><input id="sv-inv" class="mono" type="text" placeholder="e.g. INV/2026/001" value="${esc(ei)}"/></div>
      <div class="form-err" id="sv-inv-err"></div>
      <label class="field-label" for="sv-date">Invoice date</label>
      <div class="input-group"><span class="ig-ic">${ICONS.calendar}</span><input id="sv-date" type="date" value="${esc(ed)}"/></div>
      <div class="field-hint" id="sv-date-hint">${fmtDMY(ed)}</div>
      <div class="summary-box">
        <div class="sum-row"><span>Parts / units</span><b>${plural(S.cart.length,'part')} · ${plural(t.units,'unit')}</b></div>
        <div class="sum-row"><span>Actual MRP total</span><b class="mono">₹${fmt(t.actual)}</b></div>
        <div class="sum-row"><span>Printed MRP total</span><b class="mono">₹${fmt(t.printed)}</b></div>
        <div class="sum-row sum-main"><span>Invoice MRP total</span><b class="mono">₹${fmt(t.invoice)}</b></div>
      </div>`,
    footer:`<button class="btn btn-ghost" id="sv-cxl">Cancel</button><button class="btn btn-primary" id="sv-ok" ${missing.length?'disabled':''}>${ICONS.save}<span>Save order</span></button>` });
  const inv = m.q('#sv-inv'), date = m.q('#sv-date');
  setTimeout(()=>inv.focus(), 80);
  date.oninput = () => m.q('#sv-date-hint').textContent = date.value ? fmtDMY(date.value) : '';
  inv.oninput = () => { m.q('#sv-inv-err').textContent=''; inv.closest('.input-group').classList.remove('invalid'); };
  inv.onkeydown = e => { if(e.key==='Enter') m.q('#sv-ok').click(); };
  m.q('#sv-cxl').onclick = m.close;
  m.q('#sv-ok').onclick = () => doSave(m);
}

async function doSave(m){
  const btn = m.q('#sv-ok');
  const invNo = m.q('#sv-inv').value.trim();
  const invDate = m.q('#sv-date').value;
  if(!invNo){ m.q('#sv-inv-err').textContent='Enter the invoice number'; m.q('#sv-inv').closest('.input-group').classList.add('invalid'); shake(btn); return; }
  if(/^draft/i.test(invNo)){ m.q('#sv-inv-err').textContent='Use the real invoice number, not a draft name'; shake(btn); return; }
  if(!invDate){ toast('Select the invoice date','error'); return; }
  if(S.cart.some(p=>p.sr_no==='' || p.sr_no==null)){ toast('Sr. No. missing for some parts','error'); return; }
  let dup = S.orders.find(o=>o.id!==S.editingOrder?.id && String(o.invoice_no).trim().toLowerCase()===invNo.toLowerCase());
  if(!dup && !btn.dataset.dupOk){
    // staff only see their own orders — ask the database about everyone's
    try { const r = await sb.from('short_orders').select('id,invoice_no,invoice_date,created_by').eq('invoice_no', invNo).limit(3);
      dup = (r.data||[]).find(o=>o.id!==S.editingOrder?.id); } catch(e){}
  }
  if(dup && !btn.dataset.dupOk){
    m.q('#sv-inv-err').innerHTML = `An order with invoice <b>${esc(dup.invoice_no)}</b> already exists (${fmtDate(dup.invoice_date)}${dup.created_by&&dup.created_by!==S.user?', by '+esc(dup.created_by):''}). Press Save again to save anyway.`;
    btn.dataset.dupOk = '1'; return;
  }
  setBusy(btn, true, 'Saving…');
  cancelPendingCartSave();
  if(_draftCreating) await _draftCreating;
  const parts = S.cart.map(withTotals), t = orderTotals(parts);
  const data = { invoice_no:invNo, invoice_date:invDate, sheet_id:S.selectedSheet?.id||null, sheet_name:S.selectedSheet?.name||'',
    parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:new Date().toISOString() };
  try {
    const ord = S.editingOrder;
    let saved;
    if(ord?.id){
      flushOrderLog(ord.id);
      const r = await sb.from('short_orders').update(data).eq('id', ord.id).select().maybeSingle();   // never sends created_at / created_by
      if(r.error) throw r.error;
      if(!r.data){ m.close(); handleOrderDeletedElsewhere(ord.id); return; }
      saved = r.data;
      logActivity('order', isDraft(ord)?'saved':'updated', saved.id, saved.invoice_no,
        isDraft(ord) ? `Saved draft as #${saved.invoice_no} — ${plural(parts.length,'part')}, ₹${fmt(t.invoice)}` : `Updated #${saved.invoice_no} — ${plural(parts.length,'part')}, ₹${fmt(t.invoice)}`,
        { invoice_no:ord.invoice_no, invoice_date:ord.invoice_date, parts:ord.parts, total_invoice_mrp:ord.total_invoice_mrp }, { invoice_no:saved.invoice_no, invoice_date:saved.invoice_date, parts, total_invoice_mrp:t.invoice });
    } else {
      const r = await sb.from('short_orders').insert([{ ...data, created_by:S.user, created_at:new Date().toISOString() }]).select().single();
      if(r.error) throw r.error;
      saved = r.data;
      logActivity('order','created',saved.id,saved.invoice_no,`Created #${saved.invoice_no} — ${plural(parts.length,'part')}, ₹${fmt(t.invoice)}`, null, { parts });
    }
    const oi = S.orders.findIndex(o=>o.id===saved.id);
    if(oi>=0) S.orders[oi] = saved; else S.orders.push(saved);
    sortOrders(S.orders);
    m.close();
    S.editingOrder = null; S.cart = []; S.resumeOrderId = null; clearLocalCart();
    toast(`Order #${saved.invoice_no} saved`);
    setScreen('history');
  } catch(e){
    if(e?.code==='APP_LOCKED'){ m.close(); return; }
    toast('Save failed: '+(e.message||'network error'),'error'); setBusy(btn, false);
  }
}
/* ── ORDER HISTORY ─────────────────────────────────────────── */
S.histOpen = new Set();     // orders whose parts list is expanded
S.histEditKey = null;       // 'orderId:partCode' being edited inline
S.histEditPart = null;      // working copy of that part

function renderHistory(area){
  area = area || document.getElementById('page-area');
  const owners = histOwners();
  area.innerHTML = `
  ${topBar('Order History', `<span id="hist-count">${fmtI(S.orders.length)}</span> orders`, false,
    `<button class="btn btn-ghost btn-md" id="hs-export">${ICONS.download}<span class="hide-xs">Export</span></button>`)}
  <div class="page-body">
    <div class="hist-tools anim-up">
      <div class="search-box" id="hs-box">
        <span class="sb-ic">${ICONS.search}</span>
        <input id="hs-inp" value="${esc(S.histSearch)}" placeholder="Search invoice no., part code or description…" autocomplete="off"/>
        <button class="search-clear" id="hs-clear" style="${S.histSearch?'':'display:none'}">${ICONS.close}</button>
      </div>
      ${isAdmin() ? `<div class="select-wrap"><span class="ig-ic">${ICONS.users}</span><select id="hs-user">${histOwnerOptions(owners)}</select></div>` : ''}
    </div>
    <div class="pill-row anim-up">
      ${[['all','All'],...PART_STATUSES.map(s=>[s,STATUS[s].short])].map(([v,l])=>`<button class="pill ${S.histStatusFilter.has(v)?'active':''} ${v!=='all'?'pill-'+v:''}" data-f="${v}">${v!=='all'?'<span class="dot"></span>':''}${l}</button>`).join('')}
      <button class="pill" data-f="draft" style="${S.histDraftsOnly?'':''}" id="hs-drafts">${ICONS.edit}Drafts</button>
    </div>
    <div class="hist-list" id="hist-list"></div>
  </div>`;
  updateHistList();
  const si = document.getElementById('hs-inp');
  const run = debounce(()=>{ S.histLimit = 50; updateHistList(); }, 140);
  si.oninput = () => { S.histSearch = si.value; document.getElementById('hs-clear').style.display = si.value?'':'none'; run(); };
  document.getElementById('hs-clear').onclick = () => { S.histSearch=''; si.value=''; document.getElementById('hs-clear').style.display='none'; si.focus(); updateHistList(); };
  document.getElementById('hs-user')?.addEventListener('change', e=>{ S.histUser = e.target.value; S.histLimit=50; updateHistList(); });
  document.getElementById('hs-drafts').classList.toggle('active', !!S.histDraftsOnly);
  document.getElementById('hs-drafts').onclick = e => { S.histDraftsOnly = !S.histDraftsOnly; e.currentTarget.classList.toggle('active', S.histDraftsOnly); S.histLimit=50; updateHistList(); };
  area.querySelectorAll('.pill[data-f]:not(#hs-drafts)').forEach(b=>b.onclick=()=>{
    const v = b.dataset.f;
    if(v==='all') S.histStatusFilter = new Set(['all']);
    else {
      S.histStatusFilter.delete('all');
      S.histStatusFilter.has(v) ? S.histStatusFilter.delete(v) : S.histStatusFilter.add(v);
      if(!S.histStatusFilter.size) S.histStatusFilter = new Set(['all']);
    }
    area.querySelectorAll('.pill[data-f]:not(#hs-drafts)').forEach(p=>p.classList.toggle('active', S.histStatusFilter.has(p.dataset.f)));
    S.histLimit = 50; updateHistList();
  });
  document.getElementById('hs-export').onclick = () => showExportModal({});
}

// Every user who has orders, plus every user account (so the list is right even
// before orders have arrived). A filter on a user who no longer exists is cleared.
function histOwners(){
  if(!isAdmin()) return [];
  const set = new Set(S.orders.map(o=>o.created_by).filter(Boolean));
  (S.users||[]).forEach(u=>u && u.username && set.add(u.username));
  if(S.histUser!=='all' && !set.has(S.histUser) && S.orders.length) S.histUser = 'all';
  return [...set].sort((a,b)=>a.localeCompare(b));
}
function histOwnerOptions(owners){
  const n = u => S.orders.reduce((c,o)=>c+(o.created_by===u?1:0),0);
  return `<option value="all" ${S.histUser==='all'?'selected':''}>All users (${fmtI(S.orders.length)})</option>` +
    owners.map(u=>`<option value="${esc(u)}" ${S.histUser===u?'selected':''}>${esc(u)} (${fmtI(n(u))})</option>`).join('');
}
function clearHistFilters(){
  S.histSearch=''; S.histStatusFilter=new Set(['all']); S.histUser='all'; S.histDraftsOnly=false; S.histLimit=50;
  renderHistory();
}

function filteredOrders(){
  const q = S.histSearch.trim().toLowerCase();
  const all = S.histStatusFilter.has('all');
  return S.orders.filter(o=>{
    if(S.histDraftsOnly && !isDraft(o)) return false;
    if(isAdmin() && S.histUser!=='all' && o.created_by!==S.histUser) return false;
    if(!all && !(o.parts||[]).some(p=>S.histStatusFilter.has(p.status))) return false;
    if(!q) return true;
    if(String(o.invoice_no||'').toLowerCase().includes(q) || String(o.sheet_name||'').toLowerCase().includes(q)) return true;
    return (o.parts||[]).some(p=>String(p.part_code||'').toLowerCase().includes(q) || String(p.description||'').toLowerCase().includes(q));
  });
}

function updateHistList(){
  const list = document.getElementById('hist-list'); if(!list) return;
  S._histDirty = false;
  // keep the user dropdown in step with the data (orders/users may arrive after the page was drawn)
  const sel = document.getElementById('hs-user');
  if(sel){ const html = histOwnerOptions(histOwners()); if(sel._h !== html){ sel.innerHTML = html; sel._h = html; } sel.value = S.histUser; }
  const orders = filteredOrders();
  const cnt = document.getElementById('hist-count'); if(cnt) cnt.textContent = fmtI(orders.length) + (orders.length!==S.orders.length ? ' of '+fmtI(S.orders.length) : '');
  if(!orders.length){
    const filtered = S.histSearch || !S.histStatusFilter.has('all') || S.histUser!=='all' || S.histDraftsOnly;
    list.innerHTML = emptyState('history','No orders found', filtered ? 'No order matches the current search or filter.' : 'Create your first order');
    if(filtered && S.orders.length){
      list.firstElementChild?.insertAdjacentHTML('beforeend', `<button class="btn btn-primary btn-md" id="hs-reset" style="margin-top:14px">${ICONS.close}<span>Clear filters · show all ${fmtI(S.orders.length)}</span></button>`);
      document.getElementById('hs-reset').onclick = clearHistFilters;
    }
    return;
  }
  const q = S.histSearch.trim().toLowerCase();
  const showAll = S.histStatusFilter.has('all');
  const shown = orders.slice(0, S.histLimit);
  list.innerHTML = shown.map((o,i)=>{
    const pts = o.parts||[];
    const counts = PART_STATUSES.map(s=>[s, pts.filter(p=>p.status===s).length]).filter(x=>x[1]);
    const active = showAll ? pts : pts.filter(p=>S.histStatusFilter.has(p.status));
    const matches = q ? pts.filter(p=>String(p.part_code||'').toLowerCase().includes(q) || String(p.description||'').toLowerCase().includes(q)) : [];
    const open = S.histOpen.has(o.id) || matches.length>0;
    const partsToShow = matches.length ? matches : active;
    return `<article class="hist-card ${isDraft(o)?'is-draft':''}" style="animation-delay:${Math.min(i*.03,.3)}s" data-id="${o.id}">
      <div class="hc-head">
        <div class="hc-main">
          <div class="hc-inv">${isDraft(o)?'':'#'}${hl(o.invoice_no, S.histSearch)} ${isDraft(o)?'<span class="chip chip-draft">Draft</span>':''}</div>
          <div class="hc-meta">${ICONS.calendar}${fmtDate(o.invoice_date)} · ${hl(o.sheet_name||'-', S.histSearch)} · ${plural(pts.length,'part')}</div>
          <div class="hc-by"><span class="owner-chip" title="Created by ${esc(o.created_by||'unknown')}"><span class="oc-av">${esc(initials(o.created_by))}</span>Created by <b>${esc(o.created_by||'unknown')}</b></span>${o.created_at?`<span class="hc-when">${fmtDateTime(o.created_at)}</span>`:''}</div>
          <div class="hc-badges">${counts.map(([s,n])=>`<span class="badge st-${s}"><span class="dot"></span>${n} ${STATUS[s].short}</span>`).join('')}</div>
        </div>
        <div class="hc-amt"><b>₹${fmt(o.total_invoice_mrp)}</b><small>Invoice MRP</small></div>
      </div>
      ${matches.length ? `<div class="match-label">${ICONS.search}${matches.length} matching part${matches.length>1?'s':''}</div>` :
        `<button class="parts-toggle ${open?'open':''}" data-toggle="${o.id}"><span>${open?'Hide':'Show'} ${active.length} part${active.length!==1?'s':''}${!showAll?' (filtered)':''}</span>${ICONS.chevD}</button>`}
      ${open ? `<div class="hc-parts">${partsToShow.map(p=>histPartRow(o,p)).join('')}</div>` : ''}
      <div class="hc-actions">
        <button class="act act-edit" data-ac="edit">${ICONS.edit}<span>${isDraft(o)?'Finalise':'Edit'}</span></button>
        <button class="act act-rename" data-ac="rename">${ICONS.tag}<span>Rename</span></button>
        <button class="act act-excel" data-ac="excel">${ICONS.download}<span>Excel</span></button>
        <button class="act act-pdf" data-ac="pdf">${ICONS.file}<span>PDF</span></button>
        <button class="act act-del" data-ac="delete">${ICONS.trash}<span>Delete</span></button>
      </div>
    </article>`;
  }).join('') + (orders.length > shown.length ? `<button class="btn btn-ghost btn-block more-btn" id="hs-more">Show ${Math.min(50, orders.length-shown.length)} more <span class="muted">(${fmtI(orders.length-shown.length)} left)</span></button>` : '');

  document.getElementById('hs-more')?.addEventListener('click', ()=>{ S.histLimit += 50; updateHistList(); });
  list.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{ const id=Number(b.dataset.toggle); S.histOpen.has(id)?S.histOpen.delete(id):S.histOpen.add(id); updateHistList(); });
  list.querySelectorAll('.hp-row').forEach(r=>r.onclick=()=>{
    const key = r.dataset.key;
    if(S.histEditKey===key){ S.histEditKey=null; S.histEditPart=null; }
    else {
      const [oid, ...rest] = key.split(':'); const code = rest.join(':');
      const o = S.orders.find(x=>x.id==oid); const p = o?.parts?.find(x=>x.part_code===code);
      S.histEditKey = key; S.histEditPart = p ? {...p} : null;
    }
    updateHistList();
  });
  const editEl = list.querySelector('.edit-panel');
  if(editEl){
    bindPartEditor(editEl, () => S.histEditPart, (f, was) => {
      if(f==='status' && S.histEditPart.status==='received' && was!=='received'){
        showDCDialog(S.histEditPart, { onSave:()=>updateHistList(), onCancel:()=>{ S.histEditPart.status = was||'short'; updateHistList(); } });
      }
    });
    editEl.querySelector('.ep-save').onclick = e => saveHistPartEdit(e.currentTarget, editEl);
    editEl.querySelector('.ep-cancel').onclick = () => { S.histEditKey=null; S.histEditPart=null; updateHistList(); };
  }
  list.querySelectorAll('.act').forEach(b=>b.onclick=e=>{
    const o = S.orders.find(x=>x.id==b.closest('.hist-card').dataset.id); if(!o) return;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    switch(b.dataset.ac){
      case 'edit': editOrder(o); break;
      case 'rename': showRenameModal(o); break;
      case 'excel': exportOrderExcel(o); break;
      case 'pdf': exportOrderPDF(o); break;
      case 'delete': deleteOrder(o); break;
    }
  });
}
function histPartRow(o, p){
  const key = o.id+':'+p.part_code;
  const editing = S.histEditKey===key && S.histEditPart;
  return `<div class="hp ${editing?'editing':''}">
    <button class="hp-row" data-key="${esc(key)}">
      <span class="code">${hl(p.part_code, S.histSearch)}</span>
      <span class="hp-desc">${p.description ? hl(p.description, S.histSearch) : '-'}</span>
      <span class="hp-qty">×${qtyOf(p)}</span>
      <span class="mini-dot st-${p.status||'short'}" title="${STATUS[p.status||'short'].short}"></span>
      <span class="hp-chev">${ICONS.chevD}</span>
    </button>
    ${editing ? `<div class="edit-panel">${partEditorHTML(S.histEditPart, { action:`<button class="btn btn-ghost ep-cancel">Cancel</button><button class="btn btn-primary ep-save">${ICONS.save}<span>Save</span></button>` })}</div>` : ''}
  </div>`;
}
async function saveHistPartEdit(btn, editEl){
  if(lockBlocksMe()){ handleLockedAttempt(); return; }
  const p = S.histEditPart; if(!p) return;
  if(p.sr_no==='' || p.sr_no==null){ markSrMissing(editEl); shake(btn); return; }
  if(p.status==='received' && !p.dc_no && !p.credit_note){ editEl.querySelector('.pe-err').textContent='Add the challan or credit note details for this received part'; shake(btn); return; }
  const [oidStr, ...rest] = S.histEditKey.split(':'); const code = rest.join(':');
  const order = S.orders.find(o=>o.id==oidStr); if(!order) return;
  const before = { parts: order.parts, total_invoice_mrp: order.total_invoice_mrp };
  const parts = (order.parts||[]).map(x=>x.part_code===code ? withTotals({...p}) : x);
  const t = orderTotals(parts);
  setBusy(btn, true);
  try {
    const { data, error } = await sb.from('short_orders').update({ parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:new Date().toISOString() }).eq('id', order.id).select('id,updated_at');
    if(error) throw error;
    if(!data?.length){ toast('This order was deleted on another device','error'); await loadOrders(); S.histEditKey=null; updateHistList(); return; }
    Object.assign(order, { parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, updated_at:data[0].updated_at });
    logActivity('order','updated',order.id,order.invoice_no,`Edited part ${code} in history`, before, { parts, total_invoice_mrp:t.invoice });
    toast(`Part ${code} updated`);
    S.histEditKey = null; S.histEditPart = null;
    updateHistList();
  } catch(e){ if(e.code!=='APP_LOCKED') toast('Save failed: '+(e.message||''),'error'); setBusy(btn,false); }
}

function showRenameModal(order){
  const m = openModal({ title:'Rename order', sub:'Change the invoice number and date', icon:'tag', size:'sm',
    body:`
      <label class="field-label" for="rn-inv">Invoice number</label>
      <div class="input-group"><span class="ig-ic">${ICONS.receipt}</span><input id="rn-inv" class="mono" type="text" value="${esc(isDraft(order)?'':order.invoice_no)}" placeholder="${esc(order.invoice_no)}"/></div>
      <div class="form-err" id="rn-err"></div>
      <label class="field-label" for="rn-date">Invoice date</label>
      <div class="input-group"><span class="ig-ic">${ICONS.calendar}</span><input id="rn-date" type="date" value="${esc(String(order.invoice_date||localISODate()).slice(0,10))}"/></div>
      <div class="field-hint" id="rn-hint">${fmtDMY(order.invoice_date)}</div>
      <div class="note">Current: <b class="mono">${esc(order.invoice_no)}</b> · ${fmtDate(order.invoice_date)}</div>`,
    footer:`<button class="btn btn-ghost" id="rn-cxl">Cancel</button><button class="btn btn-primary" id="rn-ok">${ICONS.check}<span>Save</span></button>` });
  const inv = m.q('#rn-inv'); setTimeout(()=>{ inv.focus(); inv.select(); }, 80);
  m.q('#rn-date').oninput = e => m.q('#rn-hint').textContent = fmtDMY(e.target.value);
  m.q('#rn-cxl').onclick = m.close;
  inv.onkeydown = e => { if(e.key==='Enter') m.q('#rn-ok').click(); };
  m.q('#rn-ok').onclick = async () => {
    const newInv = inv.value.trim(), newDate = m.q('#rn-date').value;
    if(!newInv){ m.q('#rn-err').textContent = 'Invoice number required'; return; }
    if(!newDate){ toast('Date required','error'); return; }
    const btn = m.q('#rn-ok'); setBusy(btn, true);
    try {
      const { data, error } = await sb.from('short_orders').update({ invoice_no:newInv, invoice_date:newDate, updated_at:new Date().toISOString() }).eq('id', order.id).select().maybeSingle();
      if(error) throw error;
      if(!data){ m.close(); toast('This order was deleted on another device','error'); await loadOrders(); updateHistList(); return; }
      logActivity('order','renamed',order.id,newInv,`Renamed "${order.invoice_no}" → "${newInv}"`, { invoice_no:order.invoice_no, invoice_date:order.invoice_date }, { invoice_no:newInv, invoice_date:newDate });
      Object.assign(order, data); sortOrders(S.orders);
      m.close(); toast(`Renamed to #${newInv}`); softRefresh('orders');
    } catch(e){ if(e.code!=='APP_LOCKED') toast('Rename failed: '+(e.message||''),'error'); setBusy(btn,false); }
  };
}

async function deleteOrder(order){
  const ok = await confirmDialog({ title:'Delete order?', icon:'trash',
    body:`Order <b class="mono">${esc(order.invoice_no)}</b> with ${plural((order.parts||[]).length,'part')} (₹${fmt(order.total_invoice_mrp)}) will be deleted.${isAdmin()?'<br><br>You can restore it later from Admin → Activity (kept 30 days).':'<br><br>Only the admin can restore it afterwards.'}`,
    confirm:'Delete' });
  if(!ok) return;
  try {
    const { data, error } = await sb.from('short_orders').delete().eq('id', order.id).select('id');
    if(error) throw error;
    const { id, ...snap } = order;
    if(data?.length) logActivity('order','deleted',order.id,order.invoice_no,`Deleted #${order.invoice_no} — ${plural((order.parts||[]).length,'part')}, ₹${fmt(order.total_invoice_mrp)}`, snap, null);
    S.orders = S.orders.filter(o=>o.id!==order.id);
    toast('Order deleted', 'info');
    softRefresh('orders'); renderNavBadges();
  } catch(e){ if(e.code!=='APP_LOCKED') toast('Delete failed: '+(e.message||''),'error'); }
}
/* ── EXPORTS (Excel + PDF) — one engine for every report ───── */
function safeFile(s){ return String(s||'report').replace(/[\/\\:*?"<>|\s]+/g,'_').slice(0,80); }

// groups: [{ order, parts }]
function buildGroups(orders, statuses){
  return orders.map(o=>{
    let parts = (o.parts||[]).filter(p=>!statuses || statuses.includes(p.status));
    parts = parts.slice().sort((a,b)=>(parseInt(a.sr_no)||0)-(parseInt(b.sr_no)||0));
    return { order:o, parts };
  }).filter(g=>g.parts.length);
}

function exportExcel({ title, filename, groups, statuses }){
  const showStatus = !statuses || statuses.length !== 1;
  const showReceipt = groups.some(g=>g.parts.some(p=>p.status==='received'));
  const showOwner = isAdmin() && new Set(groups.map(g=>g.order.created_by)).size > 1;
  const cols = ['Sr No','Invoice No','Invoice Date'];
  if(showOwner) cols.push('Created By');
  cols.push('Inv Sr No','Part Code','Alt Code','HSN No','Description');
  if(showStatus) cols.push('Status');
  if(showReceipt) cols.push('Receipt Type','DC No','LR No','Transport','Credit Note Ref','CN Amount');
  cols.push('Actual MRP','Printed MRP','Invoice MRP','Qty','Total Actual','Total Printed','Total Invoice');
  const C = Object.fromEntries(cols.map((c,i)=>[c,i]));
  const rows = [
    ['Siddheshwar Automobile — '+title],
    ['Generated:', fmtDMY(new Date()), '', 'Invoices:', groups.length, '', 'By:', S.user],
    [],
    cols,
  ];
  let sr = 1; const G = { a:0, p:0, i:0, q:0 };
  groups.forEach(({order:o, parts})=>{
    const sub = { a:0, p:0, i:0, q:0 };
    parts.forEach(p=>{
      const x = partTotals(p); sub.a+=x.a; sub.p+=x.p; sub.i+=x.i; sub.q+=x.q;
      const r = new Array(cols.length).fill('');
      r[C['Sr No']] = sr++; r[C['Invoice No']] = String(o.invoice_no); r[C['Invoice Date']] = fmtDMY(o.invoice_date);
      if(showOwner) r[C['Created By']] = o.created_by||'';
      r[C['Inv Sr No']] = String(p.sr_no??''); r[C['Part Code']] = String(p.part_code||''); r[C['Alt Code']] = String(p.alt_code||'');
      r[C['HSN No']] = String(p.hsn_no||''); r[C['Description']] = p.description||'';
      if(showStatus) r[C['Status']] = p.status==='wrong' ? 'Wrong Item' : (STATUS[p.status]?.short || 'Short');
      if(showReceipt && p.status==='received'){
        const cn = !!p.credit_note;
        r[C['Receipt Type']] = cn ? 'CREDIT NOTE' : (p.dc_no ? 'CHALLAN' : '');
        if(!cn){ r[C['DC No']] = String(p.dc_no||''); r[C['LR No']] = String(p.lr_no||''); r[C['Transport']] = p.transport_name||''; }
        else { r[C['Credit Note Ref']] = String(p.credit_note); r[C['CN Amount']] = num(p.credit_note_amount); }
      }
      r[C['Actual MRP']] = num(p.actual_mrp); r[C['Printed MRP']] = num(p.printed_mrp); r[C['Invoice MRP']] = num(p.invoice_mrp);
      r[C['Qty']] = x.q; r[C['Total Actual']] = x.a; r[C['Total Printed']] = x.p; r[C['Total Invoice']] = x.i;
      rows.push(r);
    });
    G.a+=sub.a; G.p+=sub.p; G.i+=sub.i; G.q+=sub.q;
    const s = new Array(cols.length).fill('');
    s[C['Description']] = 'Subtotal ('+o.invoice_no+')';
    s[C['Qty']] = sub.q; s[C['Total Actual']] = sub.a; s[C['Total Printed']] = sub.p; s[C['Total Invoice']] = sub.i;
    rows.push(s, []);
  });
  const g = new Array(cols.length).fill('');
  g[C['Description']] = 'GRAND TOTAL';
  g[C['Qty']] = G.q; g[C['Total Actual']] = G.a; g[C['Total Printed']] = G.p; g[C['Total Invoice']] = G.i;
  rows.push(g);
  const widths = { 'Sr No':5,'Invoice No':18,'Invoice Date':12,'Created By':14,'Inv Sr No':9,'Part Code':16,'Alt Code':14,'HSN No':11,'Description':32,'Status':11,
    'Receipt Type':13,'DC No':15,'LR No':15,'Transport':18,'Credit Note Ref':16,'CN Amount':12,'Actual MRP':12,'Printed MRP':12,'Invoice MRP':12,'Qty':6,'Total Actual':14,'Total Printed':14,'Total Invoice':14 };
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols.map(c=>({ wch: widths[c]||12 }));
  XLSX.utils.book_append_sheet(wb, ws, title.replace(/[\\\/?*\[\]:]/g,'').slice(0,31) || 'Report');
  XLSX.writeFile(wb, safeFile(filename)+'.xlsx');
  toast('Excel downloaded');
}

function exportPDF({ title, subtitle='', groups, statuses, color='#4B3FD1' }){
  const showStatus = !statuses || statuses.length !== 1;
  const showReceipt = groups.some(g=>g.parts.some(p=>p.status==='received'));
  const grand = groups.reduce((s,g)=>s+g.parts.reduce((s2,p)=>s2+partTotals(p).i,0),0);
  let sr = 1;
  const pill = s => { const c = STATUS[s]||STATUS.short; return `<span class="st" style="background:${c.bg};color:${c.text};border-color:${c.border}">${c.short==='Wrong'?'Wrong Item':c.short}</span>`; };
  const blocks = groups.map(({order:o, parts})=>{
    const T = parts.reduce((t,p)=>{ const x=partTotals(p); t.a+=x.a; t.p+=x.p; t.i+=x.i; t.q+=x.q; return t; },{a:0,p:0,i:0,q:0});
    const lead = 5 + (showStatus?1:0) + (showReceipt?1:0);
    return `<section class="blk">
      <div class="bh"><div><div class="inv">#${esc(o.invoice_no)}</div><div class="bm">${fmtDate(o.invoice_date)} · ${plural(parts.length,'part')}${isAdmin()&&o.created_by?' · by '+esc(o.created_by):''}</div></div>
        <div class="bt"><small>Invoice MRP total</small><b>₹${fmt(T.i)}</b></div></div>
      <table><thead><tr><th>#</th><th>Part code</th><th>Description</th><th class="c">Inv Sr</th><th>HSN</th>${showStatus?'<th>Status</th>':''}${showReceipt?'<th>Receipt</th>':''}
        <th class="r">Actual</th><th class="r">Printed</th><th class="r">Inv MRP</th><th class="r">Qty</th><th class="r">Total</th></tr></thead>
      <tbody>${parts.map(p=>{ const x = partTotals(p); return `<tr>
        <td class="m">${sr++}</td><td class="code">${esc(p.part_code)}${p.alt_code?`<div class="alt">Alt ${esc(p.alt_code)}</div>`:''}</td><td>${esc(p.description||'-')}</td>
        <td class="c b">${esc(p.sr_no??'-')}</td><td class="mono">${esc(p.hsn_no||'-')}</td>
        ${showStatus?`<td>${pill(p.status)}</td>`:''}
        ${showReceipt?`<td>${p.status!=='received'?'—':p.credit_note?`<div class="rc cn"><b>Credit note</b><div>${esc(p.credit_note)}</div><div>₹${fmt(p.credit_note_amount)}</div></div>`:p.dc_no?`<div class="rc dc"><b>Challan</b><div>DC ${esc(p.dc_no)}</div>${p.lr_no?`<div>LR ${esc(p.lr_no)}</div>`:''}${p.transport_name?`<div>${esc(p.transport_name)}</div>`:''}</div>`:'—'}</td>`:''}
        <td class="r mono">₹${fmt(p.actual_mrp)}</td><td class="r mono">₹${fmt(p.printed_mrp)}</td><td class="r mono b">₹${fmt(p.invoice_mrp)}</td>
        <td class="r b">${x.q}</td><td class="r mono tot">₹${fmt(x.i)}</td></tr>`; }).join('')}
      <tr class="sub"><td colspan="${lead}" class="r">SUBTOTAL</td><td class="r mono">₹${fmt(T.a)}</td><td class="r mono">₹${fmt(T.p)}</td><td class="r mono">₹${fmt(T.i)}</td><td class="r">${T.q}</td><td class="r mono tot">₹${fmt(T.i)}</td></tr>
      </tbody></table></section>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Inter,Arial,sans-serif;color:#1B1940;font-size:12px;padding:28px 32px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body::before{content:'SIDDHESHWAR AUTOMOBILE';position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-32deg);font-size:54px;font-weight:900;color:rgba(75,63,209,.05);white-space:nowrap;letter-spacing:4px;z-index:-1}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;margin-bottom:20px;border-bottom:3px solid ${color}}
    .brand{font-size:21px;font-weight:800;color:#26217A}.sub{font-size:11px;letter-spacing:1.6px;color:${color};font-weight:700;margin-top:4px;text-transform:uppercase}
    .meta{text-align:right;line-height:1.8;color:#2F3157}.meta b{color:#1B1940}
    .blk{margin-bottom:22px;break-inside:avoid;border:1px solid #DCDFEC;border-radius:10px;overflow:hidden}
    .bh{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#26217A,${color});color:#fff;padding:11px 14px}
    .inv{font-family:Consolas,monospace;font-size:16px;font-weight:800}.bm{font-size:11px;opacity:.85;margin-top:2px}
    .bt{text-align:right}.bt small{display:block;font-size:10px;opacity:.8}.bt b{font-family:Consolas,monospace;font-size:17px}
    table{width:100%;border-collapse:collapse}
    th{background:#EEEDFD;color:#382EA8;font-size:10px;letter-spacing:.4px;text-transform:uppercase;text-align:left;padding:7px 8px}
    td{padding:7px 8px;border-bottom:1px solid #EEEDFD;vertical-align:top}
    tbody tr:nth-child(even) td{background:#F8F8FD}
    .r{text-align:right}.c{text-align:center}.b{font-weight:700}.m{color:#4F5478}.mono{font-family:Consolas,monospace}
    .code{font-family:Consolas,monospace;font-weight:800;color:#382EA8}.alt{font-size:10px;color:#4F5478;font-weight:500}
    .tot{font-weight:900;color:#26217A}
    .st{display:inline-block;border:1px solid;border-radius:20px;padding:1px 8px;font-size:10px;font-weight:700;white-space:nowrap}
    .rc{border-radius:6px;padding:4px 7px;font-size:10.5px;line-height:1.45}.rc b{font-size:9.5px;letter-spacing:.4px;text-transform:uppercase}
    .rc.dc{background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0}.rc.cn{background:#FFF7ED;color:#7C2D12;border:1px solid #FED7AA}
    tr.sub td{background:#EEEDFD!important;font-weight:800;color:#382EA8;border-top:2px solid #CDC8FB}
    .grand{margin-top:8px;display:flex;justify-content:flex-end}.grand div{background:linear-gradient(135deg,#26217A,${color});color:#fff;border-radius:10px;padding:12px 20px;text-align:right}
    .grand small{display:block;font-size:10px;letter-spacing:1px;opacity:.85}.grand b{font-family:Consolas,monospace;font-size:22px}
    .foot{margin-top:18px;text-align:center;font-size:10px;color:#4F5478;border-top:1px solid #DCDFEC;padding-top:10px}
    @media print{body{padding:0}@page{margin:1.3cm}}
  </style></head><body>
  <div class="hdr"><div><div class="brand">Siddheshwar Automobile</div><div class="sub">${esc(title)}</div>${subtitle?`<div style="margin-top:4px;color:#2F3157">${subtitle}</div>`:''}</div>
    <div class="meta"><div>Generated <b>${fmtDate(new Date())}</b> by <b>${esc(S.user)}</b></div><div>Invoices <b>${groups.length}</b></div><div>Grand total <b>₹${fmt(grand)}</b></div></div></div>
  ${blocks}
  <div class="grand"><div><small>GRAND TOTAL — INVOICE MRP</small><b>₹${fmt(grand)}</b></div></div>
  <div class="foot">Siddheshwar Automobile — Short / Damaged Parts Tracker · ${fmtDate(new Date())}</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ toast('Allow pop-ups to export PDF','error'); return; }
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>w.print(), 650);
  toast('PDF ready — print or “Save as PDF”');
}

function exportOrderExcel(o){ exportExcel({ title:'Order '+o.invoice_no, filename:'SA_'+o.invoice_no, groups:buildGroups([o], null), statuses:null }); }
function exportOrderPDF(o){ exportPDF({ title:'Short / Damaged Parts Order', subtitle:`Invoice <b>#${esc(o.invoice_no)}</b> · ${fmtDate(o.invoice_date)}`, groups:buildGroups([o], null), statuses:null }); }

/* ── EXPORT DIALOG (History + status pages) ────────────────── */
function showStatusExportModal(st){ showExportModal({ status: st }); }
function showExportModal({ status }){
  let statuses = new Set(status && status!=='all' ? [status] : ['all']);
  let user = isAdmin() ? (S.histUser||'all') : 'all';
  let from = '', to = '', invQ = '';
  const baseOrders = () => S.orders.filter(o=>{
    if(user!=='all' && o.created_by!==user) return false;
    if(from && String(o.invoice_date) < from) return false;
    if(to && String(o.invoice_date) > to) return false;
    if(!statuses.has('all') && !(o.parts||[]).some(p=>statuses.has(p.status))) return false;
    return true;
  });
  let selected = new Set(baseOrders().map(o=>o.id));
  const statusList = () => statuses.has('all') ? null : [...statuses];
  const owners = isAdmin() ? [...new Set(S.orders.map(o=>o.created_by).filter(Boolean))].sort() : [];

  const m = openModal({ title:'Export report', sub:'Choose what to include, then download Excel or PDF', icon:'download', size:'lg',
    body:`
      <div class="field-label">Status</div>
      <div class="pill-row" id="ex-st">${[['all','All'],...PART_STATUSES.map(s=>[s,STATUS[s].short])].map(([v,l])=>`<button class="pill ${v!=='all'?'pill-'+v:''}" data-v="${v}">${v!=='all'?'<span class="dot"></span>':''}${l}</button>`).join('')}</div>
      <div class="grid-2">
        <div><div class="field-label">From</div><div class="input-group"><input type="date" id="ex-from"/></div></div>
        <div><div class="field-label">To</div><div class="input-group"><input type="date" id="ex-to"/></div></div>
      </div>
      ${isAdmin()?`<div class="field-label">User</div><div class="select-wrap"><span class="ig-ic">${ICONS.users}</span><select id="ex-user"><option value="all">All users</option>${owners.map(u=>`<option ${u===user?'selected':''} value="${esc(u)}">${esc(u)}</option>`).join('')}</select></div>`:''}
      <div class="field-label">Invoices <span class="muted" id="ex-sel-n"></span></div>
      <div class="inv-pick">
        <div class="inv-pick-head"><label class="check"><input type="checkbox" id="ex-all"/><span>Select all</span></label>
          <div class="mini-search">${ICONS.search}<input id="ex-q" placeholder="Find invoice…"/></div></div>
        <div class="inv-pick-list" id="ex-list"></div>
      </div>
      <div class="preview" id="ex-prev"></div>`,
    footer:`<button class="btn btn-ghost" id="ex-cxl">Cancel</button><button class="btn btn-green" id="ex-xls">${ICONS.sheet}<span>Excel</span></button><button class="btn btn-primary" id="ex-pdf">${ICONS.file}<span>PDF</span></button>` });

  const refresh = (keepSel) => {
    const orders = baseOrders();
    const ids = new Set(orders.map(o=>o.id));
    if(!keepSel) selected = new Set(ids); else selected = new Set([...selected].filter(id=>ids.has(id)));
    m.q('#ex-st').querySelectorAll('.pill').forEach(p=>p.classList.toggle('active', statuses.has(p.dataset.v)));
    const visAll = orders.filter(o=>!invQ || String(o.invoice_no).toLowerCase().includes(invQ));
    const vis = visAll.slice(0, 120);          // draw at most 120 rows — selection still covers all
    m.q('#ex-list').innerHTML = vis.length ? vis.map(o=>{
      const sp = (o.parts||[]).filter(p=>statuses.has('all')||statuses.has(p.status));
      return `<label class="inv-item"><input type="checkbox" data-id="${o.id}" ${selected.has(o.id)?'checked':''}/>
        <span class="ii-main"><b class="mono">${isDraft(o)?'':'#'}${esc(o.invoice_no)}</b><small>${fmtDate(o.invoice_date)} · ${plural(sp.length,'part')}${isAdmin()&&o.created_by?' · '+esc(o.created_by):''}</small></span>
        <span class="ii-amt">₹${fmt(sp.reduce((s,p)=>s+partTotals(p).i,0))}</span></label>`; }).join('') + (visAll.length>vis.length?`<div class="empty-mini">+ ${fmtI(visAll.length-vis.length)} more invoices (included when selected) — type above to find one</div>`:'') : `<div class="empty-mini">No invoices match</div>`;
    m.q('#ex-list').querySelectorAll('input[data-id]').forEach(ch=>ch.onchange=()=>{ const id=Number(ch.dataset.id); ch.checked?selected.add(id):selected.delete(id); preview(); });
    preview();
  };
  const preview = () => {
    const groups = buildGroups(S.orders.filter(o=>selected.has(o.id)), statusList());
    const T = groups.reduce((t,g)=>{ g.parts.forEach(p=>{ const x=partTotals(p); t.a+=x.a; t.i+=x.i; t.n++; }); return t; },{a:0,i:0,n:0});
    const total = baseOrders().length;
    m.q('#ex-sel-n').textContent = `(${selected.size} of ${total} selected)`;
    const all = m.q('#ex-all'); all.checked = selected.size===total && total>0; all.indeterminate = selected.size>0 && selected.size<total;
    m.q('#ex-prev').innerHTML = `<div><small>Invoices</small><b>${groups.length}</b></div><div><small>Parts</small><b>${T.n}</b></div><div><small>Actual MRP</small><b>₹${fmt(T.a)}</b></div><div class="pv-main"><small>Invoice MRP</small><b>₹${fmt(T.i)}</b></div>`;
    m.q('#ex-xls').disabled = m.q('#ex-pdf').disabled = !groups.length;
  };
  m.q('#ex-st').querySelectorAll('.pill').forEach(b=>b.onclick=()=>{
    const v = b.dataset.v;
    if(v==='all') statuses = new Set(['all']);
    else { statuses.delete('all'); statuses.has(v)?statuses.delete(v):statuses.add(v); if(!statuses.size) statuses = new Set(['all']); }
    refresh(false);
  });
  m.q('#ex-from').onchange = e => { from = e.target.value; refresh(false); };
  m.q('#ex-to').onchange = e => { to = e.target.value; refresh(false); };
  m.q('#ex-user')?.addEventListener('change', e=>{ user = e.target.value; refresh(false); });
  m.q('#ex-q').oninput = debounce(e=>{ invQ = m.q('#ex-q').value.trim().toLowerCase(); refresh(true); }, 120);
  m.q('#ex-all').onchange = e => { if(e.target.checked) baseOrders().forEach(o=>selected.add(o.id)); else selected.clear(); refresh(true); };
  m.q('#ex-cxl').onclick = m.close;
  const run = fmtType => {
    const orders = S.orders.filter(o=>selected.has(o.id)).sort((a,b)=>String(a.invoice_date).localeCompare(String(b.invoice_date)));
    const sl = statusList();
    const groups = buildGroups(orders, sl);
    const label = sl ? sl.map(s=>STATUS[s].label).join(' + ') : 'Short / Damaged Parts';
    const range = (from||to) ? ` · ${from?fmtDMY(from):'start'} – ${to?fmtDMY(to):'today'}` : '';
    if(fmtType==='xls') exportExcel({ title:label+' Report', filename:`SA_${sl?sl.join('_'):'all'}_${from||'all'}_${to||'all'}`, groups, statuses:sl });
    else exportPDF({ title:label+' Report', subtitle:(user!=='all'?'User: <b>'+esc(user)+'</b>':'')+range, groups, statuses:sl });
    m.close();
  };
  m.q('#ex-xls').onclick = () => run('xls');
  m.q('#ex-pdf').onclick = () => run('pdf');
  refresh(false);
}
/* ── PARTS SHEETS (admin) ──────────────────────────────────── */
function renderSheets(area){
  area = area || document.getElementById('page-area');
  const total = S.sheets.reduce((s,x)=>s+Math.max(0, x.part_count||0),0);
  area.innerHTML = `
  ${topBar('Parts Sheets', `${S.sheets.length} catalogue${S.sheets.length!==1?'s':''} · ${plural(total,'part')}`, false,
    `<label class="btn btn-primary btn-md">${ICONS.upload}<span class="hide-xs">Upload sheet</span><input type="file" id="fi-top" accept=".xlsx,.xls,.csv" hidden/></label>`)}
  <div class="page-body">
    <div id="up-prog">${uploadCardHTML()}</div>
    <div class="sheet-list anim-up">
      ${S.sheets.length===0 ? emptyState('sheet','No sheets yet','Upload your Excel parts catalogue below') :
        S.sheets.map((s,i)=>`
        <div class="sheet-card static" style="animation-delay:${i*.05}s">
          <span class="sheet-ic">${ICONS.sheet}</span>
          <span class="sheet-txt"><b>${esc(s.name)}</b><small>${s.part_count<0
            ? (S._upload?.sheetId===s.id && S._upload.state==='run' ? '<span class="uz-run">Uploading now…</span>' : '<span class="uz-bad">Upload did not finish — remove it and upload again</span>')
            : plural(s.part_count||0,'part')+' · uploaded '+fmtDate(s.created_at)}</small></span>
          <span class="sheet-actions">
            ${s.part_count<0 ? '' : `<button class="btn btn-ghost btn-sm" data-add="${s.id}">${ICONS.plus}<span class="hide-xs">Add part</span></button>`}
            <button class="icon-btn danger" data-del="${s.id}" aria-label="Remove sheet">${ICONS.trash}</button>
          </span>
        </div>`).join('')}
    </div>
    <label class="upload-zone anim-up1" id="drop-zone">
      <input type="file" id="fi-zone" accept=".xlsx,.xls,.csv" hidden/>
      <div class="uz-ic">${ICONS.upload}</div>
      <div class="uz-title">Upload parts catalogue</div>
      <div class="uz-sub">Drop an Excel file here or tap to browse · .xlsx .xls .csv · handles 1 lakh+ rows</div>
      <div class="uz-cols">Needs a <b>Part No / Part Code</b> column (title rows above the headings are fine). Optional: Alt code, Description, MRP, HSN, Blocked. You'll see a check screen before anything is saved.</div>
    </label>
  </div>`;
  area.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeSheet(b.dataset.del));
  area.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>showAddPart(b.dataset.add));
  ['fi-top','fi-zone'].forEach(id=>{ const fi=document.getElementById(id); if(fi) fi.onchange=e=>{ handleUpload(e.target.files[0]); e.target.value=''; }; });
  const dz = document.getElementById('drop-zone');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e=>{ const f = e.dataTransfer?.files?.[0]; if(f) handleUpload(f); });
}

/* ── EXCEL UPLOAD ──────────────────────────────────────────────
   1. Read every sheet; find the header row (anywhere in the first 30 rows).
   2. Pick columns by meaning, with priorities (MRP before Price before Rate;
      GST / tax / discount columns are never the price).
   3. Read real cell values (long numeric part codes stay exact).
   4. Show a check screen: columns (changeable), preview, counts → Upload.
   5. Upload in parallel batches with retry; progress survives live refreshes;
      a failed upload removes everything it added. */
const UP_FIELDS = [
  ['partCode','Part code',true], ['altCode','Alt code'], ['description','Description'],
  ['price','MRP / Price'], ['hsn','HSN'], ['blocked','Blocked'],
];
const normH = s => String(s ?? '').toLowerCase().replace(/[\s_\-\/\.\(\)\[\]:#'"]/g,'').replace(/rs$|inr$|₹/g,'');

// Score how well a header name fits each field (0 = not at all)
function headerScores(h){
  const n = normH(h), sc = {};
  if(!n) return sc;
  const isAlt = /alt|alternate|supersed|replac|substitut|newpart|oldpart|newcode|oldcode|interchange/.test(n);
  const isTax = /gst|tax|cgst|sgst|igst|vat|cess|disc|percent|pct|%|margin|qty|quantity|stock|weight|moq|pack/.test(n);
  if(/hsn|sac/.test(n)) sc.hsn = n==='hsn'||n==='hsncode'||n==='hsnno' ? 3 : 2;
  if(/block/.test(n)) sc.blocked = 3;
  if(!sc.hsn && /desc|particular|nomenclature|itemname|partname|materialname|productname|^name$/.test(n)) sc.description = /desc/.test(n) ? 3 : 2;
  if(isAlt && !sc.description && !sc.hsn) sc.altCode = 3;
  if(!isAlt && !sc.description && !sc.hsn){
    if(/^(partno|partnumber|partcode|partnum|partid|sparepartno|sparepartnumber|sparepartcode)$/.test(n)) sc.partCode = 5;
    else if(/partno|partnumber|partcode/.test(n)) sc.partCode = 4;
    else if(/^(itemcode|itemno|itemnumber|materialcode|materialno|materialnumber|material|articleno|articlecode|sku|productcode|code|part)$/.test(n)) sc.partCode = 3;
  }
  if(!isTax && !sc.partCode && !sc.hsn && !sc.description){
    if(/mrp/.test(n)) sc.price = 5;
    else if(/listprice|unitprice|sellingprice|saleprice|^price$|retailprice/.test(n)) sc.price = 4;
    else if(/price/.test(n)) sc.price = 3;
    else if(/^rate$|unitrate|^rate/.test(n)) sc.price = 2;
    else if(/amount|value/.test(n)) sc.price = 1;
  }
  return sc;
}
// Best column index per field (highest score, then leftmost); each column used once
function detectColumns(headers){
  const cand = [];
  headers.forEach((h,i)=>{ const sc = headerScores(h); Object.entries(sc).forEach(([f,v])=>cand.push({f,i,v})); });
  cand.sort((a,b)=>b.v-a.v || a.i-b.i);
  const map = {}, used = new Set();
  for(const c of cand){ if(map[c.f]!=null || used.has(c.i)) continue; map[c.f] = c.i; used.add(c.i); }
  return map;
}

// Cell readers — use the real value, not Excel's display text
function cellCode(c){
  if(!c || c.v==null) return '';
  if(c.t==='n'){
    const w = String(c.w||'').trim();
    if(/^0\d+$/.test(w)) return w;                                  // keep leading zeros shown in Excel
    return Number.isInteger(c.v) ? String(c.v) : String(c.v);        // 100074568000, never "1.00075E+11"
  }
  return String(c.v).trim();
}
const cellText  = c => (!c || c.v==null) ? '' : String(c.t==='n' ? cellCode(c) : (c.w ?? c.v)).replace(/\s+/g,' ').trim();
const cellPrice = c => (!c || c.v==null) ? 0 : (c.t==='n' ? (isFinite(c.v) ? Math.round(c.v*100)/100 : 0) : num(c.v));
const isBlockedVal = v => /^(y|yes|true|1|blocked|block|b)$/i.test(String(v||'').trim());

function analyseSheet(ws, name){
  if(!ws || !ws['!ref']) return null;
  const R = XLSX.utils.decode_range(ws['!ref']);
  const at = (r,c) => ws[XLSX.utils.encode_cell({r,c})];
  let best = null;
  for(let r=R.s.r; r<=Math.min(R.e.r, R.s.r+29); r++){
    const headers = [];
    for(let c=R.s.c; c<=R.e.c; c++) headers.push(cellText(at(r,c)));
    if(headers.filter(Boolean).length < 2) continue;
    const map = detectColumns(headers);
    if(map.partCode==null) continue;
    const score = 10 + Object.keys(map).length;
    if(!best || score > best.score) best = { r, headers, map, score };
  }
  if(!best) return { name, ok:false };
  return { name, ok:true, ws, R, at, headerRow: best.r, headers: best.headers, map: best.map, rows: R.e.r - best.r };
}

// Build part rows for a sheet + column map
function buildParts(sh, map){
  const { R, at } = sh, c0 = R.s.c;
  const col = f => map[f]==null ? null : map[f] + c0;
  const C = { code:col('partCode'), alt:col('altCode'), desc:col('description'), price:col('price'), hsn:col('hsn'), blk:col('blocked') };
  const headerCode = normH(sh.headers[map.partCode]);
  const out = [], seen = new Set();
  let blank = 0, dupes = 0, headersAgain = 0;
  for(let r = sh.headerRow+1; r <= R.e.r; r++){
    const code = cellCode(at(r, C.code)).toUpperCase().replace(/\s+/g,' ');
    if(!code){ blank++; continue; }
    if(normH(code) === headerCode){ headersAgain++; continue; }        // header repeated on every printed page
    const p = {
      part_code: code,
      alt_code: C.alt==null ? '' : cellCode(at(r, C.alt)).toUpperCase(),
      description: C.desc==null ? '' : cellText(at(r, C.desc)),
      price: C.price==null ? 0 : cellPrice(at(r, C.price)),
      hsn_no: C.hsn==null ? '' : cellCode(at(r, C.hsn)),
      is_blocked: C.blk!=null && isBlockedVal(cellText(at(r, C.blk))) ? 'Y' : 'N',
    };
    const key = [p.part_code,p.alt_code,p.description,p.price,p.hsn_no,p.is_blocked].join('\u0001');
    if(seen.has(key)){ dupes++; continue; }                            // exact duplicate row
    seen.add(key); out.push(p);
  }
  return { parts: out, blank, dupes: dupes + headersAgain };
}

async function handleUpload(file){
  if(!file) return;
  if(lockBlocksMe()){ handleLockedAttempt(); return; }
  if(S._upload && S._upload.state==='run'){ toast('An upload is already running — please wait','error'); return; }
  setUpload({ state:'read', file:file.name, title:'Reading Excel file…', pct:3 });
  let wb;
  try {
    const isCSV = /\.csv$/i.test(file.name);
    // CSV: keep every value as text (part codes like 00123 keep their zeros)
    wb = XLSX.read(await file.arrayBuffer(), { type:'array', raw:isCSV, cellDates:false });
  } catch(e){ setUpload({ state:'err', file:file.name, title:'This file could not be read. Save it as .xlsx in Excel and try again.' }); return; }
  const sheets = wb.SheetNames.map(n=>analyseSheet(wb.Sheets[n], n)).filter(Boolean);
  const usable = sheets.filter(s=>s.ok);
  if(!usable.length){
    setUpload({ state:'err', file:file.name, title:'No "Part No / Part Code" column found in any sheet of this file.' });
    showNotice({ tone:'warn', icon:'sheet', title:'Part code column not found',
      body:`None of the sheets in <b>${esc(file.name)}</b> has a column for the part code.<br><br>The header row needs a column named like <b>Part No</b>, <b>Part Number</b>, <b>Part Code</b>, <b>Item Code</b> or <b>Material</b>. Rename that column in Excel and upload again.` });
    return;
  }
  clearUpload();
  showUploadCheck(file, usable);
}

// Check screen before anything is saved
function showUploadCheck(file, usable){
  let sh = usable.slice().sort((a,b)=>b.rows-a.rows)[0];
  let map = { ...sh.map }, built = null;
  const defName = file.name.replace(/\.[^.]+$/,'').trim().slice(0,80);
  const m = openModal({ title:'Check before upload', sub:esc(file.name), icon:'upload', size:'lg', cls:'up-check',
    body:`<div id="uc-body"></div>`,
    footer:`<button class="btn btn-ghost" id="uc-cancel">Cancel</button><button class="btn btn-primary" id="uc-go">${ICONS.upload}<span>Upload</span></button>` });
  const colOpts = (sel) => `<option value="">— not in file —</option>` + sh.headers.map((h,i)=>h ? `<option value="${i}" ${String(sel)===String(i)?'selected':''}>${esc(XLSX.utils.encode_col(sh.R.s.c+i))} · ${esc(h)}</option>` : '').join('');
  const draw = () => {
    built = buildParts(sh, map);
    const P = built.parts, nameVal = m.q('#uc-name')?.value ?? defName;
    const dupName = S.sheets.some(x=>x.name.trim().toLowerCase()===nameVal.trim().toLowerCase());
    const warn = [];
    if(map.price==null) warn.push('No price column selected — every part will be saved with MRP ₹0.');
    else if(P.length && P.every(p=>!p.price)) warn.push('The selected price column has no numbers — check the MRP column.');
    else if(P.length && P.filter(p=>p.price>0 && p.price<=28 && Number.isInteger(p.price)).length > P.length*0.8) warn.push('Most prices are small whole numbers (like a GST %). Make sure the MRP column is selected.');
    const codeLens = new Set(P.slice(0,500).map(p=>p.part_code)); if(P.length>20 && codeLens.size < 5) warn.push('Almost every part code is the same — the wrong column may be selected as Part code.');
    if(dupName) warn.push(`A catalogue named "${esc(nameVal)}" already exists. This upload will be added as a separate catalogue — remove the old one afterwards if this replaces it.`);
    m.q('#uc-body').innerHTML = `
      ${usable.length>1 ? `<label class="field-label">Sheet in this file</label>
        <div class="input-group"><select id="uc-sheet">${usable.map((x,i)=>`<option value="${i}" ${x===sh?'selected':''}>${esc(x.name)} — ${fmtI(x.rows)} rows</option>`).join('')}</select></div>` : ''}
      <label class="field-label" for="uc-name">Catalogue name <i class="req">*</i></label>
      <div class="input-group"><input id="uc-name" maxlength="80" value="${esc(nameVal)}"/></div>
      <div class="uc-stats">
        <span class="uc-stat ok">${ICONS.check}<b>${fmtI(P.length)}</b> parts to upload</span>
        <span class="uc-stat">Header found on row <b>${sh.headerRow+1}</b></span>
        ${built.blank ? `<span class="uc-stat">${fmtI(built.blank)} empty rows skipped</span>` : ''}
        ${built.dupes ? `<span class="uc-stat">${fmtI(built.dupes)} repeated rows skipped</span>` : ''}
      </div>
      <div class="uc-map">${UP_FIELDS.map(([f,l,req])=>`<label class="uc-f"><span>${l}${req?' <i class="req">*</i>':''}</span><select data-f="${f}">${colOpts(map[f])}</select></label>`).join('')}</div>
      ${warn.map(w=>`<div class="uc-warn">${ICONS.alert}<span>${w}</span></div>`).join('')}
      <div class="uc-prev-h">First rows as they will be saved</div>
      <div class="uc-prev"><table><thead><tr><th>Part code</th><th>Alt code</th><th>Description</th><th class="r">MRP</th><th>HSN</th><th>Blocked</th></tr></thead>
        <tbody>${P.slice(0,6).map(p=>`<tr><td class="mono">${esc(p.part_code)}</td><td class="mono">${esc(p.alt_code||'—')}</td><td>${esc(p.description||'—')}</td><td class="r mono">₹${fmt(p.price)}</td><td class="mono">${esc(p.hsn_no||'—')}</td><td>${p.is_blocked==='Y'?'Yes':'No'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No parts found with this Part code column</td></tr>'}</tbody></table></div>`;
    m.q('#uc-sheet')?.addEventListener('change', e=>{ sh = usable[+e.target.value]; map = { ...sh.map }; draw(); });
    m.q('#uc-name').addEventListener('input', debounce(()=>draw(), 300));
    m.q('#uc-body').querySelectorAll('select[data-f]').forEach(sel=>sel.onchange=()=>{
      const f = sel.dataset.f, v = sel.value==='' ? null : +sel.value;
      Object.keys(map).forEach(k=>{ if(k!==f && map[k]===v && v!=null) delete map[k]; });   // one column → one field
      if(v==null) delete map[f]; else map[f] = v;
      if(map.partCode==null){ toast('Part code column is required','error'); }
      draw();
    });
    const go = m.q('#uc-go');
    go.disabled = !P.length || map.partCode==null;
    go.querySelector('span').textContent = P.length ? `Upload ${fmtI(P.length)} parts` : 'Upload';
  };
  draw();
  m.q('#uc-cancel').onclick = m.close;
  m.q('#uc-go').onclick = () => {
    const name = m.q('#uc-name').value.trim();
    if(!name){ m.q('#uc-name').focus(); toast('Give the catalogue a name','error'); return; }
    const parts = built.parts; m.close();
    uploadParts(file.name, name, parts, built);
  };
}

/* Upload progress lives in S._upload so a live refresh of this screen redraws it */
function setUpload(u){ S._upload = { ...(S._upload||{}), ...u }; drawUpload(); }
function clearUpload(){ S._upload = null; drawUpload(); }
function uploadCardHTML(){
  const u = S._upload; if(!u) return '';
  const p = Math.max(0, Math.min(100, Math.round(u.pct||0)));
  const st = u.state==='err' ? 'err' : u.state==='ok' ? 'ok' : 'run';
  return `<div class="up-card up-${st}" role="status" aria-live="polite">
    <span class="up-ic">${st==='err'?ICONS.alert:st==='ok'?ICONS.check:ICONS.upload}</span>
    <div class="up-main"><b>${esc(u.title||'')}</b><small>${esc(u.file||'')}${u.total?` · ${fmtI(u.done||0)} of ${plural(u.total,'part')}`:''}${u.note?` · ${esc(u.note)}`:''}</small>
      ${st==='run'?`<div class="up-bar"><div style="width:${p}%"></div></div>`:''}</div>
    ${st==='run'?`<span class="up-pct">${p}%</span>`:`<button class="icon-btn" data-up-x aria-label="Dismiss">${ICONS.close}</button>`}</div>`;
}
function drawUpload(){
  const el = document.getElementById('up-prog'); if(!el) return;
  el.innerHTML = uploadCardHTML();
}
// One click handler for the ✕ on the upload card, however the card was drawn
// (the screen redraws itself after an upload and on live updates)
document.addEventListener('click', e => { if(e.target.closest && e.target.closest('[data-up-x]')) clearUpload(); });
function _upLeaveGuard(e){ e.preventDefault(); e.returnValue = ''; return ''; }

async function uploadParts(fileName, name, parts, info){
  const total = parts.length;
  setUpload({ state:'run', file:fileName, title:'Creating catalogue…', done:0, total, pct:4, note:'' });
  window.addEventListener('beforeunload', _upLeaveGuard);
  let sheetId = null;
  try {
    // part_count -1 = "upload in progress": hidden from New Order until finished
    const { data:sd, error:se } = await sb.from('sheets').insert([{ name, part_count:-1, created_at:new Date().toISOString() }]).select().single();
    if(se) throw se;
    sheetId = sd.id; S._upload.sheetId = sheetId;
    const BATCH = 1000, PARALLEL = 3, TRIES = 5;
    let done = 0, next = 0, failure = null;
    // each worker takes the next batch; the first hard failure stops everyone, and we
    // wait for batches already in flight before cleaning up (nothing lands afterwards)
    const worker = async () => {
      while(!failure && next < total){
        const from = next; next += BATCH;
        const rows = parts.slice(from, from+BATCH).map(p=>({ ...p, sheet_id:sheetId }));
        for(let attempt=1; ; attempt++){
          if(failure) return;
          const { error } = await sb.from('parts').insert(rows);
          if(!error) break;
          if(error.code==='APP_LOCKED' || attempt>=TRIES){ failure = failure || error; return; }
          if(!failure) setUpload({ note:`weak network — retrying (${attempt})` });
          await new Promise(r=>setTimeout(r, 700*attempt*attempt));
        }
        done += rows.length;
        if(!failure) setUpload({ title:'Uploading parts… keep this screen open', done, pct: 6 + done/total*90, note:'' });
      }
    };
    await Promise.all(Array.from({length:PARALLEL}, worker));
    if(failure) throw failure;
    setUpload({ title:'Checking…', pct:98 });
    const { data:n, error:re } = await sb.rpc('app_sheet_recount', { p_sheet_id: sheetId });
    if(re) throw re;
    if(n !== total) throw new Error(`only ${fmtI(n||0)} of ${fmtI(total)} parts arrived`);
    const extra = [info.blank?`${fmtI(info.blank)} empty rows skipped`:'', info.dupes?`${fmtI(info.dupes)} repeated rows skipped`:''].filter(Boolean).join(' · ');
    logActivity('sheet','created',sheetId,name,`Uploaded "${name}" — ${fmtI(n)} parts${extra?' ('+extra+')':''}`);
    setUpload({ state:'ok', title:`Upload complete — ${fmtI(n)} parts in "${name}"`, done:n, pct:100, note:extra });
    toast(`${fmtI(n)} parts uploaded`);
    await loadSheets();
    if(S.screen==='sheets') renderSheets();
  } catch(e){
    if(sheetId){ try { await sb.from('sheets').delete().eq('id', sheetId); } catch(_){} }   // parts go with it (cascade)
    if(e?.code==='APP_LOCKED'){ clearUpload(); return; }
    setUpload({ state:'err', title:'Upload failed — nothing was saved. '+(e?.message||'Check the internet and try again.'), note:'' });
    toast('Upload failed','error');
    await loadSheets(); if(S.screen==='sheets') renderSheets();
  } finally {
    window.removeEventListener('beforeunload', _upLeaveGuard);
  }
}

function showAddPart(sheetId){
  const sheet = S.sheets.find(s=>String(s.id)===String(sheetId)); if(!sheet) return;
  const m = openModal({ title:'Add part', sub:`To catalogue <b>${esc(sheet.name)}</b>`, icon:'plus', size:'md',
    body:`
      <div class="grid-2">
        <div><label class="field-label">Part code <i class="req">*</i></label><div class="input-group"><input id="ap-code" class="mono" placeholder="e.g. SON-723" autocapitalize="characters"/></div><div class="form-err" id="ap-err"></div></div>
        <div><label class="field-label">Alt code</label><div class="input-group"><input id="ap-alt" class="mono" placeholder="optional"/></div></div>
      </div>
      <label class="field-label">Description</label><div class="input-group"><input id="ap-desc" placeholder="e.g. Oil filter"/></div>
      <div class="grid-2" style="margin-top:14px">
        <div><label class="field-label">MRP (₹)</label><div class="input-group"><input id="ap-price" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00"/></div></div>
        <div><label class="field-label">HSN</label><div class="input-group"><input id="ap-hsn" class="mono" placeholder="optional"/></div></div>
      </div>`,
    footer:`<button class="btn btn-ghost" id="ap-cxl">Cancel</button><button class="btn btn-primary" id="ap-ok">${ICONS.plus}<span>Add part</span></button>` });
  setTimeout(()=>m.q('#ap-code').focus(), 80);
  m.q('#ap-cxl').onclick = m.close;
  m.q('#ap-ok').onclick = async () => {
    const code = m.q('#ap-code').value.trim().toUpperCase();
    if(!code){ m.q('#ap-err').textContent='Required'; return; }
    const btn = m.q('#ap-ok'); setBusy(btn, true);
    try {
      const ex = await sb.from('parts').select('id').eq('sheet_id', sheet.id).eq('part_code', code).limit(1);
      if(ex.data?.length){ m.q('#ap-err').textContent = 'This part code is already in this sheet'; setBusy(btn,false); return; }
      const row = { sheet_id:sheet.id, part_code:code, alt_code:m.q('#ap-alt').value.trim().toUpperCase(), description:m.q('#ap-desc').value.trim(), price:num(m.q('#ap-price').value), hsn_no:m.q('#ap-hsn').value.trim(), is_blocked:'N' };
      const { error } = await sb.from('parts').insert([row]);
      if(error) throw error;
      await sb.rpc('app_sheet_recount', { p_sheet_id: sheet.id });   // touches the sheet → every device refreshes its cache
      logActivity('part','created',code,code,`Added part ${code} to "${sheet.name}"`);
      invalidateSheetCache(sheet.id);
      m.close(); toast(`Part ${code} added`);
      await loadSheets(); if(S.screen==='sheets') renderSheets();
    } catch(e){ if(e.code!=='APP_LOCKED') toast('Could not add part: '+(e.message||''),'error'); setBusy(btn,false); }
  };
}

async function removeSheet(id){
  const sheet = S.sheets.find(s=>String(s.id)===String(id)); if(!sheet) return;
  if(S._upload?.sheetId===sheet.id && S._upload.state==='run'){ toast('This catalogue is still uploading','error'); return; }
  const ok = await confirmDialog({ title:'Remove sheet?', icon:'trash',
    body:`<b>${esc(sheet.name)}</b> and its ${fmtI(sheet.part_count||0)} parts will be removed. Existing orders are not affected.`,
    confirm:'Remove', typeToConfirm: null });
  if(!ok) return;
  try {
    const { error } = await sb.from('sheets').delete().eq('id', sheet.id);   // parts are removed with it (cascade)
    if(error) throw error;
    invalidateSheetCache(sheet.id);
    logActivity('sheet','deleted',sheet.id,sheet.name,`Removed sheet "${sheet.name}" (${fmtI(sheet.part_count||0)} parts)`);
    toast('Sheet removed','info'); await loadSheets(); renderSheets();
  } catch(e){ if(e.code!=='APP_LOCKED') toast('Remove failed: '+(e.message||''),'error'); }
}
/* ── REPORTS (admin only) ─────────────────────────────────────
   Monthly trend + Pending vs received. Every figure is computed from the same
   order data the Dashboard uses: value = qty × invoice MRP, dates = invoice date. */
const RP_PRESETS = [
  ['month','This month'], ['last','Last month'], ['3m','Last 3 months'], ['6m','Last 6 months'],
  ['year','This year'], ['all','All time'], ['custom','Custom'],
];
const RP_STACK = ['short','damaged','wrong','received'];   // bottom → top; pending first, received on top
const RP_PENDING = ['short','damaged','wrong'];
S.rp = S.rp || (()=>{
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('sp_reports')||'{}'); } catch(e){}
  return { preset: saved.preset || '6m', from: saved.from || '', to: saved.to || '', measure: saved.measure || 'value', drafts: saved.drafts !== false };
})();
function rpSave(){ try { localStorage.setItem('sp_reports', JSON.stringify(S.rp)); } catch(e){} }

const ymKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
function ymLabel(k, long){ const [y,m] = k.split('-').map(Number); return new Date(y, m-1, 1).toLocaleDateString('en-IN', long ? {month:'long', year:'numeric'} : {month:'short', year:'2-digit'}); }

// [from, to] as YYYY-MM-DD (inclusive); '' = open end
function rpRange(){
  const t = new Date(), y = t.getFullYear(), m = t.getMonth(), iso = localISODate;
  switch(S.rp.preset){
    case 'month': return [iso(new Date(y,m,1)), iso(t)];
    case 'last':  return [iso(new Date(y,m-1,1)), iso(new Date(y,m,0))];
    case '3m':    return [iso(new Date(y,m-2,1)), iso(t)];
    case '6m':    return [iso(new Date(y,m-5,1)), iso(t)];
    case 'year':  return [iso(new Date(y,0,1)), iso(t)];
    case 'custom': {
      let f = S.rp.from || '', to = S.rp.to || '';
      if(f && to && f > to) [f, to] = [to, f];
      return [f, to];
    }
    default: return ['', ''];
  }
}

function rpCompute(){
  const [from, to] = rpRange();
  const zero = () => ({ value:0, units:0, parts:0 });
  const byMonth = {}, tot = {}; RP_STACK.forEach(s=>tot[s]=zero());
  const ages = [[0,30,'0–30 days'],[31,60,'31–60 days'],[61,90,'61–90 days'],[91,1e9,'Over 90 days']].map(([a,b,l])=>({ a, b, label:l, byStatus:Object.fromEntries(RP_PENDING.map(s=>[s,zero()])) }));
  const today = parseDateLocal(localISODate(new Date()));
  let orders = 0, minK = null, maxK = null, undated = 0;
  S.orders.forEach(o=>{
    if(!S.rp.drafts && isDraft(o)) return;
    const d = String(o.invoice_date||'').slice(0,10);
    if(!d){ undated++; return; }
    if((from && d < from) || (to && d > to)) return;
    const dt = parseDateLocal(d); if(isNaN(dt)) { undated++; return; }
    const k = ymKey(dt);
    let counted = false;
    (o.parts||[]).forEach(p=>{
      const st = RP_STACK.includes(p.status) ? p.status : 'short';
      const x = partTotals(p);
      const add = r => { r.value += x.i; r.units += x.q; r.parts += 1; };
      byMonth[k] = byMonth[k] || Object.fromEntries(RP_STACK.map(s=>[s,zero()]));
      add(byMonth[k][st]); add(tot[st]); counted = true;
      if(RP_PENDING.includes(st)){
        const days = Math.max(0, Math.round((today - dt)/86400000));
        const b = ages.find(g=>days>=g.a && days<=g.b); add(b.byStatus[st]);
      }
    });
    if(counted){ orders++; if(!minK || k<minK) minK=k; if(!maxK || k>maxK) maxK=k; }
  });
  // continuous month axis (empty months shown as zero, not skipped)
  let startK = from ? from.slice(0,7) : minK, endK = to ? to.slice(0,7) : maxK;
  if(S.rp.preset==='all' || S.rp.preset==='custom'){ if(!from) startK = minK; if(!to) endK = maxK; }
  const months = [];
  if(startK && endK){
    let [y,m] = startK.split('-').map(Number); const [ey,em] = endK.split('-').map(Number);
    for(let i=0; (y<ey || (y===ey && m<=em)) && i<240; i++){
      const k = y+'-'+String(m).padStart(2,'0');
      months.push({ k, s: byMonth[k] || Object.fromEntries(RP_STACK.map(s=>[s,zero()])) });
      if(++m>12){ m=1; y++; }
    }
  }
  return { from, to, months, tot, ages, orders, undated };
}

// ₹ in Indian short form for axis ticks: ₹950 · ₹12K · ₹3.4L · ₹1.2Cr
function inrShort(v){
  const a = Math.abs(v);
  if(a >= 1e7) return '₹'+(v/1e7).toFixed(a>=1e8?0:1).replace(/\.0$/,'')+'Cr';
  if(a >= 1e5) return '₹'+(v/1e5).toFixed(a>=1e6?0:1).replace(/\.0$/,'')+'L';
  if(a >= 1e3) return '₹'+(v/1e3).toFixed(a>=1e4?0:1).replace(/\.0$/,'')+'K';
  return '₹'+Math.round(v);
}
const rpFmt = (v, measure) => measure==='value' ? '₹'+fmt(v) : fmtI(v);
const rpTick = (v, measure) => measure==='value' ? inrShort(v) : fmtI(v);
function niceMax(v){
  if(v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return (f<=1?1:f<=2?2:f<=5?5:10) * e;
}

function renderReports(area){
  area = area || document.getElementById('page-area');
  if(!isAdmin()){ setScreen('home'); return; }
  const R = rpCompute(), M = S.rp.measure;
  const pend = RP_PENDING.reduce((a,s)=>({ value:a.value+R.tot[s].value, units:a.units+R.tot[s].units, parts:a.parts+R.tot[s].parts }), {value:0,units:0,parts:0});
  const rec = R.tot.received;
  const all = { value: pend.value+rec.value, units: pend.units+rec.units, parts: pend.parts+rec.parts };
  const rate = all.value > 0 ? rec.value/all.value*100 : 0;
  const rangeTxt = R.from || R.to ? `${R.from?fmtDate(R.from):'start'} – ${R.to?fmtDate(R.to):'today'}` : 'All time';
  const pct = (v,t) => t>0 ? (v/t*100) : 0;
  const pctTxt = (v,t) => t>0 ? (Math.round(v/t*1000)/10).toFixed(1).replace(/\.0$/,'')+'%' : '0%';

  area.innerHTML = `
  ${topBar('Reports', `${esc(rangeTxt)} · ${plural(R.orders,'order')} · ${plural(all.parts,'part')}`)}
  <div class="page-body rp">
    <div class="rp-filters anim-up">
      <div class="rp-presets" role="group" aria-label="Date range">
        ${RP_PRESETS.map(([k,l])=>`<button class="rp-pre ${S.rp.preset===k?'on':''}" data-pre="${k}">${l}</button>`).join('')}
      </div>
      <div class="rp-custom" ${S.rp.preset==='custom'?'':'hidden'}>
        <label>From <input type="date" id="rp-from" value="${esc(S.rp.from)}" max="${localISODate(new Date())}"></label>
        <label>To <input type="date" id="rp-to" value="${esc(S.rp.to)}" max="${localISODate(new Date())}"></label>
      </div>
      <label class="rp-check"><input type="checkbox" id="rp-drafts" ${S.rp.drafts?'checked':''}><span>Include drafts</span></label>
    </div>

    <section class="rp-card anim-up">
      <div class="rp-card-head">
        <div><h2>Pending vs received</h2><p>Pending = short + damaged + wrong parts not yet received · value = qty × invoice MRP</p></div>
      </div>
      <div class="rp-tiles">
        <div class="rp-tile t-pend"><span class="rp-tl">Pending</span><b>₹${fmt(pend.value)}</b><small>${plural(pend.parts,'part')} · ${plural(pend.units,"unit")}</small></div>
        <div class="rp-tile t-rec"><span class="rp-tl">Received</span><b>₹${fmt(rec.value)}</b><small>${plural(rec.parts,'part')} · ${plural(rec.units,"unit")}</small></div>
        <div class="rp-tile t-rate"><span class="rp-tl">Recovered</span><b>${pctTxt(rec.value, all.value)}</b><small>of ₹${fmt(all.value)} total</small>
          <div class="rp-meter" aria-hidden="true"><span style="width:${rate.toFixed(2)}%"></span></div></div>
      </div>
      ${all.parts ? `
      <div class="rp-split" role="img" aria-label="Share of value by status">
        ${RP_STACK.filter(s=>R.tot[s].value>0).map(s=>`<span class="rp-seg" style="flex:${R.tot[s].value} 1 0;background:${STATUS[s].color}" title="${STATUS[s].short}: ₹${fmt(R.tot[s].value)} (${pctTxt(R.tot[s].value, all.value)})"></span>`).join('')}
      </div>
      <div class="rp-split-legend">
        ${RP_STACK.map(s=>`<div class="rp-sl"><span class="rp-sw" style="background:${STATUS[s].color}"></span><span class="rp-sl-n">${STATUS[s].short}</span><b>₹${fmt(R.tot[s].value)}</b><span class="rp-sl-p">${pctTxt(R.tot[s].value, all.value)} · ${plural(R.tot[s].parts,'part')}</span></div>`).join('')}
      </div>
      <h3 class="rp-sub">How old is the pending amount? <span>(days since invoice date)</span></h3>
      <div class="rp-tablewrap"><table class="rp-table">
        <thead><tr><th>Age</th>${RP_PENDING.map(s=>`<th class="r"><span class="rp-dot" style="background:${STATUS[s].color}"></span>${STATUS[s].short}</th>`).join('')}<th class="r">Pending total</th><th class="r">Parts</th></tr></thead>
        <tbody>${R.ages.map((g,i)=>{ const v = RP_PENDING.reduce((a,s)=>a+g.byStatus[s].value,0), n = RP_PENDING.reduce((a,s)=>a+g.byStatus[s].parts,0);
          return `<tr class="${i===3 && v>0 ? 'rp-old' : ''}"><td>${i===3 && v>0 ? ICONS.alert : ''}${g.label}</td>${RP_PENDING.map(s=>`<td class="r num">${g.byStatus[s].value?'₹'+fmt(g.byStatus[s].value):'<span class="rp-nil">—</span>'}</td>`).join('')}<td class="r num b">₹${fmt(v)}</td><td class="r num">${fmtI(n)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td>Total</td>${RP_PENDING.map(s=>`<td class="r num">₹${fmt(R.tot[s].value)}</td>`).join('')}<td class="r num b">₹${fmt(pend.value)}</td><td class="r num">${fmtI(pend.parts)}</td></tr></tfoot>
      </table></div>` : emptyState('chart','No parts in this period','Pick a wider date range')}
    </section>

    <section class="rp-card anim-up">
      <div class="rp-card-head">
        <div><h2>Monthly trend</h2><p>By invoice month · ${M==='value'?'value = qty × invoice MRP':M==='units'?'units = quantity':'parts = part lines'}</p></div>
        <div class="density rp-measure" role="group" aria-label="Measure">
          ${[['value','₹ Value'],['units','Units'],['parts','Parts']].map(([k,l])=>`<button class="${M===k?'on':''}" data-m="${k}">${l}</button>`).join('')}
        </div>
      </div>
      ${R.months.length && all.parts ? `
      <div class="rp-legend">${RP_STACK.map(s=>`<span><i style="background:${STATUS[s].color}"></i>${STATUS[s].short}</span>`).join('')}</div>
      <div class="rp-chart" id="rp-chart"></div>
      <h3 class="rp-sub">Month by month <span>(${M==='value'?'₹ value':M})</span></h3>
      <div class="rp-tablewrap"><table class="rp-table rp-months">
        <thead><tr><th>Month</th>${RP_STACK.map(s=>`<th class="r"><span class="rp-dot" style="background:${STATUS[s].color}"></span>${STATUS[s].short}</th>`).join('')}<th class="r">Total</th><th class="r">Recovered</th></tr></thead>
        <tbody>${R.months.slice().reverse().map(mo=>{ const p = RP_PENDING.reduce((a,s)=>a+mo.s[s][M],0), t = p + mo.s.received[M];
          const rv = RP_STACK.reduce((a,s)=>a+mo.s[s].value,0);
          return `<tr><td>${ymLabel(mo.k,true)}</td>${RP_STACK.map(s=>`<td class="r num">${mo.s[s][M]?rpFmt(mo.s[s][M],M):'<span class="rp-nil">—</span>'}</td>`).join('')}<td class="r num b">${rpFmt(t,M)}</td><td class="r num">${rv>0?pctTxt(mo.s.received.value, rv):'<span class="rp-nil">—</span>'}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td>Total</td>${RP_STACK.map(s=>`<td class="r num">${rpFmt(R.tot[s][M],M)}</td>`).join('')}<td class="r num b">${rpFmt(all[M],M)}</td><td class="r num">${pctTxt(rec.value, all.value)}</td></tr></tfoot>
      </table></div>` : emptyState('chart','No parts in this period','Pick a wider date range')}
      ${R.undated ? `<p class="rp-note">${plural(R.undated,'order')} without an invoice date not counted.</p>` : ''}
    </section>
  </div>`;

  // filters
  area.querySelectorAll('.rp-pre').forEach(b=>b.onclick=()=>{
    S.rp.preset = b.dataset.pre;
    if(S.rp.preset==='custom' && !S.rp.from && !S.rp.to){ const [f,t] = [localISODate(new Date(new Date().getFullYear(), new Date().getMonth()-2, 1)), localISODate(new Date())]; S.rp.from=f; S.rp.to=t; }
    rpSave(); renderPage(true);
  });
  const onDate = () => { S.rp.from = document.getElementById('rp-from').value; S.rp.to = document.getElementById('rp-to').value; rpSave(); renderPage(true); };
  document.getElementById('rp-from').onchange = onDate; document.getElementById('rp-to').onchange = onDate;
  document.getElementById('rp-drafts').onchange = e => { S.rp.drafts = e.target.checked; rpSave(); renderPage(true); };
  area.querySelectorAll('.rp-measure [data-m]').forEach(b=>b.onclick=()=>{ S.rp.measure = b.dataset.m; rpSave(); renderPage(true); });

  if(document.getElementById('rp-chart')) drawTrend(R.months, M);
  if(!renderReports._rs){
    renderReports._rs = true;
    let t = 0; window.addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(()=>{ if(S.screen==='reports' && document.getElementById('rp-chart')){ const R2 = rpCompute(); drawTrend(R2.months, S.rp.measure); } }, 150); });
  }
}

// Stacked monthly bars (SVG). Thin bars, 2px gaps between segments, rounded top,
// recessive grid, one y-axis, hover/tap tooltip per month.
function drawTrend(months, M){
  const box = document.getElementById('rp-chart'); if(!box) return;
  const W = Math.max(300, box.clientWidth), H = W < 560 ? 240 : 300;
  const pad = { l: 56, r: 10, t: 12, b: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const tot = months.map(mo=>RP_STACK.reduce((a,s)=>a+mo.s[s][M],0));
  // round step (1/2/5 × 10ⁿ) so every axis label is a clean number
  // pick the clean step (1/2/5 × 10ⁿ) giving 3–6 gridlines with the least empty space on top
  const vmax = Math.max(...tot, 0) || 1;
  let step = 1, nSteps = 1, ymax = Infinity;
  for(let e = Math.pow(10, Math.floor(Math.log10(vmax)) - 2); e <= vmax * 10; e *= 10)
    for(const f of [1,2,5]){ const st = f*e, k = Math.ceil(vmax/st - 1e-9); if((M==='value' || st>=1) && k>=3 && k<=6 && st*k < ymax){ step = st; nSteps = k; ymax = st*k; } }
  if(!isFinite(ymax)){ step = Math.max(M==='value'?0:1, niceMax(vmax/4)); nSteps = Math.max(1, Math.ceil(vmax/step)); ymax = step*nSteps; }
  const ticks = Array.from({length:nSteps+1}, (_,i)=>i*step);
  const n = months.length, slot = iw / n;
  const bw = Math.max(4, Math.min(44, slot * 0.62));
  const y = v => pad.t + ih - (v / ymax) * ih;
  const every = Math.ceil(n / Math.max(1, Math.floor(iw / 58)));   // thin out month labels when crowded
  let g = '';
  ticks.forEach(v=>{ g += `<line class="rp-grid" x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="rp-ax" x="${pad.l-8}" y="${y(v)+4}" text-anchor="end">${rpTick(v,M)}</text>`; });
  months.forEach((mo,i)=>{
    const cx = pad.l + slot*i + slot/2, x = cx - bw/2;
    let base = 0; const segs = RP_STACK.filter(s=>mo.s[s][M]>0);
    g += `<g class="rp-col" data-i="${i}"><rect class="rp-hit" x="${pad.l+slot*i}" y="${pad.t}" width="${slot}" height="${ih}"/>`;
    segs.forEach((s,j)=>{
      const v = mo.s[s][M], y0 = y(base), y1 = y(base+v);
      const top = j===segs.length-1;
      let h = y0 - y1 - (top ? 0 : 2);                  // 2px gap above every segment but the top one
      if(h < 1) h = 1;
      const r = top ? Math.min(4, h, bw/2) : 0, yt = y0 - (y0-y1);
      g += top
        ? `<path fill="${STATUS[s].color}" d="M${x},${y0} V${yt+r} Q${x},${yt} ${x+r},${yt} H${x+bw-r} Q${x+bw},${yt} ${x+bw},${yt+r} V${y0} Z"/>`
        : `<rect fill="${STATUS[s].color}" x="${x}" y="${y0-h}" width="${bw}" height="${h}"/>`;
      base += v;
    });
    g += `</g>`;
    if(i % every === 0) g += `<text class="rp-ax" x="${cx}" y="${H-10}" text-anchor="middle">${ymLabel(mo.k)}</text>`;
  });
  g += `<line class="rp-base" x1="${pad.l}" x2="${W-pad.r}" y1="${y(0)}" y2="${y(0)}"/>`;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px" role="img" aria-label="Monthly ${M} by status">${g}</svg><div class="rp-tip" id="rp-tip" hidden></div>`;
  const tip = document.getElementById('rp-tip');
  const show = (el) => {
    box.querySelectorAll('.rp-col.on').forEach(c=>c.classList.remove('on')); el.classList.add('on');
    const i = +el.dataset.i, mo = months[i], t = tot[i];
    tip.innerHTML = `<b>${ymLabel(mo.k,true)}</b>${RP_STACK.slice().reverse().map(s=>`<div><i style="background:${STATUS[s].color}"></i><span>${STATUS[s].short}</span><em>${rpFmt(mo.s[s][M],M)}</em></div>`).join('')}<div class="rp-tip-t"><span>Total</span><em>${rpFmt(t,M)}</em></div>`;
    tip.hidden = false;
    const cx = pad.l + slot*i + slot/2, tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(W - tw - 4, cx + 14 + tw > W ? cx - tw - 14 : cx + 14)) + 'px';
    tip.style.top = Math.max(4, y(t) - 10) + 'px';
  };
  box.querySelectorAll('.rp-col').forEach(c=>{ c.addEventListener('pointerenter', ()=>show(c)); c.addEventListener('click', ()=>show(c)); });
  box.addEventListener('pointerleave', e=>{ if(e.pointerType==='mouse'){ tip.hidden = true; box.querySelectorAll('.rp-col.on').forEach(c=>c.classList.remove('on')); } });
}
/* ── ADMIN PANEL ───────────────────────────────────────────── */
const ONLINE_MS = 3*60*1000;
const STORAGE_LIMIT = 500*1024*1024;   // Supabase free plan database size

async function rpcAdmin(fn, args={}){
  const { data, error } = await sb.rpc(fn, { p_token:S.token, ...args });
  if(error){
    if(/expired|sign in again/i.test(error.message||'')) { handleSessionInvalid(); }
    throw new Error(error.message || 'Request failed');
  }
  return data;
}
const _adminLoaded = {};
async function adminReload(tab, quiet){
  if(!isAdmin()) return;
  try {
    // all requests in parallel — one network round-trip instead of three
    const jobs = [];
    if(tab==='users' || !S.users.length) jobs.push(rpcAdmin('app_list_users').then(d=>{ S.users = d||[]; }));
    if(tab==='devices' || tab==='users' || !S.devices.length) jobs.push(sb.from('device_sessions').select('*').order('last_seen_at',{ascending:false}).limit(500).then(({data})=>{ if(data) S.devices = data; }));
    if(tab==='activity') jobs.push(sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(300).then(({data})=>{ if(data) S.logRows = data; }));
    if(tab==='storage' || !S.storage) jobs.push(rpcAdmin('app_storage_stats').then(d=>{ S.storage = d; }));
    await Promise.all(jobs);
    _adminLoaded[tab] = Date.now();
  } catch(e){ if(!quiet) toast(e.message,'error'); }
  if(S.screen==='admin'){
    renderAdminOverview();
    if(S.adminTab===tab || !quiet) renderAdminPanel();
  }
}

function renderAdmin(area){
  area.innerHTML = `
  ${topBar('Admin Panel', 'Shop overview & controls', false, `<button class="btn btn-primary btn-md" id="ad-add">${ICONS.plus}<span class="hide-xs">Add user</span></button>`)}
  <div class="page-body page-wide">
    <div id="admin-overview"></div>
    <div class="tabs" id="admin-tabs">
      ${[['users','users','Users'],['activity','activity','Activity'],['devices','desktop','Devices'],['storage','database','Storage']].map(([k,i,l])=>`<button class="tab ${S.adminTab===k?'active':''}" data-tab="${k}">${ICONS[i]}<span>${l}</span></button>`).join('')}
      <span class="tab-ink"></span>
    </div>
    <div id="admin-panel"></div>
  </div>`;
  document.getElementById('ad-add').onclick = showAddUser;
  area.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ S.adminTab=b.dataset.tab; area.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===b)); moveTabInk(); renderAdminPanel(); adminReload(S.adminTab, true); });
  renderAdminOverview(); renderAdminPanel(); requestAnimationFrame(moveTabInk);
}
function moveTabInk(){
  const a = document.querySelector('#admin-tabs .tab.active'), ink = document.querySelector('#admin-tabs .tab-ink');
  if(a && ink){ ink.style.width = a.offsetWidth+'px'; ink.style.transform = `translateX(${a.offsetLeft}px)`; }
}
function isOnline(d){ return d && !d.revoked && (Date.now()-new Date(d.last_seen_at).getTime()) < ONLINE_MS; }

function renderAdminOverview(){
  const el = document.getElementById('admin-overview'); if(!el) return;
  const now = new Date();
  const month = S.orders.filter(o=>{ const d=parseDateLocal(o.invoice_date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const active = S.users.filter(u=>u.active).length;
  const online = S.devices.filter(isOnline).length;
  const pct = S.storage ? Math.min(100, S.storage.db_bytes/STORAGE_LIMIT*100) : null;
  el.innerHTML = `
  <div class="overview anim-up">
    <div class="ov-grid"></div>
    <button class="ov-fig" data-go="users"><span class="ov-ic">${ICONS.users}</span><b>${S.users.length?fmtI(active):'—'}</b><small>Active users</small></button>
    <button class="ov-fig" data-go="history"><span class="ov-ic">${ICONS.receipt}</span><b>${fmtI(month.length)}</b><small>Orders this month · ₹${fmt(month.reduce((s,o)=>s+num(o.total_invoice_mrp),0))}</small></button>
    <button class="ov-fig" data-go="devices"><span class="ov-ic">${ICONS.desktop}</span><b>${S.devices.length?fmtI(online):'—'}</b><small>Devices online now</small></button>
    <button class="ov-fig" data-go="storage"><span class="ov-ic">${ICONS.database}</span><b>${pct==null?'—':pct.toFixed(pct<10?1:0)+'%'}</b><small>Storage used</small></button>
  </div>
  <div class="lock-card ${S.appLocked?'is-locked':''} anim-up1">
    <span class="lc-ic">${S.appLocked?ICONS.lock:ICONS.unlock}</span>
    <div class="lc-txt"><b>${S.appLocked?'App is locked':'App is unlocked'}</b><small>${S.appLocked?`Locked by ${esc(S.lockedBy||'admin')} — staff can view but not save. Admins are not affected.`:'Lock the app to pause all changes by staff (stock-taking, audits, end of day).'}</small></div>
    <button class="switch ${S.appLocked?'on':''}" id="lock-switch" role="switch" aria-checked="${S.appLocked}"><span></span></button>
  </div>`;
  el.querySelectorAll('.ov-fig').forEach(b=>b.onclick=()=>{
    const g = b.dataset.go;
    if(g==='history'){ S.histUser='all'; setScreen('history'); return; }
    S.adminTab = g; renderPage(); adminReload(g, true);
  });
  document.getElementById('lock-switch').onclick = () => setAppLock(!S.appLocked);
}
async function setAppLock(locked){
  if(locked){
    const ok = await confirmDialog({ title:'Lock the app?', icon:'lock', tone:'warn', confirm:'Lock app',
      body:'All staff will see a "locked by admin" message. They can still look around, but <b>the moment anyone tries to save, nothing is written and they are logged out</b>.<br><br>Their unsaved parts stay on their device and become a draft after you unlock. Admins are not affected.' });
    if(!ok) return;
  }
  try {
    await rpcAdmin('app_set_lock', { p_locked: locked });
    applyLockState({ locked, locked_by: locked ? S.user : null });
    toast(locked ? 'App locked — staff changes are paused' : 'App unlocked', locked?'info':'success');
    if(S.screen==='admin') renderAdminOverview();
  } catch(e){ toast(e.message,'error'); }
}

function renderAdminPanel(){
  const el = document.getElementById('admin-panel'); if(!el) return;
  ({ users:renderUsersTab, activity:renderActivityTab, devices:renderDevicesTab, storage:renderStorageTab }[S.adminTab] || renderUsersTab)(el);
}
function skeleton(n=4){ return `<div class="skel-list">${Array.from({length:n},()=>'<div class="skel"><span></span><span></span></div>').join('')}</div>`; }

/* Users */
function renderUsersTab(el){
  if(!S.users.length){ el.innerHTML = skeleton(3); return; }
  const q = (S._userQ||'').toLowerCase();
  const stats = {};
  S.orders.forEach(o=>{ const k=o.created_by||''; const s=stats[k]||(stats[k]={n:0,v:0,last:null}); s.n++; s.v+=num(o.total_invoice_mrp); if(!s.last || String(o.invoice_date)>s.last) s.last=String(o.invoice_date); });
  const users = S.users.filter(u=>!q || u.username.toLowerCase().includes(q));
  el.innerHTML = `
  <div class="panel-tools"><div class="search-box sm"><span class="sb-ic">${ICONS.search}</span><input id="u-q" value="${esc(S._userQ||'')}" placeholder="Search users…"/></div></div>
  <div class="user-grid">
    ${users.map((u,i)=>{
      const st = stats[u.username] || {n:0,v:0,last:null};
      const me = u.username===S.user;
      const online = S.devices.some(d=>d.user_name===u.username && isOnline(d));
      return `<div class="user-card ${u.active?'':'is-off'}" style="animation-delay:${i*.04}s" data-u="${esc(u.username)}">
        <div class="uc-head">
          <span class="avatar lg ${u.role==='admin'?'av-admin':''}">${esc(initials(u.username))}${online?'<i class="online"></i>':''}</span>
          <div class="uc-name"><b>${esc(u.username)}</b>
            <div class="uc-chips"><span class="chip ${u.role==='admin'?'chip-blue':''}">${u.role==='admin'?ICONS.shield+'Admin':'User'}</span>
              ${me?'<span class="chip chip-green">You</span>':''}${online?'<span class="chip chip-green">Online</span>':''}${u.active?'':'<span class="chip chip-red">Disabled</span>'}</div></div>
        </div>
        <div class="uc-stats"><div><small>Orders</small><b>${fmtI(st.n)}</b></div><div><small>Total</small><b>₹${fmt(st.v)}</b></div><div><small>Last order</small><b>${st.last?fmtDate(st.last):'—'}</b></div></div>
        <div class="uc-actions">
          <button class="mini-act" data-a="orders">${ICONS.history}<span>Orders</span></button>
          <button class="mini-act" data-a="password">${ICONS.key}<span>Password</span></button>
          <button class="mini-act" data-a="rename">${ICONS.tag}<span>Rename</span></button>
          <button class="mini-act" data-a="role">${ICONS.shield}<span>${u.role==='admin'?'Make user':'Make admin'}</span></button>
          ${me?'':`<button class="mini-act" data-a="toggle">${ICONS.power}<span>${u.active?'Disable':'Enable'}</span></button>
          <button class="mini-act danger" data-a="remove">${ICONS.trash}<span>Remove</span></button>`}
        </div>
      </div>`; }).join('') || '<div class="empty-mini">No users match</div>'}
  </div>`;
  const qi = document.getElementById('u-q');
  qi.oninput = debounce(()=>{ S._userQ = qi.value; renderUsersTab(el); const n=document.getElementById('u-q'); n.focus(); n.setSelectionRange(n.value.length,n.value.length); }, 120);
  el.querySelectorAll('.user-card').forEach(card=>{
    const u = S.users.find(x=>x.username===card.dataset.u);
    card.querySelectorAll('.mini-act').forEach(b=>b.onclick=()=>({
      orders:()=>{ S.histUser=u.username; S.histSearch=''; S.histStatusFilter=new Set(['all']); setScreen('history'); },
      password:()=>showPasswordDialog(u), rename:()=>showRenameUser(u), role:()=>toggleRole(u),
      toggle:()=>toggleUserActive(u), remove:()=>removeUser(u),
    })[b.dataset.a]());
  });
}
function genPassword(){ const w='abcdefghjkmnpqrstuvwxyz', d='23456789'; let s=''; for(let i=0;i<5;i++) s+=w[Math.floor(Math.random()*w.length)]; for(let i=0;i<3;i++) s+=d[Math.floor(Math.random()*d.length)]; return s[0].toUpperCase()+s.slice(1); }
async function copyText(t){ try { await navigator.clipboard.writeText(t); toast('Copied'); } catch(e){ toast('Copy not allowed here','error'); } }
const USER_RE = /^[A-Za-z0-9._@-]{3,30}$/;

function showAddUser(){
  const m = openModal({ title:'Add user', sub:'Create a login for a staff member', icon:'users', size:'md',
    body:`
      <label class="field-label">Username</label>
      <div class="input-group"><span class="ig-ic">${ICONS.user}</span><input id="nu-u" autocapitalize="none" spellcheck="false" placeholder="e.g. ravi"/></div>
      <div class="form-hint" id="nu-u-msg">3–30 letters or numbers ( . _ - @ allowed, no spaces)</div>
      <label class="field-label">Password</label>
      <div class="input-group"><span class="ig-ic">${ICONS.key}</span><input id="nu-p" type="text" class="mono" value="${genPassword()}"/>
        <button class="ig-btn" id="nu-gen" title="Generate">${ICONS.wand}</button></div>
      <div class="form-hint">At least 4 characters. You can view it later in Admin → Users → Password.</div>
      <label class="field-label">Role</label>
      <div class="seg" id="nu-role"><button class="on" data-r="user">${ICONS.user}User<small>Own orders only</small></button><button data-r="admin">${ICONS.shield}Admin<small>Everything</small></button></div>`,
    footer:`<button class="btn btn-ghost" id="nu-cxl">Cancel</button><button class="btn btn-primary" id="nu-ok" disabled>${ICONS.plus}<span>Create user</span></button>` });
  let role = 'user';
  const u = m.q('#nu-u'), p = m.q('#nu-p'), ok = m.q('#nu-ok'), msg = m.q('#nu-u-msg');
  const validate = () => {
    const v = u.value.trim();
    let good = USER_RE.test(v);
    if(v && !good){ msg.textContent = 'Only letters, numbers and . _ - @ (3–30, no spaces)'; msg.className='form-hint bad'; }
    else if(good && S.users.some(x=>x.username.toLowerCase()===v.toLowerCase())){ good=false; msg.textContent='That username is already taken'; msg.className='form-hint bad'; }
    else if(good){ msg.textContent='Available'; msg.className='form-hint good'; }
    else { msg.textContent='3–30 letters or numbers ( . _ - @ allowed, no spaces)'; msg.className='form-hint'; }
    ok.disabled = !(good && p.value.length>=4);
  };
  u.oninput = validate; p.oninput = validate;
  setTimeout(()=>u.focus(), 80);
  m.q('#nu-gen').onclick = () => { p.value = genPassword(); validate(); };
  m.q('#nu-role').querySelectorAll('button').forEach(b=>b.onclick=()=>{ role=b.dataset.r; m.q('#nu-role').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); });
  m.q('#nu-cxl').onclick = m.close;
  ok.onclick = async () => {
    setBusy(ok, true);
    try {
      await rpcAdmin('app_create_user', { p_username:u.value.trim(), p_password:p.value, p_role:role });
      const name = u.value.trim(), pw = p.value;
      m.q('.modal-body').innerHTML = `<div class="success-box"><div class="sx-ic">${ICONS.check}</div><b>User created</b><span>Share these sign-in details with ${esc(name)}:</span>
        <div class="cred"><div><small>Username</small><b class="mono">${esc(name)}</b></div><div><small>Password</small><b class="mono">${esc(pw)}</b></div></div>
        <button class="btn btn-ghost" id="nu-copy">${ICONS.copy}<span>Copy details</span></button></div>`;
      m.q('.modal-foot').innerHTML = `<button class="btn btn-primary btn-block" id="nu-done">Done</button>`;
      m.q('#nu-copy').onclick = () => copyText(`Siddheshwar Automobile — Parts Tracker\nUsername: ${name}\nPassword: ${pw}`);
      m.q('#nu-done').onclick = m.close;
      adminReload('users', true);
    } catch(e){ msg.textContent = e.message; msg.className='form-hint bad'; setBusy(ok,false); }
  };
}

async function showPasswordDialog(u){
  const m = openModal({ title:'Password', sub:`for <b>${esc(u.username)}</b>${u.username===S.user?' (you)':''}`, icon:'key', size:'sm',
    body:`<div id="pw-body">${skeleton(1)}</div>`,
    footer:`<button class="btn btn-ghost" id="pw-cxl">Close</button><button class="btn btn-primary" id="pw-save" disabled>${ICONS.save}<span>No changes</span></button>` });
  m.q('#pw-cxl').onclick = m.close;
  let current = null;
  try { current = await rpcAdmin('app_get_password', { p_username:u.username }); }
  catch(e){ m.q('#pw-body').innerHTML = `<div class="alert alert-red">${ICONS.alert}<div>${esc(e.message)}</div></div>`; return; }
  m.q('#pw-body').innerHTML = `
    ${current==null?`<div class="alert alert-amber">${ICONS.info}<div><b>Not available yet</b><span>This password was set before passwords could be viewed. It will appear after ${esc(u.username)} next signs in — or set a new one below.</span></div></div>`:''}
    <label class="field-label">Current password</label>
    <div class="input-group"><span class="ig-ic">${ICONS.key}</span><input id="pw-in" class="mono" type="text" value="${esc(current||'')}" placeholder="${current==null?'Type a new password':''}"/>
      <button class="ig-btn" id="pw-eye">${ICONS.eyeOff}</button><button class="ig-btn" id="pw-copy" title="Copy">${ICONS.copy}</button><button class="ig-btn" id="pw-gen" title="Generate">${ICONS.wand}</button></div>
    <div class="form-hint" id="pw-msg">Edit and save to change it. ${u.username===S.user?'Your other devices will be signed out.':'They will be signed out on every device.'}</div>`;
  const inp = m.q('#pw-in'), save = m.q('#pw-save');
  const upd = () => { const ch = inp.value !== (current||'') && inp.value.length>=4; save.disabled = !ch; save.querySelector('span').textContent = ch ? 'Save password' : (inp.value.length && inp.value.length<4 ? 'Min 4 characters' : 'No changes'); };
  inp.oninput = upd;
  m.q('#pw-eye').onclick = () => { const hidden = inp.type==='password'; inp.type = hidden?'text':'password'; m.q('#pw-eye').innerHTML = hidden?ICONS.eyeOff:ICONS.eye; };
  m.q('#pw-copy').onclick = () => inp.value && copyText(inp.value);
  m.q('#pw-gen').onclick = () => { inp.value = genPassword(); upd(); };
  save.onclick = async () => {
    setBusy(save, true);
    try { await rpcAdmin('app_set_password', { p_username:u.username, p_password:inp.value }); current = inp.value; setBusy(save,false); upd(); toast('Password changed for '+u.username); m.close(); }
    catch(e){ m.q('#pw-msg').textContent = e.message; m.q('#pw-msg').className='form-hint bad'; setBusy(save,false); }
  };
}

function showRenameUser(u){
  const m = openModal({ title:'Rename user', sub:`All of <b>${esc(u.username)}</b>'s orders stay with them`, icon:'tag', size:'sm',
    body:`<label class="field-label">New username</label><div class="input-group"><span class="ig-ic">${ICONS.user}</span><input id="ru-in" value="${esc(u.username)}" autocapitalize="none"/></div><div class="form-hint" id="ru-msg"></div>`,
    footer:`<button class="btn btn-ghost" id="ru-cxl">Cancel</button><button class="btn btn-primary" id="ru-ok" disabled>${ICONS.check}<span>Rename</span></button>` });
  const inp = m.q('#ru-in'), ok = m.q('#ru-ok'), msg = m.q('#ru-msg');
  setTimeout(()=>{ inp.focus(); inp.select(); }, 80);
  inp.oninput = () => {
    const v = inp.value.trim();
    let good = USER_RE.test(v) && v!==u.username;
    if(v && !USER_RE.test(v)){ msg.textContent='Only letters, numbers and . _ - @ (3–30)'; msg.className='form-hint bad'; }
    else if(good && v.toLowerCase()!==u.username.toLowerCase() && S.users.some(x=>x.username.toLowerCase()===v.toLowerCase())){ good=false; msg.textContent='That username is already taken'; msg.className='form-hint bad'; }
    else { msg.textContent = good ? 'Available' : ''; msg.className = 'form-hint good'; }
    ok.disabled = !good;
  };
  m.q('#ru-cxl').onclick = m.close;
  ok.onclick = async () => {
    setBusy(ok, true);
    try {
      await rpcAdmin('app_rename_user', { p_old:u.username, p_new:inp.value.trim() });
      toast(`Renamed to ${inp.value.trim()}`); m.close();
      if(u.username===S.user) await checkSession();
      if(S.histUser===u.username) S.histUser = inp.value.trim();
      await loadOrders(); adminReload('users');
    } catch(e){ msg.textContent=e.message; msg.className='form-hint bad'; setBusy(ok,false); }
  };
}
async function toggleRole(u){
  const toAdmin = u.role!=='admin';
  if(u.username===S.user && !toAdmin){ toast('You cannot remove your own admin role','error'); return; }
  const ok = await confirmDialog({ title: toAdmin?'Make admin?':'Remove admin role?', icon:'shield', tone: toAdmin?'warn':'brand', confirm: toAdmin?'Make admin':'Make user',
    body: toAdmin ? `<b>${esc(u.username)}</b> will see every order, manage users, sheets, devices and the app lock, and can view all passwords.` : `<b>${esc(u.username)}</b> will only see their own orders.` });
  if(!ok) return;
  try { await rpcAdmin('app_set_role', { p_username:u.username, p_role: toAdmin?'admin':'user' }); toast('Role updated'); adminReload('users'); }
  catch(e){ toast(e.message,'error'); }
}
async function toggleUserActive(u){
  const ok = await confirmDialog({ title: u.active?'Disable user?':'Enable user?', icon:'power', tone: u.active?'danger':'brand', confirm: u.active?'Disable':'Enable',
    body: u.active ? `<b>${esc(u.username)}</b> will be signed out on every device and won't be able to sign in. Their orders are kept.` : `<b>${esc(u.username)}</b> will be able to sign in again.` });
  if(!ok) return;
  try { await rpcAdmin('app_set_active', { p_username:u.username, p_active:!u.active }); toast(u.active?'User disabled':'User enabled'); adminReload('users'); }
  catch(e){ toast(e.message,'error'); }
}
async function removeUser(u){
  const n = S.orders.filter(o=>o.created_by===u.username).length;
  const ok = await confirmDialog({ title:'Remove user?', icon:'trash', confirm:'Remove user', typeToConfirm:u.username,
    body:`This permanently removes the login <b>${esc(u.username)}</b>:<ul class="ul"><li>Signed out on every device right away</li><li>Can't sign in again</li><li>Their <b>${n} order${n!==1?'s are':' is'} kept</b>, shown as “${esc(u.username)} (removed)”</li></ul>` });
  if(!ok) return;
  try { await rpcAdmin('app_delete_user', { p_username:u.username }); toast('User removed','info'); await loadOrders(); adminReload('users'); }
  catch(e){ toast(e.message,'error'); }
}

/* Activity */
const LOG_FILTERS = [['all','All'],['order','Orders'],['user','Users & lock'],['sheet','Sheets & parts'],['device','Logins & devices']];
function logMatches(r, f){
  if(f==='all') return true;
  if(f==='user') return r.entity_type==='user' || r.entity_type==='settings';
  if(f==='sheet') return r.entity_type==='sheet' || r.entity_type==='part';
  return r.entity_type===f;
}
function logIcon(r){
  if(r.entity_type==='order') return r.action==='deleted'?'trash':r.action==='created'?'plus':r.action==='restored'?'restore':'edit';
  return { user:'users', settings:'lock', sheet:'sheet', part:'box', device: r.action==='login'?'logout':'desktop' }[r.entity_type] || 'activity';
}
function renderActivityTab(el){
  const rows = S.logRows.filter(r=>logMatches(r, S.logFilter));
  el.innerHTML = `
  <div class="panel-tools">
    <div class="pill-row">${LOG_FILTERS.map(([k,l])=>`<button class="pill ${S.logFilter===k?'active':''}" data-f="${k}">${l}</button>`).join('')}</div>
    <button class="btn btn-ghost btn-sm" id="log-exp">${ICONS.download}<span>Export 30 days</span></button>
  </div>
  ${!S.logRows.length ? skeleton(5) : !rows.length ? '<div class="empty-mini">Nothing here yet</div>' : `
  <div class="timeline">
    ${rows.map((r,i)=>{
      const canRestore = r.entity_type==='order' && r.before_data && ['deleted','updated','saved','renamed'].includes(r.action);
      return `<div class="tl-item tl-${esc(r.entity_type)} tl-a-${esc(r.action)}" style="animation-delay:${Math.min(i*.015,.3)}s">
        <span class="tl-ic">${ICONS[logIcon(r)]}</span>
        <div class="tl-body"><div class="tl-text">${esc(r.details || (r.action+' '+(r.entity_name||'')))}</div>
          <div class="tl-meta"><b>${esc(r.user_name||'—')}</b>${r.device_name?' · '+esc(r.device_name):''} · <span title="${esc(new Date(r.created_at).toLocaleString('en-IN'))}">${timeAgo(r.created_at)}</span></div></div>
        ${canRestore?`<button class="btn btn-ghost btn-sm log-restore" data-id="${r.id}">${ICONS.restore}<span>Restore</span></button>`:''}
      </div>`; }).join('')}
  </div>
  <div class="muted sm center" style="margin-top:12px">Showing the latest ${rows.length} entries · log is kept for 30 days</div>`}`;
  el.querySelectorAll('.pill[data-f]').forEach(b=>b.onclick=()=>{ S.logFilter=b.dataset.f; renderActivityTab(el); });
  el.querySelector('#log-exp').onclick = exportActivityLog;
  // scoped to THIS panel — never bind to a class across the whole page
  el.querySelectorAll('.timeline .log-restore').forEach(b=>b.onclick=()=>restoreFromLog(S.logRows.find(r=>r.id==b.dataset.id)));
}
async function restoreFromLog(r){
  if(!r || !r.before_data) return;
  const b = r.before_data;
  const id = Number(r.entity_id);
  const exists = S.orders.find(o=>o.id===id);
  const ok = await confirmDialog({ title:'Restore order?', icon:'restore', tone:'brand', confirm:'Restore',
    body: r.action==='deleted' ? `Order <b class="mono">${esc(b.invoice_no||r.entity_name)}</b> (${plural((b.parts||[]).length,'part')}) will be brought back${b.created_by?' for <b>'+esc(b.created_by)+'</b>':''}.`
      : exists ? `Order <b class="mono">${esc(exists.invoice_no)}</b> will go back to how it was before: ${plural((b.parts||exists.parts||[]).length,'part')}${b.invoice_no?', named <b class="mono">'+esc(b.invoice_no)+'</b>':''}.` : 'This order no longer exists, so it will be re-created from the saved copy.' });
  if(!ok) return;
  try {
    if(r.action==='deleted' || !exists){
      const src = r.action==='deleted' ? b : { ...exists, ...b };
      const parts = (src.parts||[]).map(withTotals), t = orderTotals(parts);
      const row = { invoice_no: src.invoice_no || r.entity_name || draftName(), invoice_date: src.invoice_date || localISODate(), sheet_id: src.sheet_id||null, sheet_name: src.sheet_name||'',
        parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice, created_by: src.created_by || S.user, created_at: src.created_at || new Date().toISOString(), updated_at:new Date().toISOString() };
      const { data, error } = await sb.from('short_orders').insert([row]).select().single();
      if(error) throw error;
      logActivity('order','restored',data.id,data.invoice_no,`Restored deleted order #${data.invoice_no}`, null, { parts });
    } else {
      const upd = { updated_at:new Date().toISOString() };
      if(b.parts){ const parts = b.parts.map(withTotals), t = orderTotals(parts); Object.assign(upd, { parts, total_actual_mrp:t.actual, total_printed_mrp:t.printed, total_invoice_mrp:t.invoice }); }
      if(b.invoice_no) upd.invoice_no = b.invoice_no;
      if(b.invoice_date) upd.invoice_date = b.invoice_date;
      const { error } = await sb.from('short_orders').update(upd).eq('id', id);
      if(error) throw error;
      logActivity('order','restored',id,upd.invoice_no||exists.invoice_no,`Restored #${upd.invoice_no||exists.invoice_no} to an earlier version`, { parts:exists.parts, invoice_no:exists.invoice_no, invoice_date:exists.invoice_date }, upd);
    }
    toast('Order restored'); await loadOrders(); adminReload('activity', true);
  } catch(e){ toast('Restore failed: '+(e.message||''),'error'); }
}
async function exportActivityLog(){
  progress(true);
  try {
    let all=[], from=0;
    while(true){
      const { data, error } = await sb.from('activity_log').select('created_at,user_name,device_name,entity_type,action,entity_name,details').order('created_at',{ascending:false}).range(from, from+999);
      if(error) throw error;
      all = all.concat(data||[]); if(!data || data.length<1000) break; from += 1000;
    }
    const rows = [['Siddheshwar Automobile — Activity log (last 30 days)'], [], ['Date','Time','User','Device','Type','Action','Item','Details'],
      ...all.map(r=>{ const d=new Date(r.created_at); return [fmtDMY(d), d.toLocaleTimeString('en-IN'), r.user_name||'', r.device_name||'', r.entity_type, r.action, r.entity_name||'', r.details||'']; })];
    const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:11},{wch:11},{wch:14},{wch:22},{wch:10},{wch:11},{wch:22},{wch:60}];
    XLSX.utils.book_append_sheet(wb, ws, 'Activity');
    XLSX.writeFile(wb, `SA_Activity_${localISODate()}.xlsx`);
    toast(`Exported ${fmtI(all.length)} entries`);
  } catch(e){ toast('Export failed: '+(e.message||''),'error'); }
  progress(false);
}

/* Devices */
function renderDevicesTab(el){
  const cutoff = Date.now() - 30*86400000;
  const devs = S.devices.filter(d=>new Date(d.last_seen_at).getTime() > cutoff);
  const hidden = S.devices.length - devs.length;
  el.innerHTML = !S.devices.length ? skeleton(3) : `
  <div class="device-grid">
    ${devs.map((d,i)=>{
      const online = isOnline(d), me = d.device_id===DEVICE_ID;
      const ic = d.device_type==='phone'?'phone':d.device_type==='tablet'?'tablet':'desktop';
      return `<div class="device-card ${online?'is-online':''} ${d.revoked?'is-off':''}" style="animation-delay:${i*.04}s" data-d="${esc(d.device_id)}">
        <span class="dc-ic">${ICONS[ic]}${online?'<i class="online"></i>':''}</span>
        <div class="dc-main">
          <b>${esc(d.custom_name || d.device_label || 'Unknown device')}</b>
          ${d.custom_name?`<small>${esc(d.device_label||'')}</small>`:''}
          <div class="dc-meta">${ICONS.user}${esc(d.user_name||'—')} · ${online?'<span class="good">Online now</span>':'Seen '+timeAgo(d.last_seen_at)}
            ${me?'<span class="chip chip-blue">This device</span>':''}${d.revoked?'<span class="chip chip-red">Signed out</span>':''}</div>
        </div>
        <div class="dc-actions">
          <button class="btn btn-ghost btn-sm" data-a="name">${ICONS.tag}<span>Name</span></button>
          ${!me && !d.revoked?`<button class="btn btn-ghost btn-sm danger" data-a="out">${ICONS.logout}<span>Sign out</span></button>`:''}
        </div>
      </div>`; }).join('')}
  </div>
  <div class="note" style="margin-top:14px">${ICONS.info} Browsers never reveal a computer's real name — give each device a name like “Counter PC” so the activity log is easy to read.${hidden?` ${hidden} device${hidden>1?'s':''} unused for 30+ days hidden.`:''}</div>`;
  el.querySelectorAll('.device-card').forEach(card=>{
    const d = S.devices.find(x=>x.device_id===card.dataset.d);
    card.querySelector('[data-a="name"]').onclick = () => nameDevice(d);
    card.querySelector('[data-a="out"]')?.addEventListener('click', ()=>signOutDevice(d));
  });
}
function nameDevice(d){
  const m = openModal({ title:'Name this device', sub:esc(d.device_label||''), icon:'desktop', size:'sm',
    body:`<label class="field-label">Device name</label><div class="input-group"><input id="dn-in" maxlength="60" value="${esc(d.custom_name||'')}" placeholder="e.g. Counter PC, Ravi's phone"/></div><div class="form-hint">Leave empty to use the detected name.</div>`,
    footer:`<button class="btn btn-ghost" id="dn-cxl">Cancel</button><button class="btn btn-primary" id="dn-ok">${ICONS.check}<span>Save</span></button>` });
  setTimeout(()=>m.q('#dn-in').focus(), 80);
  m.q('#dn-cxl').onclick = m.close;
  m.q('#dn-in').onkeydown = e => { if(e.key==='Enter') m.q('#dn-ok').click(); };
  m.q('#dn-ok').onclick = async () => {
    const btn = m.q('#dn-ok'); setBusy(btn,true);
    try { await rpcAdmin('app_device_rename', { p_device_id:d.device_id, p_name:m.q('#dn-in').value }); toast('Device named'); m.close(); adminReload('devices'); }
    catch(e){ toast(e.message,'error'); setBusy(btn,false); }
  };
}
async function signOutDevice(d){
  const ok = await confirmDialog({ title:'Sign out device?', icon:'logout', confirm:'Sign out',
    body:`<b>${esc(d.custom_name||d.device_label)}</b> (${esc(d.user_name||'')}) will be signed out right away. They can sign in again with their password.` });
  if(!ok) return;
  try { await rpcAdmin('app_device_revoke', { p_device_id:d.device_id }); toast('Device signed out','info'); adminReload('devices'); }
  catch(e){ toast(e.message,'error'); }
}

/* Storage */
function fmtBytes(b){ b=Number(b||0); if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; if(b<1073741824) return (b/1048576).toFixed(1)+' MB'; return (b/1073741824).toFixed(2)+' GB'; }
function renderStorageTab(el){
  const s = S.storage;
  if(!s){ el.innerHTML = skeleton(2); return; }
  const pct = Math.min(100, s.db_bytes/STORAGE_LIMIT*100);
  el.innerHTML = `
  <div class="storage-card anim-up">
    <div class="sc-top"><div><small>Database size</small><b>${fmtBytes(s.db_bytes)}</b><span class="muted"> of ${fmtBytes(STORAGE_LIMIT)} (Supabase free plan)</span></div><div class="sc-pct">${pct.toFixed(1)}%</div></div>
    <div class="meter ${pct>80?'warn':''}"><div style="width:${pct}%"></div></div>
    <div class="sc-rows">
      ${[['receipt','Orders',s.orders,s.orders_bytes],['box','Catalogue parts',s.parts,s.parts_bytes],['sheet','Sheets',s.sheets,null],['activity','Activity log (30 days)',s.log,s.log_bytes],['users','Users',s.users,null],['desktop','Devices',s.devices,null]]
        .map(([i,l,n,b])=>`<div class="sc-row"><span class="sc-ic">${ICONS[i]}</span><span>${l}</span><b>${fmtI(n)}</b><small>${b!=null?fmtBytes(b):''}</small></div>`).join('')}
    </div>
    <div class="note">${ICONS.info} Removing old parts sheets you no longer use frees the most space.</div>
  </div>`;
}

/* ── ACCOUNT ───────────────────────────────────────────────── */
function renderAccount(area){
  area.innerHTML = `
  ${topBar('My Account','Profile & security')}
  <div class="page-body narrow">
    <div class="profile-card anim-up">
      <div class="hero-grid"></div>
      <span class="avatar xl">${esc(initials(S.user))}</span>
      <div class="pc-name">${esc(S.user)}</div>
      <div class="pc-role">${isAdmin()?ICONS.shield+'Administrator':ICONS.user+'Staff user'}</div>
      <div class="pc-dev">${ICONS[(_devInfo?.type==='phone')?'phone':'desktop']}${esc(deviceDisplayName())}</div>
    </div>
    <div class="card anim-up1">
      <div class="card-title">${ICONS.key}Change my password</div>
      <label class="field-label">Current password</label><div class="input-group"><input id="ac-cp" type="password" autocomplete="current-password"/></div>
      <label class="field-label">New password</label><div class="input-group"><input id="ac-np" type="password" autocomplete="new-password" placeholder="At least 4 characters"/></div>
      <label class="field-label">Confirm new password</label><div class="input-group"><input id="ac-cf" type="password" autocomplete="new-password"/></div>
      <div class="form-err" id="ac-err"></div>
      <button class="btn btn-primary btn-block" id="ac-save">${ICONS.save}<span>Update password</span></button>
      ${isAdmin()?'':'<div class="form-hint">Forgot it? The admin can see and reset your password.</div>'}
    </div>
    <div class="card anim-up2">
      <div class="card-title">${ICONS.info}About</div>
      ${[['App','Short / Damaged Parts Tracker'],['Version',APP_VERSION],['Business','Siddheshwar Automobile'],['Sync',_rtOk?'Live':'Connecting…']].map(([k,v])=>`<div class="info-row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
    <button class="btn btn-ghost btn-block danger anim-up3" id="ac-out">${ICONS.logout}<span>Log out</span></button>
  </div>`;
  document.getElementById('ac-out').onclick = doLogout;
  document.getElementById('ac-save').onclick = async e => {
    const cp = document.getElementById('ac-cp').value, np = document.getElementById('ac-np').value, cf = document.getElementById('ac-cf').value;
    const err = document.getElementById('ac-err');
    if(np.length < 4){ err.textContent = 'New password must be at least 4 characters'; return; }
    if(np !== cf){ err.textContent = 'Passwords do not match'; return; }
    const btn = e.currentTarget; setBusy(btn, true);
    const { error } = await sb.rpc('app_change_own_password', { p_token:S.token, p_old:cp, p_new:np });
    setBusy(btn, false);
    if(error){ err.textContent = error.message; return; }
    err.textContent = ''; ['ac-cp','ac-np','ac-cf'].forEach(id=>document.getElementById(id).value='');
    toast('Password updated — other devices were signed out');
  };
}
/* ── BOOT ──────────────────────────────────────────────────── */
async function boot(){
  const splashMin = new Promise(r=>setTimeout(r, 350));
  if(!SUPABASE_KEY || SUPABASE_KEY.startsWith('sb_publishable_')){
    await splashMin;
    app.innerHTML = `<div class="fatal"><div class="fatal-card">${ICONS.alert}<h2>Supabase key required</h2><p>Open <code>app.js</code> and set <code>SUPABASE_KEY</code> to the <b>anon / public</b> key (starts with <code>eyJ…</code>) from Supabase → Settings → API Keys.</p></div></div>`;
    return;
  }
  const stored = readStoredSession();
  if(stored){
    S.user = stored.user; S.role = stored.role; S.token = stored.token;
    const check = checkSession();          // runs in parallel with the splash
    const st = await Promise.race([check, new Promise(r=>setTimeout(()=>r('slow'), 1500))]);
    if(st==='invalid'){
      await splashMin;
      clearStoredSession(); S.user = S.role = S.token = null;
      renderLogin();
      toast('Please sign in again', 'info');
      return;
    }
    // 'valid', 'unknown' (weak signal) or still checking → never lock someone out on a slow network
    if(st==='slow') check.then(r=>{ if(r==='invalid' && S.user) handleSessionInvalid(); });
    registerDeviceSession();
    await splashMin;
    await enterApp();
    return;
  }
  await splashMin;
  renderLogin();
}
boot();
