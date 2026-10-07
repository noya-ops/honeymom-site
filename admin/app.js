// HoneyMom admin panel. Static page; all data comes from the `admin-api`
// Edge Function, which checks that the signed-in user is an admin.
// Only the public (publishable) key lives here - never a secret.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://whycagyprmmwhmcfnlbc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wvsU4rIIiWBKZL09JLI1wQ_UQeBbGhf';
const REDIRECT_URL = 'https://noya-ops.github.io/honeymom-site/admin/';
const API_URL = `${SUPABASE_URL}/functions/v1/admin-api`;
const TZ = 'Asia/Jerusalem';

// Read the auth result from the URL before supabase-js clears it.
const initialHash = new URLSearchParams(location.hash.slice(1));
const initialQuery = new URLSearchParams(location.search);
let recoveryMode = initialHash.get('type') === 'recovery';
const urlError = initialHash.get('error_description') || initialQuery.get('error_description');

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});

const state = { me: null, role: null, usersQuery: { search: '', page: 1 }, auditPage: 1, currentDetail: null };

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isAdmin = () => state.role === 'admin';

const dtFmt = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const dFmt = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (iso) => (iso ? dtFmt.format(new Date(iso)) : '—');
const fmtDate = (iso) => (iso ? dFmt.format(new Date(iso)) : '—');
const fmtDay = (day) => { const [y, m, d] = day.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const fmtShortDay = (day) => { const [, m, d] = day.split('-'); return `${+d}/${+m}`; };
const nf = new Intl.NumberFormat('he-IL');
const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const relTime = (iso) => {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `לפני ${Math.max(mins, 1)} דק׳`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.round(hours / 24);
  return days < 30 ? `לפני ${days} ימים` : fmtDate(iso);
};

const STATUS = {
  purchase: 'רכישה',
  gift: 'מתנה',
  grandfathered: 'ותיק (חינם)',
  locked: 'נעול',
  unlocked: 'פתוח',
};
const statusBadge = (s) => (s ? `<span class="badge ${esc(s)}">${esc(STATUS[s] ?? s)}</span>` : '<span class="muted">ללא משפחה</span>');
const ROLE = { mom: 'אמא', dad: 'אבא' };
const ADMIN_ROLE = { admin: 'מנהל/ת', viewer: 'צפייה בלבד' };
const TABLES = {
  feedings: 'הנקות',
  events: 'אירועים',
  pumpings: 'שאיבות',
  bottle_feedings: 'בקבוקים',
  temperatures: 'חום',
  sleeps: 'שינה',
};
const ACTIONS = {
  gift_unlock: 'פתיחה במתנה',
  lock_family: 'נעילת משפחה',
  delete_user: 'מחיקת משתמש',
  review_account_prepare: 'הכנת App Review',
  add_admin: 'הוספת מנהל',
  set_admin_role: 'שינוי הרשאה',
  remove_admin: 'הסרת מנהל',
};
const ERRORS = {
  unauthorized: 'החיבור פג. צריך להתחבר מחדש.',
  forbidden: 'אין לך הרשאה לפעולה הזו.',
  reason_required: 'צריך לכתוב סיבה (לפחות 3 תווים).',
  already_unlocked: 'המשפחה כבר פתוחה.',
  already_locked: 'המשפחה כבר נעולה.',
  grandfathered: 'זו משפחה ותיקה (חינם). כדי לנעול בכל זאת צריך לסמן "לנעול בכל זאת".',
  cannot_delete_self: 'אי אפשר למחוק את עצמך.',
  cannot_delete_admin: 'זה חשבון של מנהל. קודם צריך להסיר לו את ההרשאה.',
  protected_account: 'אי אפשר למחוק את חשבון ה-App Review.',
  user_not_found: 'אין משתמש עם המייל הזה. צריך קודם להירשם באפליקציה.',
  already_admin: 'המשתמש כבר ברשימת המנהלים.',
  last_admin: 'חייב להישאר לפחות מנהל/ת אחד/ת עם הרשאה מלאה.',
  cannot_remove_self: 'אי אפשר להסיר את עצמך.',
  cannot_change_self: 'אי אפשר לשנות את ההרשאה של עצמך.',
  weak_password: 'הסיסמה צריכה להיות באורך 8 תווים לפחות.',
  review_user_not_found: 'חשבון ה-App Review לא קיים.',
  review_user_has_no_family: 'לחשבון ה-App Review אין משפחה. צריך להיכנס איתו פעם אחת באפליקציה וליצור משפחה.',
  family_not_found: 'המשפחה לא נמצאה (אולי נמחקה).',
};

async function api(action, params = {}) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw Object.assign(new Error(ERRORS.unauthorized), { code: 'unauthorized', status: 401 });
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new Error('אין חיבור לשרת. כדאי לבדוק את החיבור לאינטרנט.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const code = body?.error ?? `http_${res.status}`;
    throw Object.assign(new Error(ERRORS[code] ?? body?.message ?? `שגיאה (${res.status})`), { code, status: res.status });
  }
  return body;
}

