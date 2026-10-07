let me = null, authMode = 'login';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modal = id => bootstrap.Modal.getOrCreateInstance($(id));
const alertHtml = (m, t = 'danger') => `<div class="alert alert-${t} py-2">${esc(m)}</div>`;
const age = m => m < 12 ? `${m} month(s)` : `${Math.floor(m / 12)} year(s)${m % 12 ? ' ' + (m % 12) + ' month(s)' : ''}`;
function flash(m, t = 'success') { window.scrollTo({ top: 0, behavior: 'smooth' }); $('alertBox').innerHTML = alertHtml(m, t); setTimeout(() => $('alertBox').innerHTML = '', 3500); }

async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function renderNav() {
  $('navRight').innerHTML = me
    ? `<span class="text-white-50 d-none d-md-inline">Hi, ${esc(me.name)} (${me.role})</span>
       <button class="btn btn-sm btn-pw" onclick="pwShow('dash')">${me.role === 'shelter' ? 'My pets' : 'My requests'}</button>
       <button class="btn btn-sm btn-outline-light" onclick="pwLogout()">Log out</button>`
    : `<button class="btn btn-sm btn-outline-light" onclick="pwOpenAuth('login')">Log in</button>
       <button class="btn btn-sm btn-pw" onclick="pwOpenAuth('register')">Sign up</button>`;
}
function pwShow(v) {
  if (v === 'dash' && !me) return pwOpenAuth('login');
  $('view-browse').classList.toggle('d-none', v !== 'browse');
  $('view-dash').classList.toggle('d-none', v !== 'dash');
  if (v === 'browse') pwLoadPets();
  if (v === 'dash') pwLoadDash();
}

// ---------- Auth ----------
function pwOpenAuth(m) { authMode = m; pwApplyAuth(); $('authAlert').innerHTML = ''; modal('authModal').show(); }
function pwToggleAuth() { authMode = authMode === 'login' ? 'register' : 'login'; pwApplyAuth(); }
function pwApplyAuth() {
  const reg = authMode === 'register';
  $('regOnly').classList.toggle('d-none', !reg);
  $('authTitle').textContent = $('authBtn').textContent = reg ? 'Create account' : 'Log in';
  $('authSwitch').textContent = reg ? 'Already have an account? Log in' : 'New here? Create an account';
}
async function pwSubmitAuth() {
  try {
    const body = { email: $('a_email').value, password: $('a_pass').value };
    if (authMode === 'register') Object.assign(body, { name: $('a_name').value, phone: $('a_phone').value, role: $('a_role').value });
    me = await api('/api/' + authMode, 'POST', body);
    modal('authModal').hide(); renderNav(); pwShow('browse'); flash(`Welcome, ${me.name}!`);
  } catch (e) { $('authAlert').innerHTML = alertHtml(e.message); }
}
async function pwLogout() { await api('/api/logout', 'POST'); me = null; renderNav(); pwShow('browse'); }

// ---------- Browse ----------
async function pwLoadPets() {
  const list = await api(`/api/pets?q=${encodeURIComponent($('q').value)}&species=${encodeURIComponent($('sp').value)}`);
  $('petList').innerHTML = list.length ? list.map(p => `
    <div class="col-md-6"><div class="card pw-card h-100"><div class="card-body d-flex gap-3">
      <div class="pet-mark">${esc(p.name[0].toUpperCase())}</div>
      <div class="flex-grow-1 d-flex flex-column">
        <div class="d-flex justify-content-between"><h5 class="mb-1">${esc(p.name)}</h5><span class="badge badge-${p.status}">${p.status}</span></div>
        <div class="text-muted small mb-2">${esc(p.species)} - ${esc(p.breed)} - ${p.gender} - ${age(p.ageMonths)}</div>
        <p class="flex-grow-1 mb-2">${esc(p.description)}</p>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span class="small text-muted">${p.shelter ? esc(p.shelter.name) : ''}</span>
          ${me && me.role === 'adopter' && p.status === 'available' ? `<button class="btn btn-sm btn-pw" onclick="pwOpenRequest('${p._id}','${esc(p.name)}')">Adopt ${esc(p.name)}</button>` : ''}
        </div>
      </div></div></div></div>`).join('')
    : '<div class="col-12"><div class="alert alert-light border">No pets found. Try a different search.</div></div>';
}

// ---------- Adopter ----------
function pwOpenRequest(id, name) {
  $('r_pet').value = id; $('r_msg').value = ''; $('reqAlert').innerHTML = ''; $('r_title').textContent = 'Adopt ' + name;
  modal('reqModal').show();
}
async function pwSendRequest() {
  try {
    await api(`/api/pets/${$('r_pet').value}/request`, 'POST', { message: $('r_msg').value });
    modal('reqModal').hide(); flash('Request sent. Track it under My requests.');
  } catch (e) { $('reqAlert').innerHTML = alertHtml(e.message); }
}

