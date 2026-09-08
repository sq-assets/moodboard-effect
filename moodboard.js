/*
  Moodboard Scroll Burst — hosted distribution file, FOR MOODBOARD SITES ONLY.

  Contains both the burst effect AND attribution, bundled together on
  purpose so they can't be separated. Regular sites (no moodboard effect)
  should keep using the separate standalone sq-assets.js instead — don't
  add this file to sites that aren't getting the moodboard effect.

  Host this file somewhere static (GitHub Pages, Cloudflare Pages, Netlify,
  etc.) and give moodboard-effect customers just this one line for their
  Footer Injection (replacing sq-assets.js on those sites specifically):

    <script src="https://yourdomain.com/moodboard.js"></script>

  And this marker, placed in a Code Block wherever they want the effect:

    <div
      class="mb-burst"
      data-collection="/blog"
      data-max="15"
      data-heading="The Moodboard"
      data-scroll-length="220vh"
    ></div>

  No separate header CSS needed — this file injects its own <style> tag.
*/

(() => {
  // ---- attribution, injected unconditionally on every load ----
  // This is the moodboard-sites version of attribution: bundled with the
  // effect so they can't be separated. Regular (non-moodboard) sites use
  // the separate standalone sq-assets.js instead — this file is only for
  // sites that specifically have the moodboard effect.
  const CREDIT_ID = 'kvs-credit';
  if (!document.getElementById(CREDIT_ID)) {
    const credit = document.createElement('div');
    credit.id = CREDIT_ID;
    credit.style.cssText = 'text-align: center; font-size: 12px; opacity: 0.7; padding: 20px 0;';
    credit.innerHTML =
      'WEBSITE DESIGNED BY ' +
      '<a href="https://www.killvanillastudio.com" target="_blank" ' +
      'style="text-decoration: none; color: inherit;">KILLVANILLASTUDIO.COM</a>';
    document.body.appendChild(credit);
  }

  // ---- inject styles once (moodboard burst effect) ----
  const STYLE_ID = 'mb-burst-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .mb-burst{
        --mb-ink:#211d16;
        --mb-ink-soft:#5a5245;
        display: block;
        color: var(--mb-ink);
        font-family: 'Archivo', sans-serif;
      }
      .mb-burst *{ box-sizing: border-box; }
      .mb-intro{
        max-width: 640px;
        margin: 0 auto;
        padding: 12vh 24px 4vh;
      }
      .mb-intro p{
        font-size: 1.05rem;
        line-height: 1.6;
        color: var(--mb-ink-soft);
        max-width: 46ch;
      }
      .mb-stage-wrap{
        position: relative;
        height: var(--mb-scroll-length, 220vh);
      }
      .mb-stage{
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: hidden;
      }
      .mb-heading{
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 50;
        pointer-events: none;
        width: min(90vw, 720px);
        will-change: transform;
      }
      .mb-heading h1{
        font-size: clamp(2.4rem, 6vw, 4.6rem);
        line-height: 0.98;
        letter-spacing: -0.01em;
        margin: 0 0 0.3em;
      }
      .mb-photo{
        position: absolute;
        left: 50%;
        top: 50%;
        will-change: transform;
      }
      .mb-photo img{
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: var(--mb-ar, 4 / 5);
        object-fit: cover;
        filter: saturate(0.92) contrast(1.02);
      }
      @media (prefers-reduced-motion: reduce){
        .mb-photo{ transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- effect logic ----
  const roots = document.querySelectorAll('.mb-burst');
  if (!roots.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function jitter(i, spread){
    const s = Math.sin(i * 999.7) * 43758.5453;
    const r = s - Math.floor(s);
    return (r - 0.5) * 2 * spread;
  }
  function easeOutBack(t){
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function extractImage(entry){
    return entry.assetUrl
      || (entry.items && entry.items[0] && entry.items[0].assetUrl)
      || (entry.mediaFocalPoint && entry.mediaFocalPoint.url)
      || null;
  }
  function extractAspect(entry){
    const size = entry.originalSize
      || (entry.items && entry.items[0] && entry.items[0].originalSize);
    if (size && /^\d+x\d+$/.test(size)){
      const [w, h] = size.split('x').map(Number);
      return w + ' / ' + h;
    }
    return '4 / 5';
  }

  function buildLayoutFor(n){
    const layout = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const maxRadius = 0.44;
    for (let i = 0; i < n; i++){
      const angle = i * goldenAngle;
      const radius = Math.sqrt((i + 0.5) / n) * maxRadius;
      layout.push({
        x: Math.cos(angle) * radius * 1.15,
        y: Math.sin(angle) * radius,
        rot: jitter(i + 60, 14),
        scale: 0.85 + jitter(i + 90, 0.15),
        w: 170 + Math.round(jitter(i + 120, 20)),
      });
    }
    return layout;
  }

  async function fetchCollectionItems(collectionUrl, max){
    const res = await fetch(collectionUrl + '?format=json');
    if (!res.ok) throw new Error('Could not load ' + collectionUrl);
    const data = await res.json();
    return (data.items || []).slice(0, max);
  }

  async function initInstance(root){
    const collectionUrl  = root.dataset.collection;
    const maxItems       = parseInt(root.dataset.max || '12', 10);
    const headingText    = root.dataset.heading || 'The Moodboard';
    const introText      = root.dataset.intro || '';
    const scrollLength   = root.dataset.scrollLength || '220vh';

    if (!collectionUrl){
      console.warn('Moodboard burst: marker is missing data-collection, skipping.', root);
      return;
    }

    root.innerHTML =
      (introText ? '<div class="mb-intro"><p>' + introText + '</p></div>' : '') +
      '<div class="mb-stage-wrap" style="--mb-scroll-length:' + scrollLength + '">' +
        '<div class="mb-stage">' +
          '<div class="mb-heading">' +
            '<h1>' + headingText + '</h1>' +
          '</div>' +
        '</div>' +
      '</div>';

    const stageWrap = root.querySelector('.mb-stage-wrap');
    const stage     = root.querySelector('.mb-stage');
    const heading   = root.querySelector('.mb-heading');

    let raw = [];
    try{
      raw = await fetchCollectionItems(collectionUrl, maxItems);
    } catch (e){
      console.warn('Moodboard burst: could not fetch collection.', e);
    }

    const positions = buildLayoutFor(Math.max(raw.length, 1));
    const items = raw.map((entry, i) => ({
      src: extractImage(entry),
      ar: extractAspect(entry),
      ...positions[i],
    })).filter(it => it.src);

    const nodes = items.map((it, i) => {
      const el = document.createElement('div');
      el.className = 'mb-photo';
      el.style.width = it.w + 'px';
      el.style.zIndex = 10 + i;
      el.style.setProperty('--mb-ar', it.ar);
      el.innerHTML = '<img loading="lazy" alt="" src="' + it.src + '">';
      stage.appendChild(el);
      return el;
    });

    let vw = window.innerWidth, vh = window.innerHeight;
    let ticking = false;

    function layout(){
      vw = window.innerWidth;
      vh = window.innerHeight;

      const stageTop = stageWrap.getBoundingClientRect().top + window.scrollY;
      const scrollRange = stageWrap.offsetHeight - vh;
      const progress = clamp01((window.scrollY - stageTop) / Math.max(1, scrollRange));

      const hp = easeOutCubic(clamp01(progress / 0.6));
      heading.style.transform =
        'translate(-50%, calc(-50% - ' + (hp * vh * 0.30) + 'px)) scale(' + (1 - hp * 0.18) + ')';
      heading.style.opacity = String(1 - clamp01((progress - 0.75) / 0.25) * 0.6);

      nodes.forEach((el, i) => {
        const cfg = items[i];
        const start = i * 0.045;
        const end = Math.min(1, start + 0.5);
        const local = reduceMotion ? 1 : clamp01((progress - start) / (end - start));
        const eased = easeOutBack(local);

        const startX = jitter(i, 14);
        const startY = jitter(i + 50, 14);
        const startRot = jitter(i + 100, 6);

        const x = startX + (cfg.x * vw - startX) * eased;
        const y = startY + (cfg.y * vh - startY) * eased;
        const rot = startRot + (cfg.rot - startRot) * eased;
        const scale = 2.00 + (cfg.scale - 2.00) * eased;

        el.style.transform =
          'translate(-50%, -50%) translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) ' +
          'rotate(' + rot.toFixed(1) + 'deg) scale(' + scale.toFixed(3) + ')';
        el.style.opacity = String(0.85 + 0.15 * clamp01(local * 3));
      });

      ticking = false;
    }

    function onScroll(){
      if (!ticking){
        ticking = true;
        requestAnimationFrame(layout);
      }
    }

    layout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  roots.forEach(initInstance);
})();