const errorCard = (e) => `<div class="msg error">${esc(e.message)}</div>`;
const loading = () => '<div class="center-pad"><div class="spinner" style="margin:40px auto"></div></div>';

// ---------- screens ----------

function showScreen(id) {
  for (const s of ['boot', 'auth', 'denied', 'app']) $(`#${s}`).hidden = s !== id;
}

function authMode(mode) {
  for (const m of ['password', 'magic', 'forgot', 'newpass']) $(`#form-${m}`).hidden = m !== mode;
  authMsg('');
}

function authMsg(text, kind = '') {
  const el = $('#auth-msg');
  el.hidden = !text;
  el.textContent = text;
  el.className = `msg ${kind}`;
}

const AUTH_ERRORS = {
  'Invalid login credentials': 'אימייל או סיסמה שגויים.',
  'Email not confirmed': 'המייל עוד לא אומת.',
  'Email rate limit exceeded': 'נשלחו יותר מדי מיילים. כדאי לנסות שוב בעוד כמה דקות.',
};
const authErr = (e) => AUTH_ERRORS[e.message] ?? e.message;

function setupAuthForms() {
  $$('[data-auth-mode]').forEach((b) => b.addEventListener('click', () => authMode(b.dataset.authMode)));

  $('#form-password').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    btn.disabled = false;
    if (error) return authMsg(authErr(error), 'error');
    f.reset();
    await enterApp();
  });

  $('#form-magic').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({
      email: f.email.value.trim(),
      options: { emailRedirectTo: REDIRECT_URL, shouldCreateUser: false },
    });
    btn.disabled = false;
    if (error) return authMsg(authErr(error), 'error');
    authMsg('אם המייל רשום, נשלח אליו קישור כניסה. אפשר לסגור את הלשונית הזו ולפתוח את הקישור.', 'ok');
  });

  $('#form-forgot').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: REDIRECT_URL });
    btn.disabled = false;
    if (error) return authMsg(authErr(error), 'error');
    authMsg('אם המייל רשום, נשלח אליו קישור לבחירת סיסמה חדשה.', 'ok');
  });

  $('#form-newpass').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    if (f.password.value !== f.password2.value) return authMsg('הסיסמאות לא זהות.', 'error');
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    btn.disabled = false;
    if (error) return authMsg(authErr(error), 'error');
    recoveryMode = false;
    f.reset();
    await enterApp();
  });

  $$('[data-signout]').forEach((b) =>
    b.addEventListener('click', async () => {
      await sb.auth.signOut();
      state.me = state.role = null;
      showScreen('auth');
      authMode('password');
    }),
  );
}

async function enterApp() {
  showScreen('boot');
  let me;
  try {
    me = await api('me');
  } catch (e) {
    if (e.status === 403) {
      const { data } = await sb.auth.getUser();
      $('#denied-email').textContent = data.user?.email ?? '';
      return showScreen('denied');
    }
    showScreen('auth');
    authMode('password');
    return authMsg(e.message, 'error');
  }
  state.me = me;
  state.role = me.role;
  $('#who-email').textContent = me.email;
  const roleBadge = $('#who-role');
  roleBadge.textContent = ADMIN_ROLE[me.role];
  roleBadge.className = `badge ${me.role}`;
  $$('[data-admin-only]').forEach((el) => (el.hidden = !isAdmin()));
  showScreen('app');
  route();
}

// ---------- routing ----------

const VIEWS = { overview: renderOverview, users: renderUsers, revenue: renderRevenue, support: renderSupport, admins: renderAdmins, audit: renderAudit };

function route() {
  if (!state.me) return;
  let tab = location.hash.slice(1);
  if (!VIEWS[tab] || (tab === 'admins' && !isAdmin())) tab = 'overview';
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  $('#nav a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $$('.view').forEach((v) => (v.hidden = v.id !== `view-${tab}`));
  VIEWS[tab]($(`#view-${tab}`));
}
window.addEventListener('hashchange', route);

// ---------- charts (inline SVG, single series) ----------

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// Charts render at the container's real pixel width so text stays readable.
const chartSpecs = new Map();
let chartSeq = 0;
function chartSlot(rows, key, label, cls = '') {
  const id = `c${++chartSeq}`;
  chartSpecs.set(id, { rows, key, label, cls });
  return `<div class="chart-slot" data-chart="${id}"></div>`;
}
function drawCharts(root = document) {
  $$('.chart-slot', root).forEach((slot) => {
    const spec = chartSpecs.get(slot.dataset.chart);
    const w = Math.round(slot.clientWidth);
    if (!spec || !w || slot.dataset.w === String(w)) return;
    slot.dataset.w = String(w);
    slot.innerHTML = barChart(spec.rows, spec.key, spec.label, spec.cls, w);
  });
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => drawCharts(), 150); });

