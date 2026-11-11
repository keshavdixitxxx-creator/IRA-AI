/* IRA ARGUS — all-seeing intelligence HUD (UI 6).
   High-tech news wire (photo + text, cycling every second), live keyless OSINT
   globe, YouTube live video, and IRA's persistent memory woven into the HUD. */
(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  let active = false;
  let clockTimer = null, newsTimer = null, osintTimer = null, memoryTimer = null, spotlightTimer = null, globeRaf = null;
  let osint = null, headlines = [], spotIdx = 0, spotFading = false;
  let layers = { flights: true, military: true, iss: true, quakes: true, natural: true, ships: true, trains: true, vehicles: true, traffic: true };
  let globeRot = 0, globeTilt = 0.34, globePaused = false, dragging = false, lastX = 0, lastY = 0;
  let worldPolys = [];

  const FEEDS = [
    ['FLIGHTS · ADS-B', 'flights', 'live'],
    ['MILITARY · ADS-B', 'military', 'live'],
    ['ISS · ORBIT', 'iss', 'live'],
    ['QUAKES · USGS', 'earthquakes', 'live'],
    ['NATURAL · EONET', 'naturalEvents', 'live'],
    ['SHIPS · SIM', 'ships', 'sim'],
    ['TRAINS · SIM', 'trains', 'sim'],
    ['VEHICLES · SIM', 'vehicles', 'sim'],
    ['TRAFFIC · SIM', 'traffic', 'sim'],
  ];

  const modeIsActive = () => typeof state !== 'undefined' && state.mode === 'argus';
  const timeCode = () => new Date().toUTCString().slice(17, 25);

  /* ---------------------------------------------------------------- top bar */
  function tickClock() {
    const c = $('#argusClock'); if (c) c.textContent = timeCode();
    const d = $('#argusDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).toUpperCase() + ' UTC';
  }

  function fmtPub(raw) {
    if (!raw) return '';
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return raw.slice(0, 16);
    const d = new Date(t);
    return d.toUTCString().slice(5, 11).toUpperCase() + ' ' + d.toUTCString().slice(17, 22);
  }
  const monogram = (src) => (src || 'IRA').split(/\s+/).map(w => w[0]).join('').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IR';

  /* -------------------------------------------------------------- news wire */
  async function loadNews() {
    try {
      const res = await fetch('/api/intel/news', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok && Array.isArray(data.headlines) && data.headlines.length) {
        headlines = data.headlines.slice(0, 48);
        spotIdx = 0;
        renderSpotlight(true);
        renderList();
        renderTicker();
        const st = $('#argusNewsStatus');
        if (st) { st.textContent = `${headlines.length} WIRES LIVE`; st.className = 'right tag-live'; }
      } else {
        const st = $('#argusNewsStatus');
        if (st) { st.textContent = 'FEED OFFLINE'; st.className = 'right tag-off'; }
        if (!headlines.length) renderSpotlight(true);
      }
    } catch {
      const st = $('#argusNewsStatus');
      if (st) { st.textContent = 'FEED OFFLINE'; st.className = 'right tag-off'; }
    }
  }

  function renderSpotlight(instant) {
    const img = $('#argusSpotlightImg');
    const fallback = $('#argusSpotlightFallback');
    const title = $('#argusSpotlightTitle');
    const meta = $('#argusSpotlightMeta');
    const counter = $('#argusSpotlightCounter');
    const bar = $('#argusSpotlightBar');
    const link = $('#argusSpotlightLink');
    if (!title) return;
    const h = headlines[spotIdx];
    const apply = () => {
      if (h) {
        if (img) {
          if (h.image) { img.src = h.image; img.style.display = 'block'; } else { img.removeAttribute('src'); img.style.display = 'none'; }
          img.onerror = () => { img.style.display = 'none'; if (fallback) fallback.style.display = 'grid'; };
        }
        if (fallback) {
          fallback.style.display = h.image ? 'none' : 'grid';
          fallback.textContent = monogram(h.source);
        }
        title.textContent = h.title;
        meta.innerHTML = '';
        const src = document.createElement('b'); src.textContent = (h.source || 'NEWS').toUpperCase();
        const when = document.createElement('span'); when.textContent = fmtPub(h.published);
        meta.append(src, when);
        if (h.geo) {
          const geo = document.createElement('span');
          geo.textContent = `◈ ${String(h.geo.name || '').toUpperCase()} · APPROX`;
          geo.style.color = 'var(--argus-warn)';
          meta.appendChild(geo);
        }
        if (link && h.url && h.url.startsWith('http')) link.href = h.url; else if (link) link.removeAttribute('href');
      } else {
        if (img) img.style.display = 'none';
        if (fallback) { fallback.style.display = 'grid'; fallback.textContent = 'IR'; }
        title.textContent = 'World wire unavailable — check the server connection.';
        meta.textContent = 'RETRYING EVERY 60S';
      }
      counter.textContent = h ? `${String(spotIdx + 1).padStart(2, '0')} / ${String(headlines.length).padStart(2, '0')}` : '-- / --';
      if (bar) bar.style.width = headlines.length ? `${((spotIdx + 1) / headlines.length) * 100}%` : '0%';
      $$('.wire-item').forEach((el, i) => el.classList.toggle('hot', i === spotIdx));
    };
    if (instant) { apply(); return; }
    const spot = $('.wire-spotlight');
    if (!spot || spotFading) { apply(); return; }
    spotFading = true;
    spot.classList.add('fading');
    setTimeout(() => { apply(); spot.classList.remove('fading'); spotFading = false; }, 170);
  }

  function renderList() {
    const box = $('#argusNewsList');
    if (!box) return;
    box.replaceChildren();
    headlines.slice(0, 30).forEach((h, i) => {
      const a = document.createElement('a');
      a.className = 'wire-item';
      a.href = (h.url && h.url.startsWith('http')) ? h.url : '#';
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.addEventListener('mouseenter', () => { spotIdx = i; renderSpotlight(); });
      const thumb = document.createElement('div');
      thumb.className = 'wire-thumb';
      if (h.image) {
        const img = document.createElement('img');
        img.src = h.image; img.alt = ''; img.loading = 'lazy';
        img.onerror = () => { img.remove(); const s = document.createElement('span'); s.textContent = monogram(h.source); thumb.appendChild(s); };
        thumb.appendChild(img);
      } else {
        const s = document.createElement('span');
        s.textContent = monogram(h.source);
        thumb.appendChild(s);
      }
      const body = document.createElement('div');
      const h4 = document.createElement('h4');
      h4.textContent = h.title;
      const src = document.createElement('div');
      src.className = 'src';
      const b = document.createElement('b');
      b.textContent = (h.source || 'NEWS').toUpperCase();
      const t = document.createElement('span');
      t.textContent = fmtPub(h.published);
      src.append(b, t);
      body.append(h4, src);
      a.append(thumb, body);
      box.appendChild(a);
    });
  }

  function renderTicker() {
    const track = $('#argusTickerTrack');
    if (!track) return;
    track.replaceChildren();
    const items = headlines.slice(0, 14);
    [...items, ...items].forEach((h) => {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = (h.source || 'NEWS').toUpperCase() + ' — ';
      span.append(b, document.createTextNode(h.title));
      track.appendChild(span);
    });
  }

  /* --------------------------------------------------------------- cameras */
  async function loadCameras() {
    try {
      const res = await fetch('/api/cameras', { cache: 'no-store' });
      const data = await res.json();
      const cams = (data.cameras || []).slice(0, 4);
      const grid = $('#argusCameraGrid');
      if (!grid) return;
      grid.replaceChildren();
      cams.forEach((c) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        const head = document.createElement('div');
        head.className = 'video-head';
        const name = document.createElement('span');
        name.textContent = (c.name || 'LIVE').toUpperCase();
        const live = document.createElement('span');
        live.className = 'live';
        live.innerHTML = '<i></i>LIVE';
        head.append(name, live);
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.channel)}&muted=1`;
        iframe.title = c.name + ' live';
        iframe.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        const foot = document.createElement('div');
        foot.className = 'video-foot';
        const where = document.createElement('span');
        where.textContent = `${c.city}, ${c.country}`.toUpperCase();
        const open = document.createElement('a');
        open.href = c.watch || '#';
        open.target = '_blank';
        open.rel = 'noreferrer';
        open.textContent = 'OPEN ↗';
        foot.append(where, open);
        card.append(head, iframe, foot);
        grid.appendChild(card);
      });
    } catch {
      const grid = $('#argusCameraGrid');
      if (grid) grid.textContent = 'Camera directory unavailable.';
    }
  }

  /* ------------------------------------------------------------- OSINT globe */
  async function loadOsint() {
    try {
      const res = await fetch('/api/osint', { cache: 'no-store' });
      osint = await res.json();
      updateFeedMatrix();
      updateGlobeStats();
    } catch {
      const st = $('#argusGlobeStatus');
      if (st) { st.textContent = 'SNAPSHOT FAILED'; st.className = 'right tag-off'; }
    }
  }

  function updateFeedMatrix() {
    const box = $('#argusFeedMatrix');
    if (!box || !osint) return;
    box.replaceChildren();
    FEEDS.forEach(([label, key, kind]) => {
      const node = osint[key] || {};
      const div = document.createElement('div');
      div.className = 'feed';
      let cls = 'off', note = 'OFFLINE';
      if (kind === 'sim') { cls = 'sim'; note = 'SIM · OK'; }
      else if (node.ok) { cls = 'ok'; note = 'LIVE'; }
      else note = 'OFFLINE';
      div.classList.add(cls);
      div.title = node.error ? `${label} — ${node.error}` : `${label} — ${note}`;
      const dot = document.createElement('i');
      div.append(dot, document.createTextNode(`${label} · ${note}`));
      box.appendChild(div);
    });
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
    const st = $('#argusGlobeStatus');
    if (st) {
      const liveOk = (osint.flights?.ok ? 1 : 0) + (osint.earthquakes?.ok ? 1 : 0) + (osint.iss?.ok ? 1 : 0);
      st.textContent = liveOk >= 2 ? 'LIVE FEEDS SYNCED' : liveOk === 1 ? 'PARTIAL LIVE' : 'LIVE FEEDS BLOCKED · SIM LAYERS UP';
      st.className = 'right ' + (liveOk >= 2 ? 'tag-live' : 'tag-off');
    }
  }

  async function loadWorld() {
    try {
      const res = await fetch('./data/world.geo.json', { cache: 'no-store' });
      const geo = await res.json();
      worldPolys = [];
      (geo.features || []).forEach((f) => {
        const geom = f.geometry;
        if (!geom) return;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
        polys.forEach((poly) => poly.forEach((ring) => { if (ring.length > 2) worldPolys.push(ring); }));
      });
    } catch {
      worldPolys = [];
    }
  }

  function project(lat, lon) {
    const latR = (lat * Math.PI) / 180;
    const lonR = (lon * Math.PI) / 180;
    const rotR = (globeRot * Math.PI) / 180;
    const tiltR = globeTilt;
    const x = Math.cos(latR) * Math.sin(lonR - rotR);
    const y0 = Math.sin(latR);
    const z0 = Math.cos(latR) * Math.cos(lonR - rotR);
    const y = y0 * Math.cos(tiltR) - z0 * Math.sin(tiltR);
    const z = y0 * Math.sin(tiltR) + z0 * Math.cos(tiltR);
    return { x, y, z, visible: z > 0.05 };
  }

  function drawGlobe() {
    const canvas = $('#argusGlobe');
    if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;

    // atmosphere
    const halo = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.25);
    halo.addColorStop(0, 'rgba(0, 140, 200, .34)');
    halo.addColorStop(0.72, 'rgba(0, 80, 130, .14)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2); ctx.fill();

    // sphere body
    const bodyG = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
    bodyG.addColorStop(0, '#0a2436');
    bodyG.addColorStop(.55, '#041220');
    bodyG.addColorStop(1, '#010810');
    ctx.fillStyle = bodyG;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // graticule
    ctx.strokeStyle = 'rgba(0, 229, 255, .13)';
    ctx.lineWidth = 0.6;
    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath(); let started = false;
      for (let lat = -80; lat <= 80; lat += 4) {
        const p = project(lat, lon);
        if (!p.visible) { started = false; continue; }
        const sx = cx + p.x * R, sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = project(lat, lon);
        if (!p.visible) { started = false; continue; }
        const sx = cx + p.x * R, sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // landmasses
    ctx.fillStyle = 'rgba(12, 64, 88, .85)';
    ctx.strokeStyle = 'rgba(88, 222, 255, .4)';
    ctx.lineWidth = 0.7;
    worldPolys.forEach((ring) => {
      ctx.beginPath(); let started = false;
      ring.forEach(([lon, lat]) => {
        const p = project(lat, lon);
        if (!p.visible) { started = false; return; }
        const sx = cx + p.x * R, sy = cy - p.y * R;
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // limb highlight
    ctx.strokeStyle = 'rgba(120, 240, 255, .5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    if (!osint) return;
    const depth = (z) => 0.55 + z * 0.75;
    const dot = (lat, lon, color, size, glow) => {
      const p = project(lat, lon);
      if (!p.visible) return;
      const sx = cx + p.x * R, sy = cy - p.y * R;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow || 8;
      ctx.beginPath(); ctx.arc(sx, sy, size * depth(p.z), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    };
    const hull = (lat, lon, heading, color) => {
      const p = project(lat, lon);
      if (!p.visible) return;
      const sx = cx + p.x * R, sy = cy - p.y * R, s = 5.2 * depth(p.z);
      const a = ((heading || 0) * Math.PI) / 180;
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, s); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.72, s); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0;
    };
    const trail = (lat, lon, headingDeg, color, len) => {
      if (headingDeg == null || !isFinite(headingDeg)) return;
      const p = project(lat, lon);
      if (!p.visible) return;
      const sx = cx + p.x * R, sy = cy - p.y * R;
      const rad = (headingDeg * Math.PI) / 180, L = (len || 16) * depth(p.z);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(rad) * L, sy - Math.cos(rad) * L); ctx.stroke();
    };

    if (layers.natural && osint.naturalEvents?.data) {
      osint.naturalEvents.data.slice(0, 40).forEach((e) => {
        const p = project(e.lat, e.lon);
        if (!p.visible) return;
        const sx = cx + p.x * R, sy = cy - p.y * R, s = 4.4 * depth(p.z);
        ctx.fillStyle = 'rgba(255, 150, 48, .95)'; ctx.shadowColor = '#ff9630'; ctx.shadowBlur = 8;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); ctx.shadowBlur = 0;
      });
    }
    if (layers.quakes && osint.earthquakes?.data) {
      osint.earthquakes.data.slice(0, 50).forEach((q) => {
        const mag = q.mag || 2.5;
        dot(q.lat, q.lon, 'rgba(255, 84, 80, .95)', 2.4 + Math.min(4.6, mag), 10);
      });
    }
    if (layers.traffic && osint.traffic?.data?.signals) {
      osint.traffic.data.signals.slice(0, 30).forEach((s) => {
        const c = s.state === 'green' ? 'rgba(70, 240, 176, .95)' : s.state === 'amber' ? 'rgba(255, 177, 59, .95)' : 'rgba(255, 106, 102, .95)';
        dot(s.lat, s.lon, c, 2.6, 6);
      });
    }
    if (layers.ships && osint.ships?.data) {
      osint.ships.data.forEach((s) => { trail(s.lat, s.lon, s.heading, 'rgba(120, 198, 255, .6)', 18); hull(s.lat, s.lon, s.heading, 'rgba(140, 208, 255, .98)'); });
    }
    if (layers.trains && osint.trains?.data) {
      osint.trains.data.forEach((t) => { trail(t.lat, t.lon, t.heading, 'rgba(70, 240, 176, .6)', 15); dot(t.lat, t.lon, 'rgba(88, 245, 190, .98)', 4.6, 10); });
    }
    if (layers.vehicles && osint.vehicles?.data) {
      osint.vehicles.data.forEach((v) => dot(v.lat, v.lon, 'rgba(206, 148, 255, .9)', 3.4, 7));
    }
    if (layers.flights && osint.flights?.data) {
      osint.flights.data.slice(0, 180).forEach((f) => { trail(f.lat, f.lon, f.track, 'rgba(0, 229, 255, .55)', 14); dot(f.lat, f.lon, 'rgba(0, 238, 255, .97)', 3.1, 8); });
    }
    if (layers.military && osint.military?.data) {
      osint.military.data.slice(0, 60).forEach((m) => { trail(m.lat, m.lon, m.track, 'rgba(255, 177, 59, .6)', 16); dot(m.lat, m.lon, 'rgba(255, 183, 59, .98)', 4, 10); });
    }
    if (layers.iss && osint.iss?.data?.lat != null) {
      const iss = osint.iss.data;
      dot(iss.lat, iss.lon, 'rgba(255,255,255,1)', 5.6, 16);
      const p = project(iss.lat, iss.lon);
      if (p.visible) {
        const sx = cx + p.x * R, sy = cy - p.y * R;
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // IRA home node — Delhi
    dot(28.6139, 77.2090, 'rgba(255,255,255,1)', 4, 14);
  }

  function globeLoop() {
    if (!active) return;
    if (!globePaused && !dragging) globeRot += 0.14;
    drawGlobe();
    globeRaf = requestAnimationFrame(globeLoop);
  }

  function bindGlobe() {
    const canvas = $('#argusGlobe');
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      globeRot += (e.clientX - lastX) * 0.25;
      globeTilt = Math.max(-0.6, Math.min(0.9, globeTilt + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = () => { dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    const toggle = $('#argusGlobeToggle');
    if (toggle) toggle.onclick = () => {
      globePaused = !globePaused;
      toggle.textContent = globePaused ? 'RESUME' : 'HOLD';
    };
    $$('.globe-legend button[data-layer]').forEach((b) => {
      b.onclick = () => {
        const key = b.dataset.layer;
        layers[key] = !layers[key];
        b.classList.toggle('active', layers[key]);
      };
    });
  }

  /* ------------------------------------------------------------ IRA memory */
  // Hermes' traits live inside IRA: one line of persistent memory in the HUD.
  async function loadMemory() {
    try {
      const res = await fetch('/api/hermes/status', { cache: 'no-store' });
      const m = await res.json();
      const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
      set('#argusMemLevel', `LV ${m.level || 1}`);
      set('#argusMemCount', `${m.totalInteractions || 0} LEARNED`);
      const top = (m.topTopics && m.topTopics[0]) ? `TOP: ${String(m.topTopics[0].topic).toUpperCase()}` : 'TOP: —';
      set('#argusMemTopic', top);
      const last = String(m.lastLeftOff || '—').replace(/^Q:\s*/, '');
      set('#argusMemLast', last.length > 64 ? last.slice(0, 63) + '…' : last);
      const lastEl = $('#argusMemLast');
      if (lastEl) lastEl.title = m.lastLeftOff || '';
    } catch {
      const el = $('#argusMemLevel');
      if (el) el.textContent = 'OFFLINE';
    }
  }

  /* ------------------------------------------------------------------ ask */
  function setVoice(on) {
    const el = $('#argusVoice');
    if (el) el.classList.toggle('on', on);
    const st = $('#argusAskStatus');
    if (st) st.textContent = on ? 'IRA SPEAKING' : 'READY';
  }

  async function askArgus(question) {
    const text = String(question || '').trim();
    if (!text) return null;
    const answerEl = $('#argusAnswerText');
    const statusEl = $('#argusAskStatus');
    if (statusEl) statusEl.textContent = 'PROCESSING';
    setVoice(true);
    if (answerEl) answerEl.textContent = 'Processing…';
    try {
      const result = await askIRA(text);
      if (statusEl) statusEl.textContent = 'RESPONSE READY';
      setVoice(false);
      if (answerEl) answerEl.textContent = (result && result.answer) || 'Done.';
      loadMemory();
      return result;
    } catch {
      if (statusEl) statusEl.textContent = 'LINK ERROR';
      setVoice(false);
      if (answerEl) answerEl.textContent = 'Link error. Please try again.';
      return null;
    }
  }

  function bindAsk() {
    const form = $('#argusAskForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const input = $('#argusAskInput');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input && input.value || '').trim();
      if (!q) return;
      input.value = '';
      askArgus(q);
    });
  }

  /* ------------------------------------------------------------- lifecycle */
  function enter() {
    if (active) return;
    active = true;
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    bindGlobe();
    bindAsk();
    loadWorld().then(() => { if (active) drawGlobe(); });
    loadNews();
    newsTimer = setInterval(loadNews, 60000);
    spotlightTimer = setInterval(() => {
      if (!headlines.length) return;
      spotIdx = (spotIdx + 1) % headlines.length;
      renderSpotlight();
    }, 1000);
    loadOsint();
    osintTimer = setInterval(loadOsint, 12000);
    loadCameras();
    loadMemory();
    memoryTimer = setInterval(loadMemory, 10000);
    globeRaf = requestAnimationFrame(globeLoop);
  }

  function leave() {
    active = false;
    [clockTimer, newsTimer, osintTimer, memoryTimer, spotlightTimer].forEach(clearInterval);
    if (globeRaf) cancelAnimationFrame(globeRaf);
    globeRaf = null;
  }

  window.iraArgusEnter = enter;
  window.iraArgusLeave = leave;
  window.askArgus = askArgus;
  window.iraArgusSetSpeaking = setVoice;
})();
