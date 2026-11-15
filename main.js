/* Xinyue Wu · personal site
   1. Dealer simulation (hero panel)
   2. Navigation state, reveals, copy-to-clipboard                      */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  /* ───────────── 1. Dealer simulation ─────────────
     A dealer quotes around a reservation price r = s − κq, where s is the mid,
     q the dealer's inventory and κ stands in for γσ²(T − t). Customer orders
     arrive with intensity A·exp(−k·δ), δ being the distance from the mid to the
     quote, so a skewed quote attracts the flow that flattens the inventory.   */

  const canvas = $('chart');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');

    const P = { sigma: 0.0055, half: 0.05, skew: 0.012, A: 0.26, k: 20, qmax: 10, anchor: 0.003 };
    const N = 130;                         // ticks visible
    const DT = reduceMotion ? 900 : 380;   // ms per tick
    const C = {
      bid: '#7C95FF', ask: '#FF7D61', mid: 'rgba(233,237,244,.62)',
      grid: 'rgba(233,237,244,.07)', label: '#8E98AB', ink: '#E9EDF4', panel: '#0C1322',
    };

    let s = 100, q = 0, cash = 0;
    const you = { q: 0, cash: 0, trades: 0 };
    const hist = [];
    let lastTick = performance.now();
    let yLo = 99.8, yHi = 100.2;
    let W = 0, H = 0, dpr = 1;
    let visible = true, ranged = false;

    const el = {
      mid: $('d-mid'), bid: $('d-bid'), ask: $('d-ask'), spread: $('d-spread'),
      inv: $('d-inv'), pnl: $('d-pnl'), you: $('d-you'), fill: $('g-fill'),
      hit: $('hit'), lift: $('lift'),
    };

    const gauss = () => {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const r2 = (x) => Math.round(x * 100) / 100;
    const quotes = () => {
      const r = s - P.skew * q;
      return { b: r2(r - P.half), a: r2(r + P.half) };
    };
    const signed = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);

    function record(fills) {
      const { b, a } = quotes();
      hist.push({ s, b, a, fills: fills || [] });
      if (hist.length > N + 3) hist.shift();
    }

    function step() {
      s += P.sigma * gauss() + P.anchor * (100 - s);
      const { b, a } = quotes();
      const fills = [];
      if (q > -P.qmax && Math.random() < Math.min(.85, P.A * Math.exp(-P.k * (a - s)))) {
        q -= 1; cash += a; fills.push({ side: 'a', px: a, me: false });
      }
      if (q < P.qmax && Math.random() < Math.min(.85, P.A * Math.exp(-P.k * (s - b)))) {
        q += 1; cash -= b; fills.push({ side: 'b', px: b, me: false });
      }
      record(fills);
    }

    // Visitor trades: 'b' = sell to the dealer at its bid, 'a' = buy at its ask.
    function trade(side) {
      const { b, a } = quotes();
      if (side === 'b') {
        if (q >= P.qmax) return;
        q += 1; cash -= b; you.q -= 1; you.cash += b;
      } else {
        if (q <= -P.qmax) return;
        q -= 1; cash += a; you.q += 1; you.cash -= a;
      }
      you.trades += 1;
      record([{ side, px: side === 'b' ? b : a, me: true }]);
      lastTick = performance.now();
      const btn = side === 'b' ? el.hit : el.lift;
      btn.classList.remove('flash');
      void btn.offsetWidth;
      btn.classList.add('flash');
      paintReadout();
    }

    function paintReadout() {
      const { b, a } = quotes();
      el.mid.textContent = s.toFixed(2);
      el.bid.textContent = b.toFixed(2);
      el.ask.textContent = a.toFixed(2);
      el.spread.textContent = (a - b).toFixed(2);

      el.inv.textContent = q === 0 ? 'flat' : (q > 0 ? 'long ' : 'short ') + Math.abs(q);
      const frac = Math.min(1, Math.abs(q) / P.qmax) * 50;
      el.fill.style.width = frac + '%';
      el.fill.style.left = (q >= 0 ? 50 : 50 - frac) + '%';
      el.fill.style.backgroundColor = q >= 0 ? C.bid : C.ask;

      const pnl = cash + q * s;
      el.pnl.textContent = signed(pnl);
      el.pnl.className = pnl >= 0 ? 'pos' : 'neg';

      if (!you.trades) {
        el.you.textContent = 'no trades yet';
        el.you.className = '';
      } else {
        const yp = you.cash + you.q * s;
        const pos = you.q === 0 ? 'flat' : (you.q > 0 ? 'long ' : 'short ') + Math.abs(you.q);
        el.you.textContent = pos + ' · ' + signed(yp);
        el.you.className = yp >= 0 ? 'pos' : 'neg';
      }
      el.hit.disabled = q >= P.qmax;
      el.lift.disabled = q <= -P.qmax;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (hist.length) draw(performance.now());   // resizing clears the bitmap
    }

    function niceStep(range) {
      const target = range / 4;
      const steps = [0.02, 0.05, 0.1, 0.2, 0.5, 1];
      for (const st of steps) if (st >= target) return st;
      return 1;
    }

    function draw(now) {
      if (!W || !H) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const padR = 58, padT = 14, padB = 14;
      const plotW = W - padR, plotH = H - padT - padB;
      const frac = reduceMotion ? 1 : Math.min(1, (now - lastTick) / DT);
      const n = hist.length;
      const dx = plotW / (N - 1);
      // The newest point eases in from the right edge as the window scrolls.
      const xAt = (i) => plotW - (n - 1 - i) * dx + (1 - frac) * dx;

      // Vertical range: ease toward the visible extremes.
      let lo = Infinity, hi = -Infinity;
      for (let i = Math.max(0, n - N - 1); i < n; i++) {
        const h = hist[i];
        if (h.b < lo) lo = h.b;
        if (h.a > hi) hi = h.a;
      }
      const pad = Math.max(0.04, (hi - lo) * 0.14);
      lo -= pad; hi += pad;
      if (!ranged) { yLo = lo; yHi = hi; ranged = true; }
      yLo += (lo - yLo) * 0.06; yHi += (hi - yHi) * 0.06;
      const yAt = (p) => padT + (yHi - p) / (yHi - yLo) * plotH;

      // Grid and price labels.
      const st = niceStep(yHi - yLo);
      ctx.font = '500 10.5px "Geist Mono", ui-monospace, Menlo, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.lineWidth = 1;
      const tip = hist[n - 1];
      const yTipA = yAt(tip.a), yTipB = yAt(tip.b);
      for (let p = Math.ceil(yLo / st) * st; p < yHi; p += st) {
        const y = Math.round(yAt(p)) + .5;
        ctx.strokeStyle = C.grid;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
        if (y > yTipA - 20 && y < yTipB + 20) continue;
        ctx.fillStyle = 'rgba(142,152,171,.55)';
        ctx.fillText(p.toFixed(2), plotW + 10, y);
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, plotW, H); ctx.clip();

      const first = Math.max(0, n - N - 2);

      // Band between the quotes.
      ctx.beginPath();
      for (let i = first; i < n; i++) {
        const x = xAt(i), y = yAt(hist[i].a);
        if (i === first) ctx.moveTo(x, y);
        else { ctx.lineTo(x, yAt(hist[i - 1].a)); ctx.lineTo(x, y); }
      }
      for (let i = n - 1; i >= first; i--) {
        const x = xAt(i), y = yAt(hist[i].b);
        ctx.lineTo(x, y);
        if (i > first) ctx.lineTo(x, yAt(hist[i - 1].b));
      }
      ctx.closePath();
      const band = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      band.addColorStop(0, 'rgba(255,125,97,.10)');
      band.addColorStop(1, 'rgba(124,149,255,.10)');
      ctx.fillStyle = band;
      ctx.fill();

      // Quote step lines.
      const stepLine = (key, color) => {
        ctx.beginPath();
        for (let i = first; i < n; i++) {
          const x = xAt(i), y = yAt(hist[i][key]);
          if (i === first) ctx.moveTo(x, y);
          else { ctx.lineTo(x, yAt(hist[i - 1][key])); ctx.lineTo(x, y); }
        }
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
        ctx.stroke();
      };
      stepLine('a', C.ask);
      stepLine('b', C.bid);

      // Mid.
      ctx.beginPath();
      for (let i = first; i < n; i++) {
        const x = xAt(i), y = yAt(hist[i].s);
        if (i === first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.mid; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.stroke(); ctx.setLineDash([]);

      // Fills.
      for (let i = first; i < n; i++) {
        const h = hist[i];
        for (const f of h.fills) {
          const x = xAt(i), y = yAt(f.px);
          const color = f.side === 'a' ? C.ask : C.bid;
          if (f.me) {
            ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832);
            ctx.fillStyle = f.side === 'a' ? 'rgba(255,125,97,.22)' : 'rgba(124,149,255,.22)';
            ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.2832);
            ctx.fillStyle = C.ink; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
          } else {
            ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.2832);
            ctx.fillStyle = C.panel; ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
          }
        }
      }
      ctx.restore();

      // Live quote chips in the gutter.
      const last = hist[n - 1];
      const ya = yAt(last.a), yb = yAt(last.b);
      // Keep the two chips from overlapping when the spread is visually small.
      const gap = 18 - (yb - ya);
      const off = gap > 0 ? gap / 2 : 0;
      const chipAt = (p, shift, color, textColor) => {
        const y = yAt(p) + shift, w = 46, h = 17, x = plotW + 5;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y - h / 2, w, h, 4); else ctx.rect(x, y - h / 2, w, h);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(p.toFixed(2), x + 6, y + .5);
      };
      chipAt(last.a, -off, C.ask, '#1B0D09');
      chipAt(last.b, off, C.bid, '#080D22');
    }

    function loop(now) {
      if (visible && !document.hidden) {
        let guard = 0;
        while (now - lastTick >= DT && guard++ < 4) { step(); lastTick += DT; }
        if (now - lastTick >= DT) lastTick = now;
        if (guard) paintReadout();
        draw(now);
      } else {
        lastTick = now;
      }
      requestAnimationFrame(loop);
    }

    // Warm up so the chart is already populated on first paint, then zero the book.
    for (let i = 0; i < N + 40; i++) step();
    cash = -q * s;

    el.hit.addEventListener('click', () => trade('b'));
    el.lift.addEventListener('click', () => trade('a'));

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    resize();
    paintReadout();
    lastTick = performance.now();
    requestAnimationFrame(loop);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(performance.now()));
  }

  /* ───────────── 2. Page behaviour ───────────── */

  const top = document.querySelector('.top');
  const name = document.querySelector('.name');

  if (top && name && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      top.classList.toggle('past-name', !es[0].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(name);

    const onScroll = () => top.classList.toggle('is-stuck', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else if (top) {
    top.classList.add('past-name');
  }

  // Current section in the nav.
  const links = [...document.querySelectorAll('.sections a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        let id = e.target.id;
        // "About" has no pill on small screens; keep Projects lit instead.
        links.forEach((a) => a.removeAttribute('aria-current'));
        const a = byId.get(id);
        if (a) a.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach((sec) => io.observe(sec));

    const hero = document.querySelector('.hero');
    if (hero) new IntersectionObserver((es) => {
      if (es[0].isIntersecting) links.forEach((a) => a.removeAttribute('aria-current'));
    }, { rootMargin: '-40% 0px -55% 0px' }).observe(hero);
  }

  // Reveal on scroll.
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const ro = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach((n) => ro.observe(n));
  } else {
    reveals.forEach((n) => n.classList.add('in'));
  }

  // Copy email.
  const copy = $('copy');
  if (copy) copy.addEventListener('click', async () => {
    const text = copy.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (__) {}
      ta.remove();
    }
    copy.textContent = 'Copied';
    copy.classList.add('done');
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1600);
  });
})();