function barChart(rows, key, label, cls = '', W = 640) {
  const H = 200, L = 34, R = 6, T = 12, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(0, ...rows.map((r) => r[key])));
  const band = pw / rows.length;
  const bw = Math.max(4, Math.min(16, band * 0.62));
  const y = (v) => T + ph - (v / max) * ph;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
  for (const t of [0, max / 2, max]) {
    const yy = y(t).toFixed(1);
    s += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>`;
    s += `<text class="axis" x="${L - 6}" y="${+yy + 4}" text-anchor="end">${nf.format(Math.round(t * 10) / 10)}</text>`;
  }
  rows.forEach((r, i) => {
    const cx = L + band * i + band / 2;
    const v = r[key];
    const h = (v / max) * ph;
    const x0 = cx - bw / 2, x1 = cx + bw / 2, yb = T + ph;
    const rad = Math.min(4, h, bw / 2);
    const tip = `${fmtDay(r.day)} · ${nf.format(v)} ${label}`;
    s += `<g data-tip="${esc(tip)}"><rect class="hit" x="${(L + band * i).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${ph}"/>`;
    if (v > 0) {
      s += `<path class="bar ${cls}" d="M${x0.toFixed(1)},${yb} V${(yb - h + rad).toFixed(1)} Q${x0.toFixed(1)},${(yb - h).toFixed(1)} ${(x0 + rad).toFixed(1)},${(yb - h).toFixed(1)} H${(x1 - rad).toFixed(1)} Q${x1.toFixed(1)},${(yb - h).toFixed(1)} ${x1.toFixed(1)},${(yb - h + rad).toFixed(1)} V${yb} Z"/>`;
    }
    s += '</g>';
    if ((rows.length - 1 - i) % (W < 420 ? 7 : 5) === 0) {
      s += `<text class="axis" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmtShortDay(r.day)}</text>`;
    }
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="#cfd9e0"/></svg>`;
  return s;
}

function tableView(rows, cols) {
  return `<details class="table-view"><summary>הצגה כטבלה</summary><div class="table-wrap" style="margin-top:8px;max-height:260px"><table>
    <thead><tr><th>יום</th>${cols.map(([, h]) => `<th class="num">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${[...rows].reverse().map((r) => `<tr><td>${fmtDay(r.day)}</td>${cols.map(([k]) => `<td class="num">${nf.format(r[k])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div></details>`;
}

// Tooltip for any [data-tip] element.
const tooltip = $('#tooltip');
document.addEventListener('mousemove', (e) => {
  const g = e.target.closest?.('[data-tip]');
  if (!g) return void (tooltip.hidden = true);
  tooltip.textContent = g.dataset.tip;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(Math.max(e.clientX, 90), innerWidth - 90)}px`;
  tooltip.style.top = `${e.clientY}px`;
});
document.addEventListener('touchstart', (e) => {
  const g = e.target.closest?.('[data-tip]');
  if (!g) return void (tooltip.hidden = true);
  const t = e.touches[0];
  tooltip.textContent = g.dataset.tip;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(Math.max(t.clientX, 90), innerWidth - 90)}px`;
  tooltip.style.top = `${t.clientY - 20}px`;
}, { passive: true });

// ---------- overview ----------

async function renderOverview(el) {
  el.innerHTML = `<div class="view-head"><h1>סקירה</h1><button class="btn small" id="ov-refresh">רענון</button></div>${loading()}`;
  $('#ov-refresh', el).onclick = () => renderOverview(el);
  let s;
  try {
    s = await api('stats');
  } catch (e) {
    return (el.innerHTML = errorCard(e));
  }
  const fs = s.familiesByStatus;
  const sharedPct = s.families ? Math.round((s.sharedFamilies / s.families) * 100) : 0;
  const kpi = (label, value, hint = '', accent = false) =>
    `<div class="kpi${accent ? ' accent' : ''}"><div class="label">${label}</div><div class="value">${value}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  const sum = (k) => s.days.reduce((n, d) => n + d[k], 0);
  el.innerHTML = `
    <div class="view-head"><h1>סקירה</h1><button class="btn small" id="ov-refresh">רענון</button></div>
    <div class="kpis">
      ${kpi('משתמשים', nf.format(s.users), `מתוכם ${nf.format(s.testUsers)} חשבונות בדיקה`)}
      ${kpi('משפחות', nf.format(s.families))}
      ${kpi('משפחות משותפות', `${sharedPct}%`, `${nf.format(s.sharedFamilies)} עם שני הורים`)}
      ${kpi('רכשו', nf.format(fs.purchase ?? 0), '', true)}
      ${kpi('קיבלו במתנה', nf.format(fs.gift ?? 0))}
      ${kpi('ותיקים (חינם)', nf.format(fs.grandfathered ?? 0))}
      ${kpi('נעולות', nf.format(fs.locked ?? 0), 'עוד לא רכשו')}
    </div>
    <div class="grid">
      <div class="card"><h2>הרשמות ליום</h2><p class="sub">30 הימים האחרונים · סה״כ ${nf.format(sum('signups'))}</p>
        ${chartSlot(s.days, 'signups', 'הרשמות')}${tableView(s.days, [['signups', 'הרשמות']])}</div>
      <div class="card"><h2>משפחות פעילות ליום</h2><p class="sub">משפחות שהוסיפו או ערכו רשומה באותו יום</p>
        ${chartSlot(s.days, 'activeFamilies', 'משפחות פעילות')}${tableView(s.days, [['activeFamilies', 'משפחות']])}</div>
      <div class="card"><h2>רשומות ליום</h2><p class="sub">רשומות שנוספו או נערכו · סה״כ ${nf.format(sum('entries'))}</p>
        ${chartSlot(s.days, 'entries', 'רשומות', 'alt')}${tableView(s.days, [['entries', 'רשומות']])}</div>
    </div>
    <p class="muted" style="font-size:13px;margin-top:12px">ימים לפי שעון ישראל.</p>`;
  $('#ov-refresh', el).onclick = () => renderOverview(el);
  drawCharts(el);
}

// ---------- users & families ----------

let searchTimer;
async function renderUsers(el) {
  if (!$('#users-search', el)) {
    el.innerHTML = `
      <div class="view-head"><h1>משתמשים ומשפחות</h1></div>
      <div class="row" style="margin-bottom:14px">
        <label style="flex:1 1 260px">חיפוש<input id="users-search" type="search" placeholder="אימייל או קוד משפחה" dir="auto"></label>
      </div>
      <div id="users-table"></div>`;
    const input = $('#users-search', el);
    input.value = state.usersQuery.search;
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.usersQuery = { search: input.value.trim(), page: 1 };
        loadUsers();
      }, 300);
    });
  }
  loadUsers();
}

