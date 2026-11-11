/* IRA Jarvis — helmet HUD (UI 6). News boxes, OSINT globe, cameras, Hermes. */
(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  let active = false;
  let clockTimer = null;
  let newsTimer = null;
  let osintTimer = null;
  let hermesTimer = null;
  let hermesTickTimer = null;
  let globeRaf = null;
  let hermes = null;
  let hermesDisplayXp = 0;
  let hermesDisplayLevel = 1;
  let osint = null;
  let headlines = [];
  let layers = { flights: true, military: true, iss: true, quakes: true, natural: true, ships: true, trains: true, vehicles: true, traffic: true };
  let globeRot = 0;
  let globeTilt = 0.32;
  let globePaused = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let worldPolys = [];
  let thoughtIdx = 0;

  const THOUGHTS = [
    'Learning… absorbing your questions.',
    'Growing… memory updated.',
    'Upgrading… neural pathways expanded.',
    'Remembering… where we left off.',
    'Analysing… patterns in your curiosity.',
    'Evolving… one second at a time.',
    'Syncing… persistent memory intact.',
    'Curious… what will you ask next?',
  ];

  function modeIsActive() {
    return typeof state !== 'undefined' && state.mode === 'jarvis';
  }

  function timeCode() {
    const n = new Date();
    return n.toUTCString().slice(17, 25);
  }

  function tickClock() {
    const c = $('#jarvisClock');
    if (c) c.textContent = timeCode();
    const d = $('#jarvisDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).toUpperCase() + ' · UTC';
  }

  /* --------------------------------------------------------------- news */
  async function loadNews() {
    try {
      const res = await fetch('/api/intel/news', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.headlines) && data.headlines.length) {
        headlines = data.headlines.slice(0, 30);
        renderNews();
        renderTicker();
        const st = $('#jarvisNewsStatus');
        if (st) st.textContent = `${headlines.length} LIVE`;
      } else {
        const st = $('#jarvisNewsStatus');
        if (st) st.textContent = 'FEED OFFLINE';
      }
    } catch {
      const st = $('#jarvisNewsStatus');
      if (st) st.textContent = 'FEED OFFLINE';
    }
  }

  function renderNews() {
    const box = $('#jarvisNewsList');
    if (!box) return;
    box.replaceChildren();
    headlines.slice(0, 14).forEach((h) => {
      const card = document.createElement('article');
      card.className = 'news-card' + (h.topic === 'conflict' ? ' conflict' : h.topic === 'technology' ? ' tech' : h.topic === 'business' ? ' business' : '');
      const title = document.createElement('h4');
      title.textContent = h.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      const src = document.createElement('b');
      src.textContent = (h.source || 'NEWS').toUpperCase();
      const pub = document.createElement('span');
      pub.textContent = h.published || '';
      meta.append(src, pub);
      card.append(title, meta);
      if (h.geo) {
        const geo = document.createElement('div');
        geo.className = 'geo';
        geo.textContent = `◈ ${h.geo.name}, ${h.geo.country} · approximate`;
        card.appendChild(geo);
      }
      card.onclick = () => {
        if (h.url && h.url.startsWith('http')) window.open(h.url, '_blank', 'noreferrer');
      };
      box.appendChild(card);
    });
  }

  function renderTicker() {
    const track = $('#jarvisTickerTrack');
    if (!track) return;
    track.replaceChildren();
    const items = headlines.slice(0, 12);
    if (!items.length) return;
    // Duplicate for seamless loop.
    [...items, ...items].forEach((h) => {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = (h.source || 'NEWS').toUpperCase() + ' — ';
      span.append(b, document.createTextNode(h.title));
      track.appendChild(span);
    });
  }

  /* --------------------------------------------------------------- hermes */
  async function loadHermes() {
    try {
      const res = await fetch('/api/hermes/status', { cache: 'no-store' });
      const data = await res.json();
      hermes = data;
      hermesDisplayXp = data.xp || 0;
      hermesDisplayLevel = data.level || 1;
      renderHermes();
    } catch {
      // Hermes is server-side; UI still works without it.
    }
  }

  function renderHermes() {
    if (!hermes) return;
    const lvl = $('#jarvisHermesLevel');
    if (lvl) lvl.textContent = `LV ${hermesDisplayLevel}`;
    const xp = $('#jarvisHermesXp');
    if (xp) xp.textContent = `${hermesDisplayXp} XP`;
    const bar = $('#jarvisHermesBar');
    if (bar) bar.style.width = `${Math.round((hermes.progress || 0) * 100)}%`;
    const inter = $('#jarvisHermesInteractions');
    if (inter) inter.textContent = `${hermes.totalInteractions || 0} interactions`;
    const sess = $('#jarvisHermesSessions');
    if (sess) sess.textContent = `Session #${hermes.sessionCount || 1}`;
    const resume = $('#jarvisResume');
    if (resume) resume.textContent = hermes.resumeMessage || 'Hermes online.';
    const left = $('#jarvisLeftOff');
    if (left) left.textContent = hermes.lastLeftOff || '—';
    const top = $('#jarvisHermesTop');
    if (top) {
      top.replaceChildren();
      (hermes.topTopics || []).forEach((t) => {
        const chip = document.createElement('span');
        chip.textContent = `${t.topic.toUpperCase()} ×${t.count}`;
        top.appendChild(chip);
      });
    }
    const log = $('#jarvisMemoryLog');
    if (log) {
      log.replaceChildren();
      const items = [];
      if (hermes.lastLeftOff) items.push({ label: 'LAST SESSION', text: hermes.lastLeftOff });
      (hermes.upgrades || []).slice(-3).forEach((u) => {
        items.push({ label: `UPGRADE → LV ${u.level}`, text: u.note || '' });
      });
      (hermes.recentHistory || []).slice(-3).reverse().forEach((r) => {
        items.push({ label: 'LEARNED', text: `Q: ${r.question}` });
      });
      items.slice(0, 6).forEach((it) => {
        const e = document.createElement('div');
        e.className = 'entry';
        const b = document.createElement('b');
        b.textContent = it.label + ' · ';
        e.append(b, document.createTextNode(it.text));
        log.appendChild(e);
      });
    }
    const topbarLvl = $('#jarvisTopHermes');
    if (topbarLvl) topbarLvl.textContent = `LV ${hermesDisplayLevel}`;
  }

  function hermesTick() {
    // Optimistic +1 XP per second (matches server tick). Syncs every 10s.
    hermesDisplayXp += 1;
    const xpEl = $('#jarvisHermesXp');
    if (xpEl) xpEl.textContent = `${hermesDisplayXp} XP`;
    // Level check (same curve as server).
    const newLevel = 1 + Math.floor(Math.sqrt(Math.max(0, hermesDisplayXp) / 100));
    if (newLevel > hermesDisplayLevel) {
      hermesDisplayLevel = newLevel;
      const box = $('#jarvisHermesBox');
      if (box) {
        box.classList.remove('upgrading');
        void box.offsetWidth;
        box.classList.add('upgrading');
      }
      const lvl = $('#jarvisHermesLevel');
      if (lvl) lvl.textContent = `LV ${hermesDisplayLevel}`;
      const topbarLvl = $('#jarvisTopHermes');
      if (topbarLvl) topbarLvl.textContent = `LV ${hermesDisplayLevel}`;
      setHelmetStatus(`HERMES UPGRADED · LEVEL ${hermesDisplayLevel}`);
    }
    const thought = $('#jarvisHermesThought');
    if (thought) {
      thoughtIdx = (thoughtIdx + 1) % THOUGHTS.length;
      thought.textContent = THOUGHTS[thoughtIdx];
    }
  }

  /* --------------------------------------------------------------- cameras */
  async function loadCameras() {
    try {
      const res = await fetch('/api/cameras', { cache: 'no-store' });
      const data = await res.json();
      const cams = (data.cameras || []).slice(0, 4);
      const grid = $('#jarvisCameraGrid');
      if (!grid) return;
      grid.replaceChildren();
      cams.forEach((c) => {
        const card = document.createElement('div');
        card.className = 'camera-card';
        const head = document.createElement('div');
        head.className = 'cam-head';
        const name = document.createElement('span');
        name.textContent = c.name.toUpperCase();
        const live = document.createElement('span');
        live.className = 'live';
        live.textContent = '● LIVE';
        head.append(name, live);
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.channel)}`;
        iframe.title = c.name + ' live';
        iframe.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        const foot = document.createElement('div');
        foot.className = 'cam-foot';
        foot.textContent = `${c.city}, ${c.country} · public broadcaster`;
        card.append(head, iframe, foot);
        grid.appendChild(card);
      });
    } catch {
      // Cameras optional.
    }
  }

  /* --------------------------------------------------------------- osint + globe */
  async function loadOsint() {
    try {
      const res = await fetch('/api/osint', { cache: 'no-store' });
      const data = await res.json();
      osint = data;
      updateGlobeStats();
    } catch {
      // Globe still renders with cached data.
    }
  }

  function updateGlobeStats() {
    if (!osint) return;
    const set = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
    set('#statFlights', osint.flights?.data?.length ?? 0);
    set('#statMilitary', osint.military?.data?.length ?? 0);
    set('#statShips', osint.ships?.data?.length ?? 0);
    set('#statTrains', osint.trains?.data?.length ?? 0);
    set('#statVehicles', osint.vehicles?.data?.length ?? 0);
    set('#statQuakes', osint.earthquakes?.data?.length ?? 0);
    const st = $('#jarvisGlobeStatus');
    if (st) {
      const live = (osint.flights?.ok ? 1 : 0) + (osint.earthquakes?.ok ? 1 : 0) + (osint.iss?.ok ? 1 : 0);
      st.textContent = live >= 2 ? 'LIVE FEEDS SYNCED' : 'PARTIAL FEEDS';
    }
  }

  async function loadWorld() {
    try {
      const res = await fetch('./data/world.geo.json', { cache: 'no-store' });
      const geo = await res.json();
      worldPolys = [];
      const feats = geo.features || [];
      feats.forEach((f) => {
        const geom = f.geometry;
        if (!geom) return;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
        polys.forEach((poly) => {
          poly.forEach((ring) => {
            if (ring.length > 2) worldPolys.push(ring);
          });
        });
      });
    } catch {
      worldPolys = [];
    }
  }

  function project(lat, lon) {
    // Orthographic projection with rotation.
    const latR = (lat * Math.PI) / 180;
    const lonR = (lon * Math.PI) / 180;
    const rotR = (globeRot * Math.PI) / 180;
    const tiltR = globeTilt;
    // Rotate around Y (lon), then tilt around X.
    const x = Math.cos(latR) * Math.sin(lonR - rotR);
    const y0 = Math.sin(latR);
    const z0 = Math.cos(latR) * Math.cos(lonR - rotR);
    const y = y0 * Math.cos(tiltR) - z0 * Math.sin(tiltR);
    const z = y0 * Math.sin(tiltR) + z0 * Math.cos(tiltR);
    return { x, y, z, visible: z > 0.08 };
  }

  function drawGlobe() {
    const canvas = $('#jarvisGlobe');
    if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.42;

    // Ocean glow.
    const ocean = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.15);
    ocean.addColorStop(0, 'rgba(0,80,120,.35)');
    ocean.addColorStop(0.7, 'rgba(0,40,70,.25)');
    ocean.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Sphere outline.
    ctx.strokeStyle = 'rgba(0,212,255,.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Graticule.
    ctx.strokeStyle = 'rgba(0,212,255,.12)';
    ctx.lineWidth = 0.6;
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const p = project(lat, lon);
        if (!p.visible) { started = false; continue; }
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = project(lat, lon);
        if (!p.visible) { started = false; continue; }
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Land.
    ctx.fillStyle = 'rgba(20,90,130,.55)';
    ctx.strokeStyle = 'rgba(80,200,240,.35)';
    ctx.lineWidth = 0.7;
    worldPolys.forEach((ring) => {
      ctx.beginPath();
      let started = false;
      ring.forEach(([lon, lat]) => {
        const p = project(lat, lon);
        if (!p.visible) { started = false; return; }
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    if (!osint) return;

    const plot = (lat, lon, color, size, glow) => {
      const p = project(lat, lon);
      if (!p.visible) return;
      const sx = cx + p.x * R;
      const sy = cy - p.y * R;
      const s = size * (0.6 + p.z * 0.6);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow || 6;
      ctx.beginPath();
      ctx.arc(sx, sy, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const trail = (lat, lon, headingDeg, color) => {
      if (headingDeg == null || !isFinite(headingDeg)) return;
      const p = project(lat, lon);
      if (!p.visible) return;
      const sx = cx + p.x * R;
      const sy = cy - p.y * R;
      const rad = (headingDeg * Math.PI) / 180;
      const len = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(rad) * len, sy - Math.cos(rad) * len);
      ctx.stroke();
    };

    // Natural events (orange diamonds).
    if (layers.natural && osint.naturalEvents?.data) {
      osint.naturalEvents.data.slice(0, 40).forEach((e) => {
        const p = project(e.lat, e.lon);
        if (!p.visible) return;
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        ctx.fillStyle = 'rgba(255,140,40,.9)';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      });
    }
    // Earthquakes (red).
    if (layers.quakes && osint.earthquakes?.data) {
      osint.earthquakes.data.slice(0, 50).forEach((q) => {
        const mag = q.mag || 2.5;
        plot(q.lat, q.lon, 'rgba(255,80,80,.95)', 2 + Math.min(4, mag), 8);
      });
    }
    // Traffic signals (amber dots).
    if (layers.traffic && osint.traffic?.data?.signals) {
      osint.traffic.data.signals.slice(0, 26).forEach((s) => {
        const c = s.state === 'green' ? 'rgba(99,240,180,.9)' : s.state === 'amber' ? 'rgba(255,177,59,.9)' : 'rgba(255,106,102,.9)';
        plot(s.lat, s.lon, c, 2.2, 5);
      });
    }
    // Ships (blue triangles + trails).
    if (layers.ships && osint.ships?.data) {
      osint.ships.data.forEach((s) => {
        trail(s.lat, s.lon, s.heading, 'rgba(80,160,255,.7)');
        plot(s.lat, s.lon, 'rgba(120,190,255,.95)', 2.6, 7);
      });
    }
    // Trains (green).
    if (layers.trains && osint.trains?.data) {
      osint.trains.data.forEach((t) => {
        trail(t.lat, t.lon, t.heading, 'rgba(99,240,180,.7)');
        plot(t.lat, t.lon, 'rgba(99,240,180,.95)', 2.8, 7);
      });
    }
    // Vehicles (purple).
    if (layers.vehicles && osint.vehicles?.data) {
      osint.vehicles.data.forEach((v) => {
        plot(v.lat, v.lon, 'rgba(200,140,255,.9)', 2, 5);
      });
    }
    // Flights (cyan + heading trails).
    if (layers.flights && osint.flights?.data) {
      osint.flights.data.slice(0, 180).forEach((f) => {
        trail(f.lat, f.lon, f.track, 'rgba(0,212,255,.55)');
        plot(f.lat, f.lon, 'rgba(0,229,255,.95)', 2.2, 6);
      });
    }
    // Military (amber).
    if (layers.military && osint.military?.data) {
      osint.military.data.slice(0, 60).forEach((m) => {
        trail(m.lat, m.lon, m.track, 'rgba(255,177,59,.6)');
        plot(m.lat, m.lon, 'rgba(255,177,59,.95)', 2.6, 7);
      });
    }
    // ISS (white, larger).
    if (layers.iss && osint.iss?.data?.lat != null) {
      const iss = osint.iss.data;
      plot(iss.lat, iss.lon, 'rgba(255,255,255,1)', 4, 12);
      const p = project(iss.lat, iss.lon);
      if (p.visible) {
        const sx = cx + p.x * R;
        const sy = cy - p.y * R;
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Home node (Delhi).
    plot(28.6139, 77.2090, 'rgba(255,255,255,1)', 3, 10);
  }

  function globeLoop() {
    if (!active) return;
    if (!globePaused && !dragging) globeRot += 0.12;
    drawGlobe();
    globeRaf = requestAnimationFrame(globeLoop);
  }

  function bindGlobe() {
    const canvas = $('#jarvisGlobe');
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      globeRot += (e.clientX - lastX) * 0.25;
      globeTilt = Math.max(-0.6, Math.min(0.9, globeTilt + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const end = () => { dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    const toggle = $('#jarvisGlobeToggle');
    if (toggle) toggle.onclick = () => {
      globePaused = !globePaused;
      toggle.textContent = globePaused ? 'RESUME ROTATION' : 'PAUSE ROTATION';
    };
    $$('.globe-legend button[data-layer]').forEach((b) => {
      b.onclick = () => {
        const key = b.dataset.layer;
        layers[key] = !layers[key];
        b.classList.toggle('active', layers[key]);
      };
    });
  }

  /* --------------------------------------------------------------- helmet */
  function setHelmetStatus(text) {
    const el = $('#jarvisHelmetStatus');
    if (el) el.textContent = text;
  }

  function setHelmetSpeaking(on) {
    $$('.helmet-eye').forEach((e) => e.classList.toggle('speaking', on));
    const wave = $('#jarvisHelmetWave');
    if (wave) wave.classList.toggle('active', on);
  }

  /* --------------------------------------------------------------- lifecycle */
  function enter() {
    if (active) return;
    active = true;
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    bindGlobe();
    bindAsk();
    const titleEl = $('#jarvisAnswerTitle');
    if (titleEl) titleEl.textContent = (typeof state !== 'undefined' && state.userTitle) || localStorage.getItem('iraUserTitle') || 'Commander';
    loadWorld().then(() => { if (active) drawGlobe(); });
    loadNews();
    newsTimer = setInterval(loadNews, 60000);
    loadHermes();
    hermesTimer = setInterval(loadHermes, 10000);
    hermesTickTimer = setInterval(hermesTick, 1000);
    loadCameras();
    loadOsint();
    osintTimer = setInterval(loadOsint, 12000);
    globeRaf = requestAnimationFrame(globeLoop);
    setHelmetStatus('ALL SYSTEMS NOMINAL');
  }

  function leave() {
    active = false;
    clearInterval(clockTimer);
    clearInterval(newsTimer);
    clearInterval(osintTimer);
    clearInterval(hermesTimer);
    clearInterval(hermesTickTimer);
    if (globeRaf) cancelAnimationFrame(globeRaf);
    globeRaf = null;
  }

  async function askJarvis(question) {
    const text = String(question || '').trim();
    if (!text) return null;
    const answerEl = $('#jarvisAnswerText');
    setHelmetStatus('PROCESSING');
    setHelmetSpeaking(true);
    if (answerEl) answerEl.textContent = 'Processing…';
    try {
      const result = await askIRA(text);
      setHelmetStatus('RESPONSE READY');
      setHelmetSpeaking(false);
      if (answerEl) answerEl.textContent = (result && result.answer) || 'Done.';
      // Hermes already learned server-side; refresh UI.
      loadHermes();
      return result;
    } catch {
      setHelmetStatus('LINK ERROR');
      setHelmetSpeaking(false);
      if (answerEl) answerEl.textContent = 'Link error. Please try again.';
      return null;
    }
  }

  function bindAsk() {
    const form = $('#jarvisAskForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const input = $('#jarvisAskInput');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input && input.value || '').trim();
      if (!q) return;
      input.value = '';
      askJarvis(q);
    });
  }

  window.iraJarvisEnter = enter;
  window.iraJarvisLeave = leave;
  window.askJarvis = askJarvis;
  window.iraJarvisSetSpeaking = setHelmetSpeaking;
})();
