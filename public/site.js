/* PawHome: no menu links, only two buttons in the top bar */
window.pwChip = function (v) {
  $('sp').value = v; pwLoadPets();
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.v === v));
};
window.SITE_CFG = {
  show: 'pwShow', hero: '.pw-hero', home: 'home',
  pages: {
    home: `<div class="text-center py-5"><h1 class="display-4 fw-bold">Someone is waiting for a home like yours.</h1>
      <p class="lead mt-3 mx-auto" style="max-width:34rem">Meet pets from local shelters, send an adoption request, and let the shelter get back to you.</p>
      <div class="d-flex gap-3 justify-content-center flex-wrap mt-4"><button class="btn btn-pw btn-lg" onclick="pwShow('browse')">Meet the pets</button>
        <button class="btn btn-lg btn-ghost" onclick="pwOpenAuth('login')">Log in</button></div></div>`
  },
  nav() {
    return me
      ? `<div class="d-flex gap-2 align-items-center ms-auto"><span class="who d-none d-md-inline">Hi, ${esc(me.name)}</span>
         <button class="btn btn-pw" data-page="dash" onclick="pwShow('dash')">${me.role === 'shelter' ? 'My pets' : 'My requests'}</button>
         <div class="dropdown"><button class="btn-ghost dropdown-toggle" data-bs-toggle="dropdown">Account</button>
           <ul class="dropdown-menu dropdown-menu-end"><li><button class="dropdown-item" onclick="pwOpenAuth('login')">Switch account</button></li>
           <li><button class="dropdown-item" onclick="pwLogout()">Log out</button></li></ul></div></div>`
      : `<div class="d-flex gap-2 ms-auto"><button class="btn-ghost" onclick="pwOpenAuth('login')">Log in</button>
         <button class="btn btn-pw" onclick="pwOpenAuth('register')">Sign up</button></div>`;
  }
};

/* ---- page engine: extra pages, nav, back button (shared logic) ---- */
(function () {
  const C = window.SITE_CFG, orig = window[C.show], stack = [], PROTECTED = ['dash', 'upload', 'post', 'create'];
  let current = null;
  const main = document.querySelector('main');
  Object.entries(C.pages).forEach(([id, html]) => {
    const s = document.createElement('section');
    s.id = 'view-' + id; s.className = 'site-page d-none'; s.innerHTML = html;
    main.appendChild(s);
  });
  const bar = document.createElement('div');
  bar.id = 'backBar'; bar.className = 'd-none mb-3';
  bar.innerHTML = '<button class="back-btn" onclick="goBack()">&larr; Back</button>';
  $('alertBox').after(bar);
  const hero = document.querySelector(C.hero);
  function setActive(v) { document.querySelectorAll('[data-page]').forEach(e => e.classList.toggle('active', e.dataset.page === v)); }
  window[C.show] = function (v, fromBack) {
    const isPage = !!C.pages[v];
    if (!isPage && PROTECTED.includes(v) && !me) return orig(v);       // asks the user to log in
    if (!fromBack && current && current !== v) stack.push(current);
    current = v;
    document.querySelectorAll('.site-page').forEach(s => s.classList.toggle('d-none', s.id !== 'view-' + v));
    if (isPage) ['browse', 'dash', 'upload', 'post', 'create'].forEach(x => { const e = $('view-' + x); if (e) e.classList.add('d-none'); });
    else orig(v);
    if (hero) hero.classList.toggle('d-none', v !== 'browse');
    bar.classList.toggle('d-none', v === C.home || v === 'browse');
    setActive(v); window.scrollTo(0, 0);
  };
  window.goBack = function () { window[C.show](stack.pop() || C.home, true); };
  window.renderNav = function () { $('navRight').innerHTML = C.nav(); setActive(current); };
  window[C.show](C.home);
})();