async function loadUsers() {
  const box = $('#users-table');
  if (!box) return;
  box.innerHTML = loading();
  let res;
  try {
    res = await api('users', state.usersQuery);
  } catch (e) {
    return (box.innerHTML = errorCard(e));
  }
  if (res.users.length === 0) return (box.innerHTML = '<div class="card empty">לא נמצאו משתמשים</div>');
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  box.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>אימייל</th><th>תפקיד</th><th>משפחה</th><th>בן/בת זוג</th><th>סטטוס</th><th>נרשם</th><th>כניסה אחרונה</th><th>פעילות אחרונה</th></tr></thead>
      <tbody>${res.users
        .map(
          (u, i) => `<tr class="clickable" data-i="${i}" tabindex="0">
            <td><span dir="ltr">${esc(u.email)}</span> ${u.isTest ? '<span class="badge test">בדיקה</span>' : ''}</td>
            <td>${esc(ROLE[u.role] ?? '—')}</td>
            <td class="mono" dir="ltr">${esc(u.inviteCode ?? '—')}</td>
            <td>${u.partnerEmails.length ? u.partnerEmails.map((p) => `<span dir="ltr">${esc(p)}</span>`).join('<br>') : '<span class="muted">—</span>'}</td>
            <td>${statusBadge(u.status)}</td>
            <td>${fmtDate(u.createdAt)}</td>
            <td>${relTime(u.lastSignInAt)}</td>
            <td>${relTime(u.lastActivity)}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <div class="pager">
      <button class="btn small" id="pg-prev" ${res.page <= 1 ? 'disabled' : ''}>הקודם</button>
      <span>עמוד ${res.page} מתוך ${pages} · ${nf.format(res.total)} משתמשים</span>
      <button class="btn small" id="pg-next" ${res.page >= pages ? 'disabled' : ''}>הבא</button>
    </div>`;
  $$('tr.clickable', box).forEach((tr) => {
    const open = () => openDetail(res.users[+tr.dataset.i]);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  });
  $('#pg-prev', box).onclick = () => { state.usersQuery.page--; loadUsers(); };
  $('#pg-next', box).onclick = () => { state.usersQuery.page++; loadUsers(); };
}

// ---------- detail drawer ----------

function openDrawer(title) {
  $('#drawer-title').textContent = title;
  $('#drawer').hidden = false;
  $('#drawer-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  $('#drawer').hidden = true;
  $('#drawer-backdrop').hidden = true;
  document.body.style.overflow = '';
  state.currentDetail = null;
}
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => e.key === 'Escape' && !$('#drawer').hidden && closeDrawer());

async function openDetail(user) {
  state.currentDetail = user;
  openDrawer(user.familyId ? `משפחה ${user.inviteCode}` : 'משתמש ללא משפחה');
  const body = $('#drawer-body');
  if (!user.familyId) return renderLonelyUser(body, user);
  body.innerHTML = loading();
  let f;
  try {
    f = await api('family', { familyId: user.familyId });
  } catch (e) {
    return (body.innerHTML = errorCard(e));
  }
  if (state.currentDetail !== user) return;
  const babies = f.babies.length
    ? f.babies.map((b) => `${esc(b.name)} · ${b.gender === 'boy' ? 'בן' : 'בת'} · נולד/ה ${fmtDate(b.birth_date)}`).join('<br>')
    : '—';
  body.innerHTML = `
    <dl class="kv">
      <dt>סטטוס</dt><dd>${statusBadge(f.status)}${f.unlockedAt ? ` <span class="muted">מ-${fmtDate(f.unlockedAt)}</span>` : ''}</dd>
      <dt>קוד הזמנה</dt><dd class="mono" dir="ltr">${esc(f.inviteCode)}</dd>
      <dt>תינוק/ת</dt><dd>${babies}</dd>
      <dt>נוצרה</dt><dd>${fmtDateTime(f.createdAt)}</dd>
      <dt>פעילות אחרונה</dt><dd>${f.lastActivity ? `${fmtDateTime(f.lastActivity)} <span class="muted">(${relTime(f.lastActivity)})</span>` : '—'}</dd>
    </dl>
    <div>
      <h3 class="section-title">הורים</h3>
      ${f.members
        .map(
          (m) => `<div class="member">
            <div><div class="email" dir="ltr">${esc(m.email ?? m.userId)}</div>
            <div class="meta">${esc(ROLE[m.role] ?? m.role)} · הצטרף/ה ${fmtDate(m.joinedAt)} · כניסה אחרונה ${relTime(m.lastSignInAt)} ${m.isTest ? '<span class="badge test">בדיקה</span>' : ''}</div></div>
            ${isAdmin() ? `<button class="btn small danger" data-delete="${esc(m.userId)}" data-email="${esc(m.email ?? '')}">מחיקת משתמש</button>` : ''}
          </div>`,
        )
        .join('')}
    </div>
    <div>
      <h3 class="section-title">כמות רשומות</h3>
      <div class="counts">${Object.entries(TABLES).map(([k, h]) => `<div><b>${nf.format(f.entryCounts[k] ?? 0)}</b><span>${h}</span></div>`).join('')}</div>
      <p class="muted" style="font-size:12px;margin:6px 0 0">מוצגות כמויות בלבד. תוכן הרשומות פרטי ולא מוצג.</p>
    </div>
    ${isAdmin() ? `<div><h3 class="section-title">פעולות</h3>
      <div class="actions">
        ${f.status === 'locked' ? '<button class="btn" id="act-gift">פתיחה במתנה</button>' : '<button class="btn danger" id="act-lock">נעילה (החזר כספי)</button>'}
      </div>
      <div id="act-area" style="margin-top:12px"></div></div>` : '<p class="muted" style="font-size:13px">הרשאת צפייה בלבד: אין פעולות.</p>'}`;

  if (!isAdmin()) return;
  const area = $('#act-area', body);
  const reload = () => { openDetail(user); loadUsers(); };
  const gift = $('#act-gift', body);
  if (gift) gift.onclick = () => confirmBox(area, {
    calm: true,
    text: `לפתוח את משפחה ${f.inviteCode} במתנה? כל ההורים במשפחה יקבלו גישה מלאה.`,
    confirmLabel: 'פתיחה במתנה',
    run: (reason) => api('gift_unlock', { familyId: f.id, reason }),
    done: reload,
  });
  const lock = $('#act-lock', body);
  if (lock) lock.onclick = () => confirmBox(area, {
    text: `לנעול את משפחה ${f.inviteCode}? למשל אחרי החזר כספי מאפל. ההורים יחזרו למסך הרכישה.`,
    extra: f.unlockSource === 'grandfathered' ? '<label class="check"><input type="checkbox" name="force"> זו משפחה ותיקה (חינם). לנעול בכל זאת</label>' : '',
    confirmLabel: 'נעילה',
    run: (reason, form) => api('lock_family', { familyId: f.id, reason, force: !!form.force?.checked }),
    done: reload,
  });
  $$('[data-delete]', body).forEach((b) => (b.onclick = () => confirmBox(area, {
    text: `למחוק לצמיתות את המשתמש ${b.dataset.email}? אם זה ההורה היחיד במשפחה, כל נתוני המשפחה יימחקו. אי אפשר לבטל.`,
    confirmLabel: 'מחיקה לצמיתות',
    run: (reason) => api('delete_user', { userId: b.dataset.delete, reason }),
    done: (r) => {
      if (r.familiesDeleted?.length) { closeDrawer(); loadUsers(); } else reload();
    },
  })));
}

function renderLonelyUser(body, u) {
  body.innerHTML = `
    <dl class="kv">
      <dt>אימייל</dt><dd dir="ltr">${esc(u.email)} ${u.isTest ? '<span class="badge test">בדיקה</span>' : ''}</dd>
      <dt>נרשם</dt><dd>${fmtDateTime(u.createdAt)}</dd>
      <dt>כניסה אחרונה</dt><dd>${fmtDateTime(u.lastSignInAt)}</dd>
      <dt>משפחה</dt><dd class="muted">עוד לא יצר/ה או הצטרף/ה למשפחה</dd>
    </dl>
    ${isAdmin() ? '<div class="actions"><button class="btn danger" id="act-del">מחיקת משתמש</button></div><div id="act-area"></div>' : ''}`;
  if (!isAdmin()) return;
  $('#act-del', body).onclick = () => confirmBox($('#act-area', body), {
    text: `למחוק לצמיתות את המשתמש ${u.email}? אי אפשר לבטל.`,
    confirmLabel: 'מחיקה לצמיתות',
    run: (reason) => api('delete_user', { userId: u.userId, reason }),
    done: () => { closeDrawer(); loadUsers(); },
  });
}

// In-page confirmation with a required reason.
function confirmBox(area, { text, extra = '', confirmLabel, run, done, calm = false, needReason = true }) {
  area.innerHTML = `<form class="confirm-box${calm ? ' calm' : ''}">
    <p>${esc(text)}</p>
    ${needReason ? '<label>סיבה (נשמרת ביומן הפעולות)<textarea name="reason" required minlength="3" placeholder="לדוגמה: החזר כספי מאפל, פנייה מס׳ ..."></textarea></label>' : ''}
    ${extra}
    <div class="actions"><button type="submit" class="btn ${calm ? 'primary' : 'danger solid'}">${esc(confirmLabel)}</button><button type="button" class="btn" data-cancel>ביטול</button></div>
    <div class="out"></div>
  </form>`;
  const form = $('form', area);
  form.reason?.focus();
  $('[data-cancel]', form).onclick = () => (area.innerHTML = '');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const reason = form.reason?.value.trim() ?? '';
    if (needReason && reason.length < 3) return ($('.out', form).innerHTML = `<div class="msg error">${ERRORS.reason_required}</div>`);
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await run(reason, form);
      area.innerHTML = '<div class="msg ok">בוצע.</div>';
      setTimeout(() => done?.(r), 700);
    } catch (e) {
      btn.disabled = false;
      $('.out', form).innerHTML = errorCard(e);
    }
  };
}

