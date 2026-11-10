// Site motion, in the spirit of dennissnellenberg.com (css/site-motion.css says what moves): the home page
// and the case pages. Runs only on a screen without reduced motion and without data-motion="off"; an element
// is marked only when it is about to animate, so without this file, or if it fails, the page stands as written.
(function () {
  const html = document.documentElement;
  if (html.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    html.classList.add('hm-enter-done');
    return;
  }
  html.classList.add('hm-on');

  const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  const below = el => el.getBoundingClientRect().top > innerHeight * 0.92;   // only what has not been seen yet
  const isCase = document.body.classList.contains('page');

  // ---------------------------------------------------------------- reveals, once
  // an element shows once its top is in the lower tenth of the screen or above it, so a jump past it
  // (a menu link, a fast scroll) never leaves it hidden. What shows in the same frame steps in 70ms apart.
  const pending = new Set();
  const reveal = (el, i) => {
    pending.delete(el);
    el.style.setProperty('--hm-i', Math.min(i, 7));
    el.classList.add('hm-in');
    el.__hmDone?.();
  };
  let checking = false;
  const check = () => {
    checking = false;
    let i = 0;
    pending.forEach(el => { if (el.getBoundingClientRect().top < innerHeight * 0.9) reveal(el, i++); });
  };
  const askCheck = () => { if (!checking && pending.size) { checking = true; requestAnimationFrame(check); } };
  addEventListener('scroll', askCheck, { passive: true });
  addEventListener('resize', askCheck);
  const watch = el => { pending.add(el); askCheck(); };

  // a heading: its words in masks, grouped by the line the browser set them on (a <br> is kept);
  // its own markup back once it has risen. Headings with other markup inside fade up instead.
  function maskHeading(h, now) {
    if (h.__hm || (!now && !below(h))) return;
    if ([...h.children].some(c => c.tagName !== 'BR')) return fadeUp([h], now);
    h.__hm = true;
    const saved = h.innerHTML, label = h.textContent.replace(/\s+/g, ' ').trim();
    const esc = w => w.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    h.innerHTML = [...h.childNodes].map(n => n.nodeType === 3
      ? n.textContent.split(/ +/).filter(Boolean).map(w => `<span class="hm-w" aria-hidden="true"><span class="hm-w__in">${esc(w)}</span></span>`).join(' ')
      : '<br>').join(' ');
    h.setAttribute('aria-label', label);
    let line = -1, top = null;
    h.querySelectorAll('.hm-w').forEach(w => {
      if (w.offsetTop !== top) { top = w.offsetTop; line++; }
      w.firstChild.style.setProperty('--hm-line', line);
    });
    h.classList.add('hm-head');
    h.__hmDone = () => setTimeout(() => { h.innerHTML = saved; h.removeAttribute('aria-label'); }, 900 + line * 90 + 150);
    // on load: once the masked words have been drawn below their line, they rise
    now ? requestAnimationFrame(() => requestAnimationFrame(() => reveal(h, 0))) : watch(h);
  }

  function fadeUp(els, now) {
    els.forEach(el => {
      if (el.__hm || (!now && !below(el))) return;
      el.__hm = true;
      el.classList.add('hm-up');
      if (!now) watch(el);
    });
  }

  function pic(f) {
    if (f.__hm || !below(f)) return;
    f.__hm = true;
    f.classList.add('hm-pic');
    watch(f);
  }

  // ---------------------------------------------------------------- the home page
  function homeReveals() {
    document.querySelectorAll('main > section:not(.hero):not([data-moment])').forEach(sec => {
      sec.querySelectorAll('.section-head h2').forEach(h => maskHeading(h));
      sec.querySelectorAll(':is(.rows, .names)').forEach(list => fadeUp([...list.children]));
      fadeUp([...sec.querySelectorAll('.section-head > p, #engagement .group .grid > *, figure.quote')]);
      sec.querySelectorAll('.frame--photo').forEach(pic);
    });
  }

  // ---------------------------------------------------------------- a case page
  // on load: the title rises line by line, then what follows it in the head, and the first picture settles
  function caseEntrance() {
    const head = document.querySelector('main .page-head');
    if (!head) return;
    const h1 = head.querySelector('h1');
    if (h1) maskHeading(h1, true);
    const rest = [...head.children].filter(c => c !== h1);
    fadeUp(rest, true);
    requestAnimationFrame(() => requestAnimationFrame(() => rest.forEach((el, i) => { el.style.setProperty('--hm-i', i + 3); el.classList.add('hm-in'); })));
    const first = document.querySelector('main .figure');
    if (first && !below(first)) {
      first.__hm = true;
      first.classList.add('hm-pic', 'hm-pic--settle');
      requestAnimationFrame(() => requestAnimationFrame(() => first.classList.add('hm-in')));
    }
  }

  function caseReveals() {
    const main = document.querySelector('main');
    if (!main) return;
    main.querySelectorAll('h2:not(.subtitle, .page-head *)').forEach(h => maskHeading(h));
    main.querySelectorAll('.figure').forEach(pic);
    // the article's words: each paragraph and each point of a list on its own
    main.querySelectorAll('.article > :not(h2, figure, ul, ol), .article > :is(ul, ol) > li').forEach(el => fadeUp([el]));
    // what sits beside the article: the quote, the skills, the project, the way back
    main.querySelectorAll(':scope > :not(.page-head, .article, figure, h2)').forEach(el => {
      const kids = el.matches('.skills') ? [...el.children] : [el];
      fadeUp(kids);
    });
  }

  function closing() {
    const close = document.querySelector('footer.closing');
    if (!close) return;
    close.querySelectorAll('.section-head h2').forEach(h => maskHeading(h));
    fadeUp([...close.querySelectorAll('.section-head > p')]);
  }

  // ---------------------------------------------------------------- the drift inside a frame (home)
  function drift() {
    const frames = [...document.querySelectorAll('#clients .frame--photo, #methode .frame--photo, #engagement .frame--stage')]
      .filter(f => f.querySelector(':scope > .frame__img'));
    if (!frames.length) return;
    frames.forEach(f => f.classList.add('hm-par'));
    const seen = new Set();
    let ticking = false;
    const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    const update = () => {
      ticking = false;
      if (innerWidth < 640) { frames.forEach(f => f.querySelector('.frame__img').style.removeProperty('--hm-y')); return; }
      seen.forEach(f => {
        const r = f.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2 + r.height / 2)));
        f.querySelector('.frame__img').style.setProperty('--hm-y', (p * r.height * 0.045).toFixed(1) + 'px');
      });
    };
    const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); ask(); });
    frames.forEach(f => io.observe(f));
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    ask();
  }

  // ---------------------------------------------------------------- the work list's picture wipes up (home)
  // system.js swaps the picture at once (hidden on the others); here the old one stays under the new one
  // while it uncovers, then hides again.
  function peekWipe() {
    document.querySelectorAll('[data-peek]').forEach(root => {
      const pics = [...root.querySelectorAll('[data-peek-for]')];
      let cur = pics.find(p => !p.hidden), under = null, timer = 0;
      const settle = () => {
        if (under && under !== cur) under.hidden = true;
        pics.forEach(p => p.classList.remove('hm-under', 'hm-over'));
        under = null;
      };
      new MutationObserver(() => {
        const next = pics.find(p => !p.hidden && p !== cur && p !== under);
        if (!next) return;
        const prev = cur;
        cur = next;
        if (!fine() || innerWidth < 1024 || !prev) return;
        clearTimeout(timer);
        pics.forEach(p => { p.classList.remove('hm-under', 'hm-over'); if (p !== prev && p !== next) p.hidden = true; });
        under = prev;
        prev.hidden = false;
        prev.classList.add('hm-under');
        void next.offsetWidth;   // restart the wipe
        next.classList.add('hm-over');
        timer = setTimeout(settle, 700);
      }).observe(root, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    });
  }

  // ---------------------------------------------------------------- the main buttons lean toward the pointer
  function magnetic() {
    const btns = [...document.querySelectorAll('.hero .btn--primary, .nav__actions .btn--primary, main .back a')];
    if (!btns.length) return;
    btns.forEach(b => b.classList.add('hm-mag'));
    let x = -1e4, y = -1e4, ticking = false;
    const reach = 48, clamp = (v, m) => Math.max(-m, Math.min(m, v));
    const update = () => {
      ticking = false;
      btns.forEach(b => {
        const r = b.getBoundingClientRect();
        const near = x > r.left - reach && x < r.right + reach && y > r.top - reach && y < r.bottom + reach;
        b.classList.toggle('hm-mag--on', near);
        b.style.setProperty('--hm-mx', near ? clamp((x - (r.left + r.width / 2)) * 0.18, 8).toFixed(1) + 'px' : '0px');
        b.style.setProperty('--hm-my', near ? clamp((y - (r.top + r.height / 2)) * 0.3, 6).toFixed(1) + 'px' : '0px');
      });
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !fine()) return;
      x = e.clientX; y = e.clientY;
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { x = y = -1e4; requestAnimationFrame(update); });
  }

  const run = list => list.forEach(f => { try { f(); } catch (e) { console.warn('site-motion.js:', f.name, e); } });
  // the headings are measured in their own font, or after 600ms at most; the case page's title waits
  // hidden (css: html.hm-enter) for at most 700ms in all, then shows as written
  const ready = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]) : Promise.resolve();
  const start = () => {
    if (isCase && !html.classList.contains('hm-enter-done') && scrollY < 50) run([caseEntrance]);
    html.classList.add('hm-enter-done');
    run(isCase ? [caseReveals, closing, magnetic] : [homeReveals, closing, drift, peekWipe, magnetic]);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ready.then(start));
  else ready.then(start);
})();
