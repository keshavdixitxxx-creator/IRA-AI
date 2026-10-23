/* ============================================================================
   IRA ADVANCED INTERFACES — front-end controller
   UI 4 : HOLO DECK   (holographic data wall)
   UI 5 : GOD'S EYE   (Argus / Atlas global command grid)

   Loaded after app.js, so it can reuse app.js globals: state, askIRA, setReply,
   speak, toast, escapeHTML, $ / $$. Brain calls go through /api/brain which
   needs no API key (hosted cloud brain -> live intelligence -> Wikipedia).
   ========================================================================= */
(() => {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[c]));
  const pad = (n, len = 3) => String(Math.round(n)).padStart(len, '0');
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const timeOf = (value) => {
    const d = value ? new Date(value) : new Date();
    return d.toUTCString().slice(17, 25);
  };

  /* ------------------------------------------------------------------------
     Shared brain + intelligence client
     --------------------------------------------------------------------- */
  const IRAIntel = {
    data: null,
    at: 0,
    pending: null,
    listeners: new Set(),
    status: null,
    async load(force = false) {
      if (!force && this.data && Date.now() - this.at < 75000) return this.data;
      if (this.pending) return this.pending;
      this.pending = fetch('/api/intel', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('intel ' + response.status))))
        .then((data) => {
          this.data = data;
          this.at = Date.now();
          this.listeners.forEach((fn) => { try { fn(data); } catch (error) { console.warn(error); } });
          return data;
        })
        .catch((error) => {
          console.warn('[IRA] intel feed:', error.message);
          if (this.data) return this.data;
          throw error;
        })
        .finally(() => { this.pending = null; });
      return this.pending;
    },
    on(fn) { this.listeners.add(fn); if (this.data) fn(this.data); },
    async statusOnce(force = false) {
      if (this.status && !force && Date.now() - this.at < 60000) return this.status;
      try {
        this.status = await fetch('/api/status', { cache: 'no-store' }).then((r) => r.json());
      } catch (error) {
        this.status = { ok: false, brain: { connected: false, reason: 'Server unreachable' } };
      }
      return this.status;
    },
    async ask(question, options = {}) {
      const response = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history: options.history || [],
          language: ($('#language') && $('#language').value) || 'en-IN',
          title: (typeof state !== 'undefined' && state.userTitle) || 'Commander',
          mode: options.mode || 'auto',
        }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.answer) throw new Error(data.error || 'The brain did not answer.');
      return data;
    },
  };

  window.IRAIntel = IRAIntel;
  window.iraBrainAsk = (question, options) => IRAIntel.ask(question, options);
  window.iraPublishMarkers = (markers) => {
    if (!Array.isArray(markers) || !markers.length) return;
    if (window.IRA_GE) window.IRA_GE.addMarkers(markers);
  };

  const feedOk = (block) => Boolean(block && block.ok);
  const blockData = (block, fallback) => (block && block.ok ? block.data : fallback);

  function chatter(text, kind = 'sys') {
    const log = { holo: '#holoLog', ge: null }[kind];
    if (log && $(log)) addHoloLog(text);
    if (typeof toast === 'function') toast(text);
  }

  /* ========================================================================
     UI 4 — HOLO DECK
     ===================================================================== */
  const holo = {
    ready: false,
    data: null,
    ringDefs: [
      ['PWR', 96], ['MEM', 74], ['NET', 88], ['AI', 92],
      ['SNS', 81], ['LNK', 95], ['SYS', 90], ['CRX', 78],
    ],
    rings: [],
    values: { power: 72, signal: 301, nodes: 507, scan: 79, target: 62, link: 96 },
  };

  function setArc(id, percent) {
    const path = $('#' + id);
    if (!path) return;
    path.setAttribute('stroke-dashoffset', String(clamp(100 - percent, 0, 100).toFixed(1)));
  }
  function setRing(ring, percent) {
    ring.stroke.setAttribute('stroke-dashoffset', String(clamp(100 - percent, 0, 100).toFixed(1)));
    ring.label.textContent = pad(percent, 2);
  }

  function buildHoloRings() {
    const host = $('#holoRings');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    holo.rings = holo.ringDefs.map(([label, value]) => {
      const wrap = document.createElement('div');
      wrap.className = 'holo-ring';
      wrap.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">
          <circle class="track" cx="20" cy="20" r="16"/>
          <circle class="val" cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - value}"/>
        </svg><b>${value}</b><em>${label}</em>`;
      host.appendChild(wrap);
      return { label: wrap.querySelector('b'), stroke: wrap.querySelector('.val'), key: label, value };
    });
  }

  function addHoloLog(text) {
    const log = $('#holoLog');
    if (!log) return;
    const line = document.createElement('div');
    line.innerHTML = `<time>${timeOf()}</time><span>${esc(text)}</span>`;
    log.prepend(line);
    while (log.children.length > 22) log.lastElementChild.remove();
  }

  function holoMetric(label, value, percent, unit = '') {
    const row = document.createElement('div');
    row.className = 'holo-metric';
    row.innerHTML = `<span>${esc(label)}</span><div class="holo-bar"><i style="width:${clamp(percent, 0, 100)}%"></i></div><b>${esc(value)}${unit ? `<i>${esc(unit)}</i>` : ''}</b>`;
    return row;
  }

  function holoItem(kicker, title, onClick, live = true) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'holo-item';
    button.innerHTML = `<small>${esc(kicker)}</small><b>${esc(title)}</b>${live ? '<span class="dot"></span>' : ''}`;
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  function renderHolo(data) {
    holo.data = data;
    if (!data) return;
    const weather = blockData(data.weather, null);
    const flights = blockData(data.flights, []);
    const military = blockData(data.military, []);
    const quakes = blockData(data.earthquakes, []);
    const natural = blockData(data.naturalEvents, []);
    const headlines = blockData(data.headlines, []);
    const iss = blockData(data.iss, null);
    const signals = (blockData(data.traffic, { signals: [] }).signals) || [];
    const okCount = ['weather', 'flights', 'military', 'earthquakes', 'naturalEvents', 'headlines', 'iss']
      .filter((key) => feedOk(data[key])).length;

    // header telemetry
    holo.values.power = clamp(64 + okCount * 5, 40, 99);
    holo.values.signal = clamp(180 + okCount * 46 + flights.length, 0, 999);
    holo.values.nodes = clamp(420 + flights.length + military.length + headlines.length * 2, 0, 999);
    holo.values.scan = clamp(60 + okCount * 5 + Math.random() * 4, 30, 100);
    holo.values.target = clamp(48 + headlines.length, 30, 99);
    holo.values.link = data.headlines && data.headlines.ok ? 96 : 58;
    setArc('holoArcPower', holo.values.power);
    setArc('holoArcSignal', (holo.values.signal / 999) * 100);
    setArc('holoArcNodes', (holo.values.nodes / 999) * 100);
    setArc('holoDialScan', holo.values.scan);
    setArc('holoDialTarget', holo.values.target);
    setArc('holoDialLink', holo.values.link);
    const setText = (id, value) => { const node = $('#' + id); if (node) node.textContent = value; };
    setText('holoPwrValue', pad(holo.values.power));
    setText('holoSignalValue', pad(holo.values.signal));
    setText('holoNodesValue', pad(holo.values.nodes));
    setText('holoDialScanValue', pad(holo.values.scan, 2));
    setText('holoDialTargetValue', pad(holo.values.target, 2));
    setText('holoDialLinkValue', pad(holo.values.link, 2));

    // core matrix
    const core = $('#holoCoreMetrics');
    if (core) {
      core.textContent = '';
      core.append(
        holoMetric('NEURAL LINK', data.headlines.ok ? 'LOCKED' : 'DEGRADED', holo.values.link),
        holoMetric('AIR TRACK', String(flights.length), clamp(flights.length, 4, 100)),
        holoMetric('ORBITAL', iss ? `${Math.round(iss.alt || 0)}` : '—', iss ? 84 : 8, 'km'),
        holoMetric('FEEDS', `${okCount}/7`, (okCount / 7) * 100),
      );
    }

    // mission stack = top live stories
    const missions = $('#holoMissions');
    if (missions) {
      missions.textContent = '';
      headlines.slice(0, 4).forEach((item, index) => {
        missions.append(holoItem(`TARGET ${pad(index + 1, 2)} · ${item.source || 'LIVE'}`,
          item.title, () => askHolo(`Tell me more about this story: ${item.title}`)));
      });
      if (!headlines.length) missions.append(holoItem('NO SIGNAL', 'News feed reconnecting…', null, false));
    }
    setText('holoMissionCount', `${headlines.length} QUEUED`);

    // environment
    const env = $('#holoEnv');
    if (env) {
      env.textContent = '';
      if (weather) {
        env.append(
          holoMetric('TEMP', `${Math.round(weather.temperature)}`, clamp(weather.temperature + 40, 0, 100), '°C'),
          holoMetric('WIND', `${Math.round(weather.wind || 0)}`, clamp(weather.wind || 0, 0, 100), 'km/h'),
          holoMetric('HUMIDITY', `${Math.round(weather.humidity || 0)}`, weather.humidity || 0, '%'),
          holoMetric('RANGE', `${Math.round(weather.min)}–${Math.round(weather.max)}`, 62, '°'),
        );
      } else {
        env.append(holoItem('OFFLINE', 'Weather feed unavailable', null, false));
      }
    }
    setText('holoEnvTag', weather ? 'OPEN-METEO' : 'OFFLINE');

    // target track
    const targets = $('#holoTargets');
    if (targets) {
      targets.textContent = '';
      headlines.slice(0, 6).forEach((item) => {
        targets.append(holoItem(item.geo ? `PIN · ${item.geo.name}` : (item.source || 'LIVE'),
          item.title, () => askHolo(`What is happening with this: ${item.title}`)));
      });
      if (!headlines.length) targets.append(holoItem('NO SIGNAL', 'Headline feed reconnecting…', null, false));
    }

    // grid status
    const grid = $('#holoGrid');
    if (grid) {
      grid.textContent = '';
      grid.append(
        holoMetric('CIVIL AIR', String(flights.length), clamp(flights.length, 2, 100)),
        holoMetric('MILITARY', String(military.length), clamp(military.length * 4, 2, 100)),
        holoMetric('SEISMIC', String(quakes.length), clamp(quakes.length * 2, 2, 100)),
        holoMetric('NATURAL', String(natural.length), clamp(natural.length * 2, 2, 100)),
        holoMetric('SIGNALS', String(signals.length), 70, 'SIM'),
      );
    }

    // resources
    const resources = $('#holoResources');
    if (resources) {
      resources.textContent = '';
      resources.append(
        holoMetric('BANDWIDTH', `${Math.round(62 + okCount * 4)}`, 62 + okCount * 4, '%'),
        holoMetric('MEMORY', '74', 74, '%'),
        holoMetric('INFERENCE', data.headlines.ok ? 'READY' : 'LOCAL', 88),
        holoMetric('UPTIME', pad((performance.now() / 60000) % 999), 91, 'MIN'),
      );
    }

    // alerts
    const alerts = $('#holoAlerts');
    if (alerts) {
      alerts.textContent = '';
      const alertItems = [
        ...quakes.slice(0, 3).map((quake) => ({ kind: `M${quake.mag} SEISMIC`, title: quake.title,
          ask: `Tell me about the M${quake.mag} earthquake at ${quake.title}` })),
        ...natural.slice(0, 2).map((event) => ({ kind: event.category, title: event.title,
          ask: `Tell me about this natural event: ${event.title}` })),
      ];
      alertItems.forEach((item) => alerts.append(holoItem(item.kind, item.title, () => askHolo(item.ask))));
      if (!alertItems.length) alerts.append(holoItem('CLEAR', 'No active alerts in feed', null, false));
      setText('holoAlertCount', `${alertItems.length}`);
    }

    // stage captions
    setText('holoStageLink', data.headlines.ok ? 'UPLINK STABLE' : 'RECONNECTING');
    setText('holoStageLayers', `${flights.length} AIR · ${military.length} MIL · ${quakes.length} SEIS`);
    const home = data.home || { lat: 28.6692, lon: 77.4538 };
    setText('holoStageCoords', `${home.lat.toFixed(4)} N · ${home.lon.toFixed(4)} E`);
    setText('holoHeaderSub', `CORE LINK · ${okCount >= 5 ? 'NOMINAL' : 'PARTIAL'} · ${data.elapsedMs || 0} MS`);

    holo.rings.forEach((ring, index) => {
      const base = ring.value;
      setRing(ring, clamp(base + Math.round(Math.sin(Date.now() / 2400 + index) * 5), 12, 100));
    });

    addHoloLog(`Feed sweep complete · ${okCount}/7 layers · ${data.elapsedMs || 0} ms`);
    if (flights.length) addHoloLog(`${flights.length} aircraft locked on ADS-B`);
    if (quakes.length) addHoloLog(`${quakes.length} seismic events · strongest M${quakes[0].mag}`);
  }

  function renderHoloOffline(reason) {
    addHoloLog('Grid offline: ' + reason);
    const targets = $('#holoTargets');
    if (targets) {
      targets.textContent = '';
      targets.append(holoItem('OFFLINE', 'Start ira_server.py to stream live feeds', null, false));
    }
    setArc('holoDialLink', 12);
    const link = $('#holoStageLink');
    if (link) link.textContent = 'NO UPLINK';
  }

  function holoAnswer(text, source) {
    const box = $('#holoAnswer');
    const body = $('#holoAnswerText');
    const link = $('#holoAnswerSource');
    if (!box || !body) return;
    box.hidden = false;
    body.textContent = text;
    if (link) {
      if (source) { link.hidden = false; link.href = source; } else { link.hidden = true; link.removeAttribute('href'); }
    }
    body.scrollTop = 0;
    box.scrollTop = 0;
  }

  async function askHolo(question) {
    const text = String(question || '').trim();
    if (!text) return;
    holoAnswer(`Analysing “${text}” across the live grid…`);
    addHoloLog(`QUERY · ${text.slice(0, 54)}`);
    const stateRef = typeof state !== 'undefined' ? state : null;
    if (stateRef) stateRef.lastReply = `Analysing “${text}”…`;
    try {
      const result = await IRAIntel.ask(text, { mode: 'auto' });
      holoAnswer(result.answer, result.source);
      addHoloLog(`${(result.engine || 'brain').toUpperCase()} · reply received`);
      if (stateRef) stateRef.lastReply = result.answer;
      if (result.markers && result.markers.length && window.IRA_GE) window.IRA_GE.addMarkers(result.markers);
      if ($('#voiceToggle') && $('#voiceToggle').checked && typeof speak === 'function') speak(result.answer);
      return result;
    } catch (error) {
      holoAnswer('I could not reach the brain or the live grid. Check that ira_server.py is running and try again.');
      addHoloLog('QUERY FAILED · ' + error.message);
    }
    return null;
  }

  /* ---------- holo canvas: rotating arc lattice ---------- */
  function holoCanvasLoop() {
    const canvas = $('#holoCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = Math.min(devicePixelRatio || 1, 2);

    function resize() {
      const stage = canvas.parentElement;
      if (!stage) return;
      width = stage.clientWidth; height = stage.clientHeight;
      canvas.width = Math.max(1, width * dpr); canvas.height = Math.max(1, height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    addEventListener('resize', resize);
    setTimeout(resize, 60);
    resize();

    const cyan = '111, 240, 255';

    (function draw(now = 0) {
      requestAnimationFrame(draw);
      if (typeof state !== 'undefined' && state.mode !== 'holo') return;
      if (!width || !height) { resize(); return; }
      const cx = width / 2, cy = height / 2;
      const base = Math.min(width, height) * 0.36;
      ctx.clearRect(0, 0, width, height);

      // ambient bloom
      const bloom = ctx.createRadialGradient(cx, cy, 10, cx, cy, base * 1.7);
      bloom.addColorStop(0, `rgba(${cyan},.16)`);
      bloom.addColorStop(0.5, `rgba(${cyan},.05)`);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);

      // tick rings
      for (let ring = 0; ring < 4; ring += 1) {
        const radius = base * (1.06 + ring * 0.2);
        const ticks = 96 + ring * 24;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(now * (0.00004 + ring * 0.00002) * (ring % 2 ? -1 : 1));
        for (let tick = 0; tick < ticks; tick += 1) {
          const angle = (tick / ticks) * Math.PI * 2;
          const long = tick % 8 === 0;
          const inner = radius - (long ? 9 : 4);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          ctx.strokeStyle = `rgba(${cyan},${long ? 0.4 : 0.14})`;
          ctx.lineWidth = long ? 1.1 : 0.7;
          ctx.stroke();
        }
        ctx.restore();
      }

      // segmented sweeping arcs (the layered look of the reference HUD)
      const arcs = [
        { r: 1.0, from: -0.6, to: 1.9, speed: 0.00016, width: 5, gap: 1 },
        { r: 0.86, from: 1.2, to: 3.5, speed: -0.00022, width: 3, gap: 1 },
        { r: 0.74, from: 3.9, to: 5.4, speed: 0.0003, width: 6, gap: 0 },
        { r: 0.6, from: 0.2, to: 2.4, speed: -0.0004, width: 2, gap: 1 },
        { r: 1.28, from: 2.2, to: 4.1, speed: 0.0001, width: 2, gap: 1 },
      ];
      arcs.forEach((arc, index) => {
        const radius = base * arc.r;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(now * arc.speed + index);
        if (arc.gap) {
          ctx.setLineDash([26, 12, 4, 10]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(0, 0, radius, arc.from, arc.to);
        ctx.strokeStyle = `rgba(${cyan},${0.5 - index * 0.06})`;
        ctx.lineWidth = arc.width;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.setLineDash([]);
        // solid block segment opposite
        ctx.beginPath();
        ctx.arc(0, 0, radius, arc.to + 0.5, arc.to + 1.15);
        ctx.strokeStyle = `rgba(${cyan},.24)`;
        ctx.lineWidth = arc.width + 4;
        ctx.stroke();
        ctx.restore();
      });

      // radar sweep
      const sweep = (now * 0.0004) % (Math.PI * 2);
      if (ctx.createConicGradient) {
        const grad = ctx.createConicGradient(sweep, cx, cy);
        grad.addColorStop(0, `rgba(${cyan},.14)`);
        grad.addColorStop(0.08, `rgba(${cyan},0)`);
        grad.addColorStop(1, `rgba(${cyan},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, base * 1.1, 0, Math.PI * 2); ctx.fill();
      }

      // crosshair + measurement lines
      ctx.strokeStyle = `rgba(${cyan},.16)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - base * 1.5, cy); ctx.lineTo(cx + base * 1.5, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - base * 1.5); ctx.lineTo(cx, cy + base * 1.5); ctx.stroke();

      // bracket corners
      const bracket = base * 1.36;
      const size = 16;
      ctx.strokeStyle = `rgba(${cyan},.6)`;
      ctx.lineWidth = 1.4;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const x = cx + sx * bracket, y = cy + sy * bracket;
        ctx.beginPath();
        ctx.moveTo(x, y - sy * size); ctx.lineTo(x, y); ctx.lineTo(x - sx * size, y);
        ctx.stroke();
      });

      // drifting nodes on the lattice
      for (let i = 0; i < 16; i += 1) {
        const angle = now * 0.0002 + i * 0.39;
        const radius = base * (0.55 + (i % 5) * 0.16);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle * 1.3) * radius * 0.62;
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7);
        ctx.fillStyle = `rgba(${cyan},.6)`; ctx.fill();
      }
    })();

    window.iraHoloResize = resize;
  }

  function holoTick() {
    if (typeof state !== 'undefined' && state.mode !== 'holo') return;
    // lightweight life so the deck never looks frozen between feed sweeps
    holo.rings.forEach((ring, index) => {
      const drift = Math.sin(Date.now() / 2200 + index * 1.3) * 4;
      setRing(ring, clamp(ring.value + drift, 12, 100));
    });
    const scan = clamp(holo.values.scan + (Math.random() * 6 - 3), 35, 99);
    setArc('holoDialScan', scan);
    const node = $('#holoDialScanValue');
    if (node) node.textContent = pad(scan, 2);
    const link = $('#holoBrain');
    if (link && typeof state !== 'undefined') link.classList.toggle('speaking', Boolean(state.speaking || state.listening));
  }

  function initHolo() {
    if (holo.ready) return;
    holo.ready = true;
    buildHoloRings();
    holoCanvasLoop();
    IRAIntel.on(renderHolo);
    const form = $('#holoCommandForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = $('#holoCommand');
        const value = input.value.trim();
        if (!value) return;
        input.value = '';
        askHolo(value);
      });
    }
    const mic = $('#holoMic');
    if (mic) mic.addEventListener('click', () => { const target = $('#micBtn'); if (target) target.click(); });
    const refresh = $('#holoRefresh');
    if (refresh) refresh.addEventListener('click', () => {
      addHoloLog('Manual feed refresh');
      IRAIntel.load(true).catch((error) => renderHoloOffline(error.message));
    });
    setInterval(holoTick, 1600);
    IRAIntel.load().catch((error) => renderHoloOffline(error.message));
    IRAIntel.statusOnce().then((status) => {
      if (!status || !status.brain) return;
      addHoloLog(status.brain.connected ? 'Cloud brain linked · no API key' : 'Cloud brain offline · local grid only');
    });
  }

  window.iraHoloEnter = function () {
    initHolo();
    IRAIntel.load().catch((error) => renderHoloOffline(error.message));
    setTimeout(() => { if (window.iraHoloResize) window.iraHoloResize(); }, 40);
  };
  window.askHolo = askHolo;

  /* ========================================================================
     UI 5 — GOD'S EYE
     ===================================================================== */
  const GE = {
    ready: false,
    data: null,
    module: 'overview',
    markers: [],
    dynamic: [],
    selected: null,
    view: { scale: 1, x: 0, y: 0 },
    cameras: new Map(),
    localStream: null,
    localFrame: null,
    moduleTimer: null,
    lastStatus: null,
  };

  const LAYER_LABEL = {
    flight: 'flights', military: 'military', earthquake: 'earthquakes', natural: 'natural',
    news: 'news', traffic: 'traffic', camera: 'cameras', orbit: 'orbit', system: 'system',
    place: 'news', quake: 'earthquakes',
  };

  function geSetText(id, value) {
    const node = $('#' + id);
    if (node) node.textContent = value;
  }

  function markerColorClass(type) {
    return type;
  }

  function applyMapView() {
    const img = $('#geMap > img');
    const layer = $('#geMarkers');
    const transform = `translate(${GE.view.x}px, ${GE.view.y}px) scale(${GE.view.scale})`;
    if (img) img.style.transform = transform;
    if (layer) layer.style.transform = transform;
    const scale = $('#geScaleLabel');
    if (scale) scale.textContent = GE.view.scale < 1.4 ? '2 000 km' : GE.view.scale < 2.2 ? '900 km' : GE.view.scale < 3 ? '400 km' : '180 km';
  }

  function focusOn(lat, lon, zoom = 2.3) {
    const map = $('#geMap');
    if (!map || typeof lat !== 'number' || typeof lon !== 'number') return;
    const width = map.clientWidth, height = map.clientHeight;
    GE.view.scale = zoom;
    const px = ((lon + 180) / 360) * width;
    const py = ((90 - lat) / 180) * height;
    GE.view.x = width / 2 - px * zoom;
    GE.view.y = height / 2 - py * zoom;
    applyMapView();
  }

  function createMarker(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ge-marker ${markerColorClass(item.type)} ${item.state || ''}`;
    button.style.left = `${((item.lon + 180) / 360) * 100}%`;
    button.style.top = `${((90 - item.lat) / 180) * 100}%`;
    const label = (item.title || '').slice(0, 26);
    button.innerHTML = `<span class="halo"></span><span class="nub"></span><span class="lbl">${esc(label)}</span>`;
    button.dataset.kind = item.type;
    button.title = `${item.title || item.type}${item.meta ? ' · ' + item.meta : ''}`;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      GE.select(item, button);
    });
    return button;
  }

  function rebuildMarkers() {
    const layer = $('#geMarkers');
    if (!layer) return;
    layer.textContent = '';
    const data = GE.data;
    if (!data) return;
    const flights = blockData(data.flights, []);
    const military = blockData(data.military, []);
    const quakes = blockData(data.earthquakes, []);
    const natural = blockData(data.naturalEvents, []);
    const headlines = blockData(data.headlines, []);
    const signals = blockData(data.traffic, { signals: [] }).signals || [];
    const cameras = blockData(data.cameras, []);
    const iss = blockData(data.iss, null);
    const nodes = blockData(data.systemNodes, []);

    const list = [];
    flights.slice(0, 170).forEach((aircraft) => list.push({
      type: 'flight', title: aircraft.flight || aircraft.callsign || aircraft.hex || 'Aircraft',
      lat: aircraft.lat, lon: aircraft.lon,
      meta: `${aircraft.type || 'AC'} · ${aircraft.alt == null ? '—' : Math.round(aircraft.alt) + ' ft'} · ${aircraft.speed == null ? '—' : Math.round(aircraft.speed) + ' kt'}`,
      raw: aircraft, kind: 'flight',
    }));
    military.slice(0, 90).forEach((aircraft) => list.push({
      type: 'military', title: aircraft.flight || aircraft.callsign || aircraft.hex || 'MIL',
      lat: aircraft.lat, lon: aircraft.lon,
      meta: `${aircraft.type || 'MIL'} · ${aircraft.alt == null ? '—' : Math.round(aircraft.alt) + ' ft'}`,
      raw: aircraft, kind: 'military',
    }));
    quakes.slice(0, 50).forEach((quake) => list.push({
      type: 'earthquake', title: `M${quake.mag} ${quake.title}`, lat: quake.lat, lon: quake.lon,
      meta: `${quake.depth == null ? '—' : Math.round(quake.depth) + ' km deep'} · ${timeOf(quake.time)} UTC`,
      raw: quake, kind: 'earthquake',
    }));
    natural.slice(0, 45).forEach((event) => list.push({
      type: 'natural', title: event.title, lat: event.lat, lon: event.lon,
      meta: `${event.category} · ${event.date || ''}`, raw: event, kind: 'natural',
    }));
    headlines.forEach((item) => {
      if (!item.geo) return;
      list.push({
        type: 'news', title: item.title, lat: item.geo.lat, lon: item.geo.lon,
        meta: `${item.source} · ${item.geo.country} (approx)`, raw: item, kind: 'news',
      });
    });
    signals.forEach((signal) => list.push({
      type: 'traffic', title: signal.name, lat: signal.lat, lon: signal.lon,
      meta: `${signal.state.toUpperCase()} · ${Math.round(signal.remaining)}s · load ${Math.round(signal.load)}%`,
      raw: signal, kind: 'traffic', state: signal.state,
    }));
    cameras.forEach((camera) => list.push({
      type: 'camera', title: camera.name, lat: camera.lat, lon: camera.lon,
      meta: `${camera.city} · live public feed`, raw: camera, kind: 'camera',
    }));
    if (iss && typeof iss.lat === 'number') list.push({
      type: 'orbit', title: 'ISS', lat: iss.lat, lon: iss.lon,
      meta: `${Math.round(iss.alt)} km · ${Math.round(iss.velocity)} km/h`, raw: iss, kind: 'orbit',
    });
    nodes.forEach((node) => list.push({
      type: 'system', title: node.name, lat: node.lat, lon: node.lon,
      meta: 'IRA network node', raw: node, kind: 'system',
    }));
    GE.dynamic.forEach((item) => {
      if (typeof item.lat !== 'number' || typeof item.lon !== 'number') return;
      list.push({
        type: item.type === 'place' ? 'place' : item.type === 'military' ? 'military'
          : item.type === 'flight' ? 'flight' : item.type === 'earthquake' ? 'earthquake'
            : item.type === 'traffic' ? 'traffic' : item.type === 'natural' ? 'natural' : 'news',
        title: item.title, lat: item.lat, lon: item.lon, meta: item.meta || 'IRA pin',
        raw: item, kind: 'dynamic', url: item.url,
      });
    });

    GE.markers = list;
    const fragment = document.createDocumentFragment();
    list.forEach((item) => fragment.append(createMarker(item)));
    layer.append(fragment);
    updateLayerCounts();
  }

  function updateLayerCounts() {
    const counts = GE.markers.reduce((acc, item) => {
      const layer = LAYER_LABEL[item.type] || item.type;
      acc[layer] = (acc[layer] || 0) + 1;
      return acc;
    }, {});
    geSetText('geLayerFlights', counts.flights || 0);
    geSetText('geLayerMilitary', counts.military || 0);
    geSetText('geLayerNews', counts.news || 0);
    geSetText('geLayerQuakes', counts.earthquakes || 0);
    geSetText('geLayerNatural', counts.natural || 0);
    geSetText('geLayerTraffic', counts.traffic || 0);
    geSetText('geLayerCameras', counts.cameras || 0);
    geSetText('geLayerSystem', counts.system || 0);
    geSetText('geCountFlights', counts.flights || 0);
    geSetText('geCountMilitary', counts.military || 0);
    geSetText('geCountCameras', counts.cameras || 0);
    geSetText('geCountTraffic', counts.traffic || 0);
    geSetText('geCountSeismic', counts.earthquakes || 0);
    geSetText('geCountNews', (GE.data && blockData(GE.data.headlines, []).length) || 0);
  }

  function selectMarker(item, button) {
    GE.selected = item;
    $$('.ge-marker.selected').forEach((node) => node.classList.remove('selected'));
    if (button) button.classList.add('selected');
    if (item.kind === 'camera') {
      // switching to the optic wall so the stream tile is mounted before we load it
      GE.module = 'cameras';
      syncModules();
      renderModule();
      setTimeout(() => openCamera(item.raw.id), 60);
      if (typeof toast === 'function') toast(`Opening ${item.title} · public live feed`);
      return;
    }
    renderDetail(item);
  }

  GE.select = selectMarker;

  function renderDetail(item) {
    const body = $('#geConsoleBody');
    if (!body) return;
    const card = document.createElement('div');
    card.className = 'ge-card accent';
    const rows = [
      ['CLASS', item.type.toUpperCase()],
      ['POSITION', `${Number(item.lat).toFixed(3)}, ${Number(item.lon).toFixed(3)}`],
      ['META', item.meta || '—'],
    ];
    if (item.raw && item.raw.mag != null) rows.push(['MAGNITUDE', item.raw.mag]);
    if (item.raw && item.raw.speed != null) rows.push(['GROUND SPEED', `${Math.round(item.raw.speed)} kt`]);
    if (item.raw && item.raw.track != null) rows.push(['HEADING', `${Math.round(item.raw.track)}°`]);
    if (item.raw && item.raw.alt != null) rows.push(['ALTITUDE', `${Math.round(item.raw.alt)} ft`]);
    if (item.raw && item.raw.squawk) rows.push(['SQUAWK', item.raw.squawk]);
    if (item.raw && item.raw.registration) rows.push(['REGISTRATION', item.raw.registration]);
    if (item.raw && item.raw.operator) rows.push(['OPERATOR', item.raw.operator]);
    card.innerHTML = `<h4>TARGET DOSSIER <span>${esc(item.kind || item.type)}</span></h4>
      <p>${esc(item.title)}</p>
      ${rows.map(([key, value]) => `<div class="row"><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('')}
      <div class="ge-actions">
        <button type="button" data-act="ask">ASK IRA</button>
        <button type="button" data-act="focus">FOCUS</button>
        ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">SOURCE ↗</a>` : ''}
        ${item.raw && item.raw.channel ? `<a href="https://www.youtube-nocookie.com/embed/live_stream?channel=${esc(item.raw.channel)}&autoplay=1&mute=1" target="_blank" rel="noreferrer">WATCH ↗</a>` : ''}
      </div>`;
    const fresh = document.createElement('div');
    fresh.append(card);
    body.prepend(fresh);
    card.querySelector('[data-act="ask"]').addEventListener('click', () => {
      askGodsEye(`Give me everything about ${item.title}${item.meta ? ' (' + item.meta + ')' : ''}`);
    });
    card.querySelector('[data-act="focus"]').addEventListener('click', () => focusOn(item.lat, item.lon, 3));
    while (body.children.length > 24) body.lastElementChild.remove();
  }

  function geFeedItem(kicker, title, onSelect, color = '#7ef0c8') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ge-feed-item';
    button.style.color = color;
    button.innerHTML = `<i></i><span><small>${esc(kicker)}</small><b>${esc(title)}</b></span>`;
    button.addEventListener('click', onSelect);
    return button;
  }

  function feedRows(block, key) {
    const card = document.createElement('div');
    card.className = 'ge-card';
    const data = GE.data || {};
    const blockInfo = data[key] || {};
    card.innerHTML = `<h4>${esc(key.toUpperCase())} <span>${blockInfo.ok ? 'LIVE' : 'OFFLINE'} · ${blockInfo.ms || 0} MS</span></h4>
      <p>${esc(blockInfo.source || '')}${blockInfo.ok ? '' : ' — ' + esc(blockInfo.error || 'unreachable')}</p>`;
    return card;
  }

  const MODULE_TITLES = {
    overview: 'IRA // OVERVIEW', flights: 'LIVE FLIGHTS', military: 'MILITARY AIRSPACE',
    cameras: 'CAMERA WALL', traffic: 'TRAFFIC GRID · SIMULATED', orbital: 'ORBITAL RELAY',
    seismic: 'SEISMIC WATCH', news: 'NEWS WIRE',
  };

  function renderModule() {
    const body = $('#geConsoleBody');
    if (!body) return;
    geSetText('geConsoleTitle', MODULE_TITLES[GE.module] || 'IRA // GRID');
    const data = GE.data;
    if (!data) return;
    body.textContent = '';
    const flights = blockData(data.flights, []);
    const military = blockData(data.military, []);
    const quakes = blockData(data.earthquakes, []);
    const natural = blockData(data.naturalEvents, []);
    const headlines = blockData(data.headlines, []);
    const cameras = blockData(data.cameras, []);
    const signals = blockData(data.traffic, { signals: [] }).signals || [];
    const iss = blockData(data.iss, null);
    const weather = blockData(data.weather, null);

    if (GE.module === 'overview') {
      const brief = document.createElement('div');
      brief.className = 'ge-card accent';
      brief.innerHTML = `<h4>GLOBAL BRIEF <span>${timeOf()} UTC</span></h4><p>${esc(data.brief)}</p>`;
      body.append(brief);

      const stats = document.createElement('div');
      stats.className = 'ge-card';
      stats.innerHTML = `<h4>GRID TELEMETRY <span>${data.elapsedMs || 0} MS</span></h4>
        <div class="row"><span>CIVIL AIRCRAFT</span><b>${flights.length}</b></div>
        <div class="row"><span>MILITARY AIRCRAFT</span><b>${military.length}</b></div>
        <div class="row"><span>SEISMIC EVENTS (24H)</span><b>${quakes.length}</b></div>
        <div class="row"><span>NASA NATURAL EVENTS</span><b>${natural.length}</b></div>
        <div class="row"><span>NEWS WIRE</span><b>${headlines.length}</b></div>
        <div class="row"><span>JUNCTIONS (SIM)</span><b>${signals.length}</b></div>
        <div class="row"><span>WEATHER · ${esc(weather ? weather.label : '—')}</span><b>${weather ? Math.round(weather.temperature) + '°C' : '—'}</b></div>
        <div class="row"><span>ISS ALTITUDE</span><b>${iss ? Math.round(iss.alt) + ' km' : '—'}</b></div>`;
      body.append(stats);

      const top = document.createElement('div');
      top.className = 'ge-card';
      top.innerHTML = '<h4>TOP SIGNALS <span>TAP TO PIN</span></h4>';
      headlines.slice(0, 6).forEach((item) => {
        top.append(geFeedItem(`${item.source || 'LIVE'} · ${item.topic || 'world'}`.toUpperCase(), item.title, () => {
          const marker = GE.markers.find((entry) => entry.kind === 'news' && entry.raw === item);
          if (marker) selectMarker(marker, $$('.ge-marker').find((node) => node.title.includes(marker.title.slice(0, 20))));
          else askGodsEye(`What is happening with: ${item.title}`);
          if (item.geo) focusOn(item.geo.lat, item.geo.lon, 2.4);
        }));
      });
      body.append(top);

      const help = document.createElement('div');
      help.className = 'ge-card';
      help.innerHTML = `<h4>HOW TO USE <span>KEYLESS</span></h4><p>Pick a module on the left, or ask me anything in the box above. Every pin on the map opens a dossier. Traffic signals and network nodes are simulations; aircraft, cameras, orbit, quakes, weather and news are live public feeds.</p>`;
      body.append(help);
      return;
    }

    if (GE.module === 'flights' || GE.module === 'military') {
      const source = GE.module === 'flights' ? flights : military;
      const block = GE.module === 'flights' ? data.flights : data.military;
      if (!block.ok) {
        body.append(feedRows(source, GE.module === 'flights' ? 'flights' : 'military'));
        return;
      }
      const card = document.createElement('div');
      card.className = 'ge-card';
      card.innerHTML = `<h4>${GE.module === 'flights' ? 'CIVIL' : 'MILITARY'} TRACKS <span>${source.length} LIVE</span></h4>`;
      source.slice(0, 60).forEach((aircraft) => {
        const title = `${aircraft.flight || aircraft.callsign || aircraft.hex} · ${aircraft.alt == null ? '—' : Math.round(aircraft.alt) + 'ft'} · ${aircraft.speed == null ? '—' : Math.round(aircraft.speed) + 'kt'}`;
        const item = GE.markers.find((marker) => marker.raw === aircraft);
        card.append(geFeedItem(`${aircraft.type || 'AC'} ${aircraft.operator || ''}`.trim().toUpperCase(), title,
          () => { if (item) { selectMarker(item, null); focusOn(item.lat, item.lon, 2.8); } },
          GE.module === 'flights' ? '#5fe6ff' : '#ffb95e'));
      });
      body.append(card);
      const note = document.createElement('div');
      note.className = 'ge-card';
      note.innerHTML = `<h4>FEED <span>${esc(block.source || '')} · ${block.ms} MS</span></h4><p>Live ADS-B positions. Aircraft over the selected regions refresh roughly every minute. Tap a track to lock the map onto it.</p>`;
      body.append(note);
      return;
    }

    if (GE.module === 'cameras') {
      renderCameras(body, cameras);
      return;
    }

    if (GE.module === 'traffic') {
      const card = document.createElement('div');
      card.className = 'ge-card';
      card.innerHTML = `<h4>TRAFFIC SIGNAL GRID <span>SIMULATED</span></h4><p>Signal phase is generated from the clock for ${signals.length} real junction coordinates. It is clearly a simulation, not municipal data — but the map, timers and load values behave like a live grid.</p>`;
      body.append(card);
      const grouped = signals.reduce((acc, signal) => {
        (acc[signal.city] = acc[signal.city] || []).push(signal);
        return acc;
      }, {});
      Object.entries(grouped).forEach(([city, list]) => {
        const section = document.createElement('div');
        section.className = 'ge-card';
        section.innerHTML = `<h4>${esc(city.toUpperCase())} <span>${list.length} JUNCTIONS</span></h4>`;
        list.forEach((signal) => {
          const row = document.createElement('div');
          row.className = 'row';
          row.dataset.signal = signal.id;
          row.innerHTML = `<span>${esc(signal.name)}</span><b style="color:${signal.state === 'red' ? '#ff8a8a' : signal.state === 'amber' ? '#ffd07a' : '#7dffb8'}">${signal.state.toUpperCase()} · ${Math.round(signal.remaining)}s</b>`;
          section.append(row);
        });
        body.append(section);
      });
      startSignalTicker();
      return;
    }

    if (GE.module === 'orbital') {
      const card = document.createElement('div');
      card.className = 'ge-card accent';
      if (!data.iss.ok || !iss) {
        card.innerHTML = `<h4>ORBITAL RELAY <span>OFFLINE</span></h4><p>${esc(data.iss.error || 'ISS feed unreachable')}</p>`;
      } else {
        card.innerHTML = `<h4>ISS · ZARYA <span>LIVE</span></h4>
          <div class="row"><span>LATITUDE</span><b>${iss.lat.toFixed(3)}°</b></div>
          <div class="row"><span>LONGITUDE</span><b>${iss.lon.toFixed(3)}°</b></div>
          <div class="row"><span>ALTITUDE</span><b>${Math.round(iss.alt)} km</b></div>
          <div class="row"><span>VELOCITY</span><b>${Math.round(iss.velocity).toLocaleString()} km/h</b></div>
          <div class="row"><span>VISIBILITY</span><b>${esc(iss.visibility || '—')}</b></div>
          <div class="ge-actions"><button type="button" data-act="focus">TRACK ISS</button></div>`;
      }
      body.append(card);
      card.querySelector('[data-act="focus"]')?.addEventListener('click', () => focusOn(iss.lat, iss.lon, 3));
      const note = document.createElement('div');
      note.className = 'ge-card';
      note.innerHTML = '<h4>ORBITAL LAYER <span>KEYLESS</span></h4><p>Position comes from the public wheretheiss.at relay. Add more satellites by extending ira_intel.py.</p>';
      body.append(note);
      return;
    }

    if (GE.module === 'seismic') {
      if (!data.earthquakes.ok) { body.append(feedRows(quakes, 'earthquakes')); return; }
      const card = document.createElement('div');
      card.className = 'ge-card';
      card.innerHTML = `<h4>USGS · M2.5+ / 24H <span>${quakes.length} EVENTS</span></h4>`;
      quakes.slice(0, 40).forEach((quake) => {
        const marker = GE.markers.find((entry) => entry.raw === quake);
        card.append(geFeedItem(`M${quake.mag} · ${timeOf(quake.time)} UTC`, quake.title, () => {
          if (marker) { selectMarker(marker, null); focusOn(marker.lat, marker.lon, 3); }
        }, '#ff8a5c'));
      });
      body.append(card);
      const naturalCard = document.createElement('div');
      naturalCard.className = 'ge-card';
      naturalCard.innerHTML = `<h4>NASA EONET <span>${natural.length} OPEN</span></h4>`;
      natural.slice(0, 14).forEach((event) => {
        naturalCard.append(geFeedItem(event.category, event.title, () => {
          const marker = GE.markers.find((entry) => entry.raw === event);
          if (marker) { selectMarker(marker, null); focusOn(marker.lat, marker.lon, 2.6); }
        }, '#ff5f7a'));
      });
      body.append(naturalCard);
      return;
    }

    if (GE.module === 'news') {
      const card = document.createElement('div');
      card.className = 'ge-card';
      card.innerHTML = `<h4>GLOBAL HEADLINES <span>${headlines.length} LIVE</span></h4>`;
      headlines.slice(0, 40).forEach((item) => {
        const marker = GE.markers.find((entry) => entry.kind === 'news' && entry.raw === item);
        card.append(geFeedItem(`${(item.source || 'LIVE').toUpperCase()} · ${(item.topic || 'world').toUpperCase()}`,
          item.title, () => {
            if (marker) { selectMarker(marker, null); focusOn(marker.lat, marker.lon, 2.4); }
            else askGodsEye(`Tell me more about this story: ${item.title}`);
          }, item.geo ? '#7ef0c8' : '#4f9fb0'));
      });
      body.append(card);
      if (data.headlines.error) {
        const error = document.createElement('div');
        error.className = 'ge-card';
        error.innerHTML = `<h4>FEED ERROR <span>OFFLINE</span></h4><p>${esc(data.headlines.error)}</p>`;
        body.append(error);
      }
      return;
    }
  }

  /* ---------- cameras ---------- */
  function renderCameras(body, cameras) {
    const intro = document.createElement('div');
    intro.className = 'ge-card';
    intro.innerHTML = `<h4>OPTIC WALL <span>NO API KEY</span></h4><p>Public broadcaster streams plus your own local optic. Nothing is stored or uploaded; the local camera is analysed inside the browser.</p>`;
    body.append(intro);

    cameras.forEach((camera) => {
      const tile = document.createElement('div');
      tile.className = 'ge-cam';
      tile.innerHTML = `<header><span>${esc(camera.name)} · ${esc(camera.city)}</span><span class="rec">● LIVE</span></header>
        <div class="frame" data-cam="${esc(camera.id)}"><div class="fallback">LIVE STREAM LOADS ON DEMAND</div></div>
        <footer><span>${esc(camera.country)} · PUBLIC FEED</span><a href="${esc(camera.watch)}" target="_blank" rel="noreferrer">OPEN ↗</a></footer>`;
      body.append(tile);
    });

    (GE.customCameras || []).forEach((url) => {
      try {
        const tile = document.createElement('div');
        tile.className = 'ge-cam';
        tile.innerHTML = `<header><span>SAVED EMBED · ${esc(new URL(url).hostname)}</span><span class="rec">● LIVE</span></header>
          <div class="frame"><iframe src="${esc(url)}" title="Saved camera" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" loading="lazy"></iframe></div>
          <footer><span>USER-SUPPLIED STREAM</span><a href="${esc(url)}" target="_blank" rel="noreferrer">OPEN ↗</a></footer>`;
        body.append(tile);
      } catch (error) { /* skip malformed saved url */ }
    });

    const addLocal = document.createElement('button');
    addLocal.type = 'button';
    addLocal.className = 'ge-cam-link';
    addLocal.textContent = '+ ACTIVATE LOCAL CAMERA (BROWSER ONLY)';
    addLocal.addEventListener('click', startLocalCamera);
    body.append(addLocal);

    const addCustom = document.createElement('button');
    addCustom.type = 'button';
    addCustom.className = 'ge-cam-link';
    addCustom.textContent = '+ ADD A CUSTOM EMBED URL';
    addCustom.addEventListener('click', addCustomCamera);
    body.append(addCustom);

    const note = document.createElement('div');
    note.className = 'ge-card';
    note.innerHTML = `<h4>CAMERA NOTES <span>HONEST LABELS</span></h4><p>These are public YouTube live channels; some broadcasters block embedding in which case the tile shows the fallback text and the OPEN link still works. Add any embeddable stream URL with the button above — saved locally on this device.</p>`;
    body.append(note);

    // load any camera that was already opened
    GE.cameras.forEach((_, id) => openCamera(id));
  }

  function openCamera(id) {
    const frame = $(`[data-cam="${id}"]`);
    if (!frame || frame.dataset.loaded) return;
    const camera = GE.data && blockData(GE.data.cameras, []).find((entry) => entry.id === id);
    if (!camera) return;
    frame.dataset.loaded = '1';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(camera.channel)}&autoplay=1&mute=1&playsinline=1`;
    iframe.title = `${camera.name} live feed`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.addEventListener('error', () => { iframe.remove(); });
    frame.textContent = '';
    frame.append(iframe);
    GE.cameras.set(id, true);
  }

  function addCustomCamera() {
    const url = prompt('Paste an embeddable live stream URL (iframe / YouTube embed):');
    if (!url) return;
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('http(s) only');
    } catch (error) {
      if (typeof toast === 'function') toast('That does not look like a valid URL.');
      return;
    }
    const body = $('#geConsoleBody');
    if (!body) return;
    const tile = document.createElement('div');
    tile.className = 'ge-cam';
    tile.innerHTML = `<header><span>CUSTOM EMBED · ${esc(new URL(url).hostname)}</span><span class="rec">● LIVE</span></header>
      <div class="frame"><iframe src="${esc(url)}" title="Custom camera" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" loading="lazy"></iframe></div>
      <footer><span>USER-SUPPLIED STREAM</span><a href="${esc(url)}" target="_blank" rel="noreferrer">OPEN ↗</a></footer>`;
    body.prepend(tile);
    const saved = JSON.parse(localStorage.getItem('iraCustomCameras') || '[]');
    saved.push(url);
    localStorage.setItem('iraCustomCameras', JSON.stringify(saved.slice(-6)));
    if (typeof toast === 'function') toast('Custom feed added.');
  }

  async function startLocalCamera() {
    const body = $('#geConsoleBody');
    if (!body) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof toast === 'function') toast('This browser has no camera access.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      GE.localStream = stream;
      const tile = document.createElement('div');
      tile.className = 'ge-cam';
      tile.innerHTML = `<header><span>LOCAL OPTIC · THIS DEVICE</span><span class="rec">● REC</span></header>
        <div class="frame"></div>
        <div class="vision">
          <div>BRIGHTNESS<b data-vision="brightness">--</b></div>
          <div>MOTION<b data-vision="motion">--</b></div>
          <div>STATE<b data-vision="state">--</b></div>
        </div>
        <footer><span>PROCESSED IN BROWSER · NEVER UPLOADED</span><button type="button" class="ge-cam-link" style="width:auto;padding:2px 6px">STOP</button></footer>`;
      const video = document.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.srcObject = stream;
      tile.querySelector('.frame').append(video);
      tile.querySelector('footer button').addEventListener('click', () => {
        stream.getTracks().forEach((track) => track.stop());
        if (GE.localFrame) cancelAnimationFrame(GE.localFrame);
        GE.localFrame = null;
        tile.remove();
      });
      body.prepend(tile);
      analyseLocalFrame(video, tile);
      if (typeof toast === 'function') toast('Local optic active — analysed on this device only.');
    } catch (error) {
      if (typeof toast === 'function') toast('Camera permission was denied or unavailable.');
    }
  }

  function analyseLocalFrame(video, tile) {
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 54;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let previous = null;
    const brightnessNode = tile.querySelector('[data-vision="brightness"]');
    const motionNode = tile.querySelector('[data-vision="motion"]');
    const stateNode = tile.querySelector('[data-vision="state"]');
    let last = 0;

    function frame(now) {
      if (!tile.isConnected) return;
      GE.localFrame = requestAnimationFrame(frame);
      if (now - last < 220) return;
      last = now;
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0, delta = 0;
      const current = new Uint8ClampedArray(data.length);
      current.set(data);
      for (let i = 0; i < data.length; i += 4) {
        const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        sum += luma;
        if (previous) delta += Math.abs(luma - (previous[i] * 0.299 + previous[i + 1] * 0.587 + previous[i + 2] * 0.114));
      }
      const pixels = data.length / 4;
      const brightness = (sum / pixels / 255) * 100;
      const motion = previous ? (delta / pixels / 255) * 100 : 0;
      previous = current;
      if (brightnessNode) brightnessNode.textContent = Math.round(brightness) + '%';
      if (motionNode) motionNode.textContent = Math.min(100, Math.round(motion * 3)) + '%';
      if (stateNode) stateNode.textContent = motion > 4 ? 'ACTIVE' : brightness < 12 ? 'DARK' : 'STATIC';
    }
    GE.localFrame = requestAnimationFrame(frame);
  }

  /* ---------- traffic ticker ---------- */
  function startSignalTicker() {
    if (GE.moduleTimer) clearInterval(GE.moduleTimer);
    GE.moduleTimer = setInterval(() => {
      if (typeof state !== 'undefined' && state.mode !== 'godseye') return;
      if (GE.module !== 'traffic' || !GE.data) return;
      const signals = blockData(GE.data.traffic, { signals: [] }).signals || [];
      const elapsed = (Date.now() - GE.data.generatedAt * 1000) / 1000;
      const cycle = 84;
      signals.forEach((signal) => {
        // rebuild the phase inside the 84 s cycle, then advance by elapsed time
        const phase0 = signal.state === 'green' ? 44 - signal.remaining
          : signal.state === 'amber' ? 52 - signal.remaining
            : cycle - signal.remaining;
        const phase = ((phase0 + elapsed) % cycle + cycle) % cycle;
        let state = 'red';
        let remaining = cycle - phase;
        if (phase < 44) { state = 'green'; remaining = 44 - phase; }
        else if (phase < 52) { state = 'amber'; remaining = 52 - phase; }
        const row = $(`.ge-console-body .row[data-signal="${signal.id}"] b`);
        if (row) {
          row.textContent = `${state.toUpperCase()} · ${Math.ceil(remaining)}s`;
          row.style.color = state === 'red' ? '#ff8a8a' : state === 'amber' ? '#ffd07a' : '#7dffb8';
        }
        const pin = $$('.ge-marker.traffic').find((node) => node.title.startsWith(signal.name));
        if (pin) {
          pin.classList.remove('red', 'amber', 'green');
          pin.classList.add(state);
          pin.title = `${signal.name} · ${state.toUpperCase()} · ${Math.ceil(remaining)}s`;
        }
      });
    }, 1000);
  }

  /* ---------- search / ask ---------- */
  function geSetChips() {
    const data = GE.data;
    if (!data) return;
    const layers = ['weather', 'headlines', 'flights', 'military', 'earthquakes', 'naturalEvents', 'iss'];
    const ok = layers.filter((key) => feedOk(data[key])).length;
    const chip = $('#geChipFeeds');
    if (chip) {
      chip.className = 'ge-chip ' + (ok >= 5 ? '' : ok >= 3 ? 'warn' : 'bad');
      chip.innerHTML = `<i></i> FEEDS ${ok}/${layers.length}`;
    }
    const status = GE.lastStatus;
    const brainChip = $('#geChipBrain');
    if (brainChip) {
      const connected = status && status.brain && status.brain.connected;
      brainChip.className = 'ge-chip ' + (connected ? '' : 'warn');
      brainChip.innerHTML = `<i></i> CLOUD BRAIN ${connected ? 'LINKED' : 'FALLBACK'}`;
    }
    const quakes = blockData(data.earthquakes, []);
    const threat = $('#geChipThreat');
    if (threat) {
      const strongest = quakes[0] ? quakes[0].mag : 0;
      const level = strongest >= 6 ? 'CRITICAL' : strongest >= 5 ? 'HIGH' : 'ELEVATED';
      threat.className = 'ge-chip ' + (strongest >= 6 ? 'bad' : strongest >= 5 ? 'warn' : '');
      threat.innerHTML = `<i></i> THREAT · ${level}`;
    }
    const brainState = $('#geBrainState');
    if (brainState) {
      const connected = status && status.brain && status.brain.connected;
      brainState.className = connected ? '' : 'off';
      brainState.textContent = connected ? 'CLOUD BRAIN LINKED' : 'LOCAL GRID MODE';
      const detail = $('#geBrainDetail');
      if (detail) detail.textContent = connected
        ? 'Hosted cloud brain online. No API key is used.'
        : 'Cloud brain unreachable — live intelligence composer answers instead.';
    }
  }

  function renderTicker() {
    const track = $('#geTicker');
    if (!track || !GE.data) return;
    const headlines = blockData(GE.data.headlines, []);
    if (!headlines.length) {
      track.innerHTML = '<button type="button">NEWS FEED RECONNECTING…</button>';
      return;
    }
    const items = headlines.slice(0, 14);
    track.innerHTML = [...items, ...items].map((item, index) => (
      `<button type="button" data-ticker="${index % items.length}"><b>${esc((item.source || 'LIVE').toUpperCase())}</b>${esc(item.title)}</button>`
    )).join('');
    $$('[data-ticker]', track).forEach((button) => button.addEventListener('click', () => {
      const item = items[Number(button.dataset.ticker)];
      if (!item) return;
      const marker = GE.markers.find((entry) => entry.kind === 'news' && entry.raw === item);
      if (marker) { GE.module = 'news'; syncModules(); renderModule(); selectMarker(marker, null); focusOn(marker.lat, marker.lon, 2.4); }
      else askGodsEye(`Tell me more about this headline: ${item.title}`);
    }));
  }

  function renderGeData(data) {
    GE.data = data;
    geSetText('geBrief', data.brief);
    geSetText('geBriefTime', `${timeOf()} UTC`);
    rebuildMarkers();
    renderModule();
    renderTicker();
    geSetChips();
  }

  function syncModules() {
    $$('.ge-module').forEach((button) => button.classList.toggle('active', button.dataset.module === GE.module));
    geSetText('geConsoleMeta', GE.module === 'traffic' ? 'SIMULATED LAYER' : 'GLOBAL GRID · LIVE');
  }

  async function geSearch(query) {
    const text = String(query || '').trim();
    if (!text) return;
    const body = $('#geConsoleBody');
    if (body) {
      body.textContent = '';
      const pending = document.createElement('div');
      pending.className = 'ge-card accent';
      pending.innerHTML = `<h4>IRA // SEARCHING <span>${esc(text.toUpperCase().slice(0, 28))}</span></h4><p>Querying the live grid, then the cloud brain…</p>`;
      body.append(pending);
    }
    geSetText('geConsoleTitle', 'IRA // QUERY');
    try {
      const result = await IRAIntel.ask(text, { mode: 'auto' });
      if (body) body.textContent = '';
      const card = document.createElement('div');
      card.className = 'ge-card accent';
      card.innerHTML = `<h4>IRA ANSWER <span>${esc((result.engine || 'brain').toUpperCase())}</span></h4><p>${esc(result.answer)}</p>
        ${result.source ? `<div class="ge-actions"><a href="${esc(result.source)}" target="_blank" rel="noreferrer">OPEN SOURCE ↗</a></div>` : ''}`;
      if (body) body.append(card);

      const markers = (result.markers || []).filter((marker) => typeof marker.lat === 'number' && typeof marker.lon === 'number');
      if (markers.length) {
        GE.dynamic = [...markers.slice(0, 40), ...GE.dynamic].slice(0, 80);
        rebuildMarkers();
        const first = markers[0];
        focusOn(first.lat, first.lon, 2.3);
        if (body) {
          const listCard = document.createElement('div');
          listCard.className = 'ge-card';
          listCard.innerHTML = `<h4>PINS FROM THIS ANSWER <span>${markers.length}</span></h4>`;
          markers.forEach((marker) => {
            listCard.append(geFeedItem(marker.type, marker.title || 'Pin', () => focusOn(marker.lat, marker.lon, 3), '#7ef0c8'));
          });
          body.append(listCard);
        }
      }
      if (typeof state !== 'undefined') state.lastReply = result.answer;
      if ($('#voiceToggle') && $('#voiceToggle').checked && typeof speak === 'function') speak(result.answer);
      return result;
    } catch (error) {
      if (body) {
        body.textContent = '';
        const card = document.createElement('div');
        card.className = 'ge-card';
        card.innerHTML = `<h4>QUERY FAILED <span>OFFLINE</span></h4><p>${esc(error.message)}</p>`;
        body.append(card);
      }
      return null;
    }
  }

  function askGodsEye(question) {
    return geSearch(question);
  }

  function initGodsEye() {
    if (GE.ready) return;
    GE.ready = true;

    // clock
    const clock = () => {
      const now = new Date();
      geSetText('geDate', now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
      geSetText('geTime', now.toUTCString().slice(17, 25) + ' UTC');
    };
    clock();
    setInterval(clock, 1000);

    // modules
    $$('.ge-module').forEach((button) => button.addEventListener('click', () => {
      GE.module = button.dataset.module;
      syncModules();
      renderModule();
      if (GE.module === 'cameras' && GE.data) {
        // load the two most useful feeds straight away
        const cameras = blockData(GE.data.cameras, []);
        cameras.slice(0, 2).forEach((camera) => setTimeout(() => openCamera(camera.id), 350));
      }
    }));

    // layers
    const map = $('#geMap');
    $$('.ge-layer input').forEach((input) => input.addEventListener('change', () => {
      if (!map) return;
      const layer = input.dataset.layer;
      map.classList.toggle('hide-' + layer, !input.checked);
      map.classList.toggle('hide-' + (layer === 'earthquakes' ? 'earthquakes' : layer), !input.checked);
    }));

    // pan + zoom
    let dragging = false, lastX = 0, lastY = 0, moved = false;
    if (map) {
      map.addEventListener('wheel', (event) => {
        event.preventDefault();
        GE.view.scale = clamp(GE.view.scale * (event.deltaY < 0 ? 1.12 : 0.9), 1, 4.5);
        if (GE.view.scale === 1) { GE.view.x = 0; GE.view.y = 0; }
        applyMapView();
      }, { passive: false });
      map.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        dragging = true; moved = false;
        lastX = event.clientX; lastY = event.clientY;
        map.setPointerCapture(event.pointerId);
      });
      map.addEventListener('pointermove', (event) => {
        const rect = map.getBoundingClientRect();
        const lon = ((event.clientX - rect.left) / rect.width) * 360 - 180;
        const lat = 90 - ((event.clientY - rect.top) / rect.height) * 180;
        geSetText('geCursorLat', `${lat.toFixed(2)}°`);
        geSetText('geCursorLon', `${lon.toFixed(2)}°`);
        if (!dragging || GE.view.scale === 1) return;
        moved = true;
        GE.view.x += event.clientX - lastX;
        GE.view.y += event.clientY - lastY;
        lastX = event.clientX; lastY = event.clientY;
        applyMapView();
      });
      map.addEventListener('pointerup', () => { dragging = false; });
      map.addEventListener('pointercancel', () => { dragging = false; });
      $$('.ge-zoom button').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.zoom;
        if (action === 'reset') { GE.view = { scale: 1, x: 0, y: 0 }; }
        else if (action === 'in') { GE.view.scale = clamp(GE.view.scale * 1.3, 1, 4.5); }
        else if (action === 'out') {
          GE.view.scale = clamp(GE.view.scale * 0.78, 1, 4.5);
          if (GE.view.scale === 1) { GE.view.x = 0; GE.view.y = 0; }
        } else if (action === 'mode') {
          const traffic = $('.ge-layer input[data-layer="traffic"]');
          if (traffic) {
            traffic.checked = !traffic.checked;
            traffic.dispatchEvent(new Event('change'));
            if (typeof toast === 'function') toast('Traffic signal layer is a labelled simulation.');
          }
        }
        applyMapView();
      }));
      map.addEventListener('click', () => { if (!moved) { /* keep dossier open */ } });
    }

    // search + ask
    const searchForm = $('#geSearchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = $('#geSearch');
        const value = input.value.trim();
        if (!value) return;
        input.value = '';
        geSearch(value);
      });
    }
    const askForm = $('#geAskForm');
    if (askForm) {
      askForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = $('#geAsk');
        const value = input.value.trim();
        if (!value) return;
        input.value = '';
        geSearch(value);
      });
    }
    const mic = $('#geMic');
    if (mic) mic.addEventListener('click', () => { const target = $('#micBtn'); if (target) target.click(); });

    try {
      const saved = JSON.parse(localStorage.getItem('iraCustomCameras') || '[]');
      if (Array.isArray(saved) && saved.length) GE.customCameras = saved;
    } catch (error) { /* ignore malformed storage */ }

    IRAIntel.on(renderGeData);
    IRAIntel.load().catch((error) => {
      const body = $('#geConsoleBody');
      if (body) {
        body.textContent = '';
        const card = document.createElement('div');
        card.className = 'ge-card';
        card.innerHTML = `<h4>GRID OFFLINE <span>NO SERVER</span></h4><p>Start the interface with <b>python ira_server.py</b> so the live feeds can be served. ${esc(error.message)}</p>`;
        body.append(card);
      }
      const chip = $('#geChipFeeds');
      if (chip) { chip.className = 'ge-chip bad'; chip.innerHTML = '<i></i> FEEDS OFFLINE'; }
    });
    IRAIntel.statusOnce().then((status) => {
      GE.lastStatus = status;
      geSetChips();
    });

    // keep the grid warm
    setInterval(() => {
      if (typeof state !== 'undefined' && state.mode !== 'godseye') return;
      IRAIntel.load();
      IRAIntel.statusOnce(true).then((status) => { GE.lastStatus = status; geSetChips(); });
    }, 120000);

    setTimeout(() => { applyMapView(); }, 80);
    window.iraGodsEyeResize = applyMapView;
  }

  window.iraGodsEyeEnter = function () {
    initGodsEye();
    if (!GE.data) {
      IRAIntel.load().catch(() => {});
    }
    setTimeout(applyMapView, 40);
  };
  window.askGodsEye = askGodsEye;
  window.IRA_GE = {
    addMarkers(markers) {
      if (!Array.isArray(markers)) return;
      GE.dynamic = [...markers.slice(0, 40), ...GE.dynamic].slice(0, 80);
      if (GE.data && (typeof state === 'undefined' || state.mode === 'godseye')) rebuildMarkers();
      if (typeof toast === 'function') toast(`${markers.length} pin${markers.length === 1 ? '' : 's'} added to God's Eye.`);
    },
    focusOn,
    state: GE,
  };

  /* ------------------------------------------------------------------------
     Boot: initialise lazily so the original interfaces stay fast
     --------------------------------------------------------------------- */
  function bootIfNeeded() {
    if (typeof state === 'undefined') return;
    if (state.mode === 'holo') window.iraHoloEnter();
    if (state.mode === 'godseye') window.iraGodsEyeEnter();
  }

  // quick jump buttons in the top bar
  $$('.mode-jump').forEach((button) => button.addEventListener('click', () => {
    if (typeof setMode === 'function') {
      setMode(button.dataset.jump);
      if (typeof toast === 'function') toast(`${button.textContent.trim()} interface online.`);
      if (typeof closeLayers === 'function') setTimeout(closeLayers, 180);
      bootIfNeeded();
    }
  }));

  // keep both UI canvases sized when the window changes
  addEventListener('resize', () => {
    if (window.iraHoloResize && typeof state !== 'undefined' && state.mode === 'holo') window.iraHoloResize();
    if (window.iraGodsEyeResize && typeof state !== 'undefined' && state.mode === 'godseye') window.iraGodsEyeResize();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootIfNeeded, 60));
  } else {
    setTimeout(bootIfNeeded, 60);
  }
})();