// ---------- revenue ----------

async function renderRevenue(el) {
  el.innerHTML = `<div class="view-head"><h1>הכנסות</h1></div>${loading()}`;
  let r;
  try {
    r = await api('revenue');
  } catch (e) {
    return (el.innerHTML = errorCard(e));
  }
  const byDay = new Map(r.perDay.map((d) => [d.day, d.purchases]));
  const last30 = [];
  const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) + 'T00:00:00Z');
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    last30.push({ day, purchases: byDay.get(day) ?? 0 });
  }
  el.innerHTML = `
    <div class="view-head"><h1>הכנסות</h1><a class="btn small" href="https://app.revenuecat.com" target="_blank" rel="noopener">פתיחת RevenueCat ↗</a></div>
    <div class="kpis">
      <div class="kpi accent"><div class="label">רכישות</div><div class="value">${nf.format(r.count)}</div><div class="hint">${ils.format(r.priceIls)} לרכישה</div></div>
      <div class="kpi"><div class="label">ברוטו</div><div class="value">${ils.format(r.grossIls)}</div><div class="hint">כולל מע״מ</div></div>
      <div class="kpi"><div class="label">אחרי עמלת אפל (15%)</div><div class="value">${ils.format(r.netAfterAppleIls)}</div></div>
      <div class="kpi"><div class="label">הערכה אחרי מע״מ ועמלה</div><div class="value">${ils.format(r.netAfterVatAndAppleIls)}</div><div class="hint">קרוב למה שאפל מעבירה</div></div>
    </div>
    <div class="msg">הערכה לפי משפחות שנפתחו ברכישה. המקור הקובע להכנסות הוא <a href="https://app.revenuecat.com" target="_blank" rel="noopener">RevenueCat</a>. החזרים כספיים שלא ננעלו כאן עדיין נספרים.</div>
    <div class="card" style="margin-top:16px"><h2>רכישות ליום</h2><p class="sub">30 הימים האחרונים</p>${chartSlot(last30, 'purchases', 'רכישות')}</div>
    <div class="card"><h2>כל הימים עם רכישות</h2>
      ${r.perDay.length ? `<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>יום</th><th class="num">רכישות</th><th class="num">ברוטו</th></tr></thead>
      <tbody>${r.perDay.map((d) => `<tr><td>${fmtDay(d.day)}</td><td class="num">${nf.format(d.purchases)}</td><td class="num">${ils.format(d.grossIls)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">עוד אין רכישות</div>'}
    </div>`;
  drawCharts(el);
}

// ---------- support ----------

function renderSupport(el) {
  el.innerHTML = `
    <div class="view-head"><h1>תמיכה</h1></div>
    <div class="card" style="max-width:640px">
      <h2>הכנת משתמש App Review</h2>
      <p class="sub">מכין את החשבון <span dir="ltr">appreview.demo@babytrackerapp.test</span> לבדיקה של אפל: קובע לו את הסיסמה שתכתבי כאן, מוודא שהמשפחה שלו פתוחה, ואם לא נרשם בו כלום ב-24 השעות האחרונות מוסיף כמה רשומות לדוגמה מהיום (2 הנקות, פיפי וקקי, שינה אחת). את אותה סיסמה צריך לרשום ב-App Store Connect.</p>
      <form id="review-form" class="stack">
        <label>סיסמה לחשבון<input name="password" type="text" minlength="8" required dir="ltr" autocomplete="off" ${isAdmin() ? '' : 'disabled'}></label>
        <div><button class="btn primary" type="submit" ${isAdmin() ? '' : 'disabled'}>הכנת החשבון</button></div>
        ${isAdmin() ? '' : '<p class="muted" style="font-size:13px;margin:0">הרשאת צפייה בלבד.</p>'}
      </form>
      <div id="review-out" style="margin-top:12px"></div>
    </div>`;
  const form = $('#review-form', el);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const out = $('#review-out', el);
    const btn = form.querySelector('button');
    btn.disabled = true;
    out.innerHTML = loading();
    try {
      const r = await api('review_account_prepare', { password: form.password.value });
      const he = (s) =>
        s
          .replace('password set', 'הסיסמה נקבעה')
          .replace(/family already unlocked \((\w+)\)/, (_, src) => `המשפחה כבר פתוחה (${STATUS[src] ?? src})`)
          .replace('family unlocked (gift)', 'המשפחה נפתחה (מתנה)')
          .replace(/(\d+) entries in the last 24h - no sample entries added/, 'יש כבר $1 רשומות מה-24 שעות האחרונות, לא נוספו רשומות')
          .replace(/sample entries added.*/, 'נוספו רשומות לדוגמה: 2 הנקות, 3 חיתולים (פיפי/קקי), שינה אחת')
          .replace('no baby in family - sample entries skipped', 'אין תינוק במשפחה, לא נוספו רשומות');
      out.innerHTML = `<div class="msg ok">החשבון מוכן (משפחה <span dir="ltr">${esc(r.inviteCode)}</span>)</div><ul class="result">${r.done.map((d) => `<li>${esc(he(d))}</li>`).join('')}</ul>`;
      form.reset();
    } catch (e) {
      out.innerHTML = errorCard(e);
    }
    btn.disabled = false;
  };
}