// ---------- Shelter ----------
async function pwAddPet() {
  try {
    await api('/api/pets', 'POST', { name: $('p_name').value, species: $('p_sp').value, breed: $('p_breed').value, gender: $('p_gender').value,
      ageMonths: Number($('p_age').value), description: $('p_desc').value });
    pwLoadDash(); flash('Pet listed.');
  } catch (e) { $('petAlert').innerHTML = alertHtml(e.message); }
}
async function pwDelPet(id) {
  if (!confirm('Delete this pet and its requests?')) return;
  await api('/api/pets/' + id, 'DELETE'); pwLoadDash();
}
async function pwViewRequests(id) {
  const list = await api(`/api/pets/${id}/requests`);
  $('listBody').innerHTML = list.length ? list.map(r => `
    <div class="card pw-card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between"><strong>${esc(r.user.name)}</strong><span class="badge badge-${r.status}">${r.status}</span></div>
      <div class="text-muted small">${esc(r.user.email)} ${r.user.phone ? '- ' + esc(r.user.phone) : ''}</div>
      <p class="my-2">${esc(r.message)}</p>
      ${r.status === 'pending' ? `<button class="btn btn-sm btn-pw me-2" onclick="pwDecide('${r._id}','approve','${id}')">Approve</button>
        <button class="btn btn-sm btn-outline-danger" onclick="pwDecide('${r._id}','reject','${id}')">Reject</button>` : ''}
    </div></div>`).join('') : '<p class="mb-0">No requests yet.</p>';
  modal('listModal').show();
}
async function pwDecide(rid, action, petId) {
  try { await api(`/api/requests/${rid}/${action}`, 'POST'); await pwViewRequests(petId); pwLoadDash(); }
  catch (e) { flash(e.message, 'danger'); }
}

// ---------- Dashboard ----------
async function pwLoadDash() {
  const rows = await api('/api/dashboard');
  if (me.role === 'adopter') {
    $('view-dash').innerHTML = '<h4 class="mb-3">My requests</h4>' + (rows.length ? rows.map(r => `
      <div class="card pw-card mb-2"><div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><strong>${r.pet ? esc(r.pet.name) : 'Pet removed'}</strong>
          <div class="text-muted small">${r.pet && r.pet.shelter ? esc(r.pet.shelter.name) + (r.pet.shelter.phone ? ' - ' + esc(r.pet.shelter.phone) : '') : ''}</div></div>
        <span class="badge badge-${r.status}">${r.status}</span></div></div>`).join('')
      : '<div class="alert alert-light border">You have not sent any requests yet. Browse pets and adopt one.</div>');
    return;
  }
  $('view-dash').innerHTML = `<h4 class="mb-3">My pets</h4>
    <div class="card pw-card mb-4"><div class="card-body"><h5>List a pet</h5><div id="petAlert"></div>
      <div class="row g-2">
        <div class="col-md-3"><input id="p_name" class="form-control" placeholder="Name"></div>
        <div class="col-md-3"><select id="p_sp" class="form-select"><option>Dog</option><option>Cat</option><option>Rabbit</option><option>Other</option></select></div>
        <div class="col-md-3"><input id="p_breed" class="form-control" placeholder="Breed"></div>
        <div class="col-md-3"><select id="p_gender" class="form-select"><option>Male</option><option>Female</option></select></div>
        <div class="col-md-3"><input id="p_age" type="number" min="0" class="form-control" placeholder="Age in months"></div>
        <div class="col-md-6"><input id="p_desc" class="form-control" placeholder="Nature, health, vaccination"></div>
        <div class="col-md-3 d-grid"><button class="btn btn-pw" onclick="pwAddPet()">List pet</button></div>
      </div></div></div>` + (rows.length ? rows.map(p => `
    <div class="card pw-card mb-2"><div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div><strong>${esc(p.name)}</strong> <span class="badge badge-${p.status}">${p.status}</span>
        <div class="text-muted small">${esc(p.species)} - ${esc(p.breed)} - ${p.pending} pending request(s)</div></div>
      <div class="d-flex gap-2"><button class="btn btn-sm btn-pw" onclick="pwViewRequests('${p._id}')">View requests</button>
        <button class="btn btn-sm btn-outline-danger" onclick="pwDelPet('${p._id}')">Delete</button></div>
    </div></div>`).join('') : '<div class="alert alert-light border">You have not listed any pets yet.</div>');
}

(async () => { me = await api('/api/me'); renderNav(); pwLoadPets(); })();