// ---------- admins ----------

async function renderAdmins(el) {
  el.innerHTML = `<div class="view-head"><h1>מנהלים</h1></div>${loading()}`;
  let r;
  try {
    r = await api('admins');
  } catch (e) {
    return (el.innerHTML = errorCard(e));
  }
  el.innerHTML = `
    <div class="view-head"><h1>מנהלים</h1></div>
    <div class="table-wrap"><table>
      <thead><tr><th>אימייל</th><th>הרשאה</th><th>נוסף</th><th>נוסף ע״י</th><th></th></tr></thead>
      <tbody>${r.admins
        .map((a) => {
          const self = a.userId === state.me.userId;
          return `<tr data-id="${esc(a.userId)}">
            <td dir="ltr">${esc(a.email ?? a.userId)} ${self ? '<span class="badge">את/ה</span>' : ''}</td>
            <td>${self ? `<span class="badge ${a.role}">${ADMIN_ROLE[a.role]}</span>` : `<select data-role style="min-width:140px;width:auto">${Object.entries(ADMIN_ROLE).map(([k, v]) => `<option value="${k}" ${k === a.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`}</td>
            <td>${fmtDate(a.createdAt)}</td>
            <td dir="ltr">${esc(a.addedByEmail ?? '—')}</td>
            <td>${self ? '' : '<button class="btn small danger" data-remove>הסרה</button>'}</td>
          </tr>`;
        })
        .join('')}</tbody>
    </table></div>
    <div id="admins-area" style="margin-top:12px"></div>
    <div class="card" style="margin-top:16px;max-width:640px">
      <h2>הוספת מנהל/ת</h2>
      <p class="sub">רק למי שכבר נרשם/ה לאפליקציה עם המייל הזה. "צפייה בלבד" רואה הכל ולא יכול/ה לשנות.</p>
      <form id="add-admin" class="row">
        <label>אימייל<input name="email" type="email" required dir="ltr"></label>
        <label style="flex:0 1 170px">הרשאה<select name="role"><option value="viewer">צפייה בלבד</option><option value="admin">מנהל/ת</option></select></label>
        <button class="btn primary" type="submit">הוספה</button>
      </form>
      <div id="add-admin-out" style="margin-top:10px"></div>
    </div>`;
  const area = $('#admins-area', el);
  $$('tr[data-id]', el).forEach((tr) => {
    const id = tr.dataset.id;
    const email = tr.cells[0].textContent.trim();
    const sel = $('[data-role]', tr);
    if (sel) sel.onchange = () => {
      const role = sel.value;
      confirmBox(area, {
        calm: true,
        needReason: false,
        text: `לשנות את ההרשאה של ${email} ל"${ADMIN_ROLE[role]}"?`,
        confirmLabel: 'שינוי הרשאה',
        run: () => api('set_admin_role', { userId: id, role }),
        done: () => renderAdmins(el),
      });
      $('[data-cancel]', area).addEventListener('click', () => renderAdmins(el));
    };
    const rm = $('[data-remove]', tr);
    if (rm) rm.onclick = () => confirmBox(area, {
      needReason: false,
      text: `להסיר את ההרשאה של ${email}? המשתמש באפליקציה לא נפגע.`,
      confirmLabel: 'הסרת הרשאה',
      run: () => api('remove_admin', { userId: id }),
      done: () => renderAdmins(el),
    });
  });
  $('#add-admin', el).onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const out = $('#add-admin-out', el);
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      await api('add_admin', { email: f.email.value.trim(), role: f.role.value });
      renderAdmins(el);
    } catch (e) {
      out.innerHTML = errorCard(e);
      btn.disabled = false;
    }
  };
}

// ---------- audit ----------

async function renderAudit(el) {
  el.innerHTML = `<div class="view-head"><h1>יומן פעולות</h1></div>${loading()}`;
  let r;
  try {
    r = await api('audit', { page: state.auditPage });
  } catch (e) {
    return (el.innerHTML = errorCard(e));
  }
  const detailText = (d) => {
    if (!d) return '';
    const parts = [];
    if (d.reason) parts.push(`סיבה: ${d.reason}`);
    if (d.email) parts.push(d.email);
    if (d.inviteCode) parts.push(`משפחה ${d.inviteCode}`);
    if (d.role) parts.push(ADMIN_ROLE[d.role] ?? d.role);
    if (d.from && d.to) parts.push(`${ADMIN_ROLE[d.from] ?? d.from} ← ${ADMIN_ROLE[d.to] ?? d.to}`);
    if (d.previousSource) parts.push(`היה: ${STATUS[d.previousSource] ?? d.previousSource}`);
    if (d.force) parts.push('בכפייה');
    if (d.familiesDeleted?.length) parts.push(`נמחקו ${d.familiesDeleted.length} משפחות`);
    if (Array.isArray(d.done)) parts.push(d.done.join(' · '));
    return parts.join(' · ');
  };
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  el.innerHTML = `
    <div class="view-head"><h1>יומן פעולות</h1></div>
    ${r.rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>מתי</th><th>מי</th><th>פעולה</th><th>יעד</th><th>פרטים</th></tr></thead>
      <tbody>${r.rows
        .map((a) => `<tr>
          <td>${fmtDateTime(a.at)}</td>
          <td dir="ltr">${esc(a.admin_email ?? '—')}</td>
          <td>${esc(ACTIONS[a.action] ?? a.action)}</td>
          <td class="mono" dir="ltr" style="font-size:12px">${esc(a.target ?? '')}</td>
          <td class="wrap">${esc(detailText(a.details))}</td>
        </tr>`)
        .join('')}</tbody>
    </table></div>
    <div class="pager">
      <button class="btn small" id="au-prev" ${r.page <= 1 ? 'disabled' : ''}>הקודם</button>
      <span>עמוד ${r.page} מתוך ${pages}</span>
      <button class="btn small" id="au-next" ${r.page >= pages ? 'disabled' : ''}>הבא</button>
    </div>` : '<div class="card empty">עוד אין פעולות ביומן</div>'}`;
  const prev = $('#au-prev', el), next = $('#au-next', el);
  if (prev) prev.onclick = () => { state.auditPage--; renderAudit(el); };
  if (next) next.onclick = () => { state.auditPage++; renderAudit(el); };
}

// ---------- start ----------

sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryMode = true;
    showScreen('auth');
    authMode('newpass');
  }
  if (event === 'SIGNED_OUT' && state.me) {
    state.me = state.role = null;
    showScreen('auth');
    authMode('password');
  }
});

async function start() {
  setupAuthForms();
  const { data } = await sb.auth.getSession();
  // Drop auth tokens from the address bar, keep tab hashes.
  if (/access_token|error_description|type=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  if (recoveryMode && data.session) {
    showScreen('auth');
    return authMode('newpass');
  }
  if (data.session) return enterApp();
  showScreen('auth');
  authMode('password');
  if (urlError) authMsg(urlError.includes('expired') ? 'הקישור פג תוקף. אפשר לבקש קישור חדש.' : urlError, 'error');
}

start();
