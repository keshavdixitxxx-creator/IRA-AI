/* IRA EDEX Command Deck — terminal, globe, diagnostics, apps, and news relay. */
(() => {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const HOME = { lat: 28.6139, lon: 77.2090, label: 'IRA · New Delhi', kind: 'home' };
  const CHANNELS = [
    { name: 'DW NEWS', channel: 'UCknLrEdhRCp1aegoMqRaCZg' },
    { name: 'AL JAZEERA', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
    { name: 'SKY NEWS', channel: 'UCoMdktPbSTixAyNGwb-UYkQ' },
    { name: 'NDTV 24×7', channel: 'UCZFMm1mMw0F81Z37aaEzTUA' },
  ];

  let initialized = false;
  let active = false;
  let clockTimer = null;
  let terminalBusy = false;

  function modeIsActive() {
    return typeof state !== 'undefined' && state.mode === 'edex';
  }

  function setStatus(element, text, kind = '') {
    if (!element) return;
    element.textContent = text;
    element.classList.remove('online', 'live', 'warn', 'error');
    if (kind) element.classList.add(kind);
  }

  function timeCode() {
    return new Date().toUTCString().slice(17, 25);
  }

  function tickClock() {
    const now = new Date();
    $('#edexClock').textContent = now.toUTCString().slice(17, 25);
    $('#edexDate').textContent = now.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).toUpperCase() + ' · UTC';
  }

  /* ------------------------------------------------------------------ terminal */
  function addTerminalLine(role, text) {
    const log = $('#edexTerminalLog');
    const line = document.createElement('div');
    line.className = `edex-terminal-line ${role}`;
    const meta = document.createElement('div');
    meta.className = 'edex-line-meta';
    const label = document.createElement('b');
    const names = {
      system: 'SYSTEM', user: (state.userTitle || 'Commander').toUpperCase(),
      assistant: 'IRA', thinking: 'IRA · LINK', error: 'ERROR',
    };
    label.textContent = names[role] || 'IRA';
    const stamp = document.createElement('span');
    stamp.textContent = timeCode();
    meta.append(label, stamp);
    const body = document.createElement('p');
    body.className = 'edex-line-text';
    body.textContent = text;
    line.append(meta, body);
    log.appendChild(line);
    while (log.children.length > 80) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    return line;
  }

  function resolveTerminalLine(line, text, source) {
    line.classList.remove('thinking');
    line.classList.add('assistant');
    const body = $('.edex-line-text', line);
    body.textContent = text;
    if (source && /^https?:\/\//i.test(source)) {
      const link = document.createElement('a');
      link.href = source;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'OPEN SOURCE ↗';
      body.appendChild(document.createElement('br'));
      body.appendChild(link);
    }
    $('#edexTerminalLog').scrollTop = $('#edexTerminalLog').scrollHeight;
  }

  function formatUptime(seconds) {
    if (!seconds) return '--:--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days ? `${days}D ${hours}H` : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function formatNetwork(kbps) {
    const value = Number(kbps) || 0;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} Mbps`;
    return `${value.toFixed(value >= 100 ? 0 : 1)} Kbps`;
  }

  function runTerminalCommand(command) {
    if (command === '/clear') {
      $('#edexTerminalLog').textContent = '';
      addTerminalLine('system', 'Terminal cleared. IRA cloud relay remains connected.');
      return true;
    }
    if (command === '/help') {
      addTerminalLine('assistant', [
        'Talk to me naturally, or use one of these terminal commands:',
        '/news    — current world briefing',
        '/status  — latest system diagnostics',
        '/clear   — clear this conversation view',
        '/help    — show this command guide',
        '',
        'You can also use the microphone, launch apps with confirmation, drag the globe, or select a news channel.',
      ].join('\n'));
      return true;
    }
    if (command === '/news') {
      askEdex('Give me a concise world news briefing');
      return true;
    }
    if (command === '/status') {
      const data = diagnostics.latest;
      if (!data) {
        addTerminalLine('system', 'No diagnostics sample yet. The system probe is still connecting.');
      } else {
        addTerminalLine('assistant', [
          `CPU: ${Number(data.cpuPercent).toFixed(1)}%`,
          `Memory: ${Number(data.memoryPercent).toFixed(1)}%`,
          `Network: ${formatNetwork(data.networkKbps)}`,
          `Processes: ${data.processes || 'unavailable'}`,
          `Uptime: ${formatUptime(data.uptimeSeconds)}`,
          `Source: ${String(data.source).toUpperCase()}`,
        ].join('\n'));
      }
      return true;
    }
    if (command.startsWith('/')) {
      addTerminalLine('system', `Unknown command: ${command}. Type /help for available commands.`);
      return true;
    }
    return false;
  }

  async function askEdex(question) {
    const text = String(question || '').trim();
    if (!text) return null;
    if (terminalBusy) {
      addTerminalLine('system', 'IRA is still answering the previous message. Please wait a moment.');
      return null;
    }
    $('#edexPromptName').textContent = (state.userTitle || 'Commander').toLowerCase().replace(/\s+/g, '-');
    addTerminalLine('user', text);
    if (runTerminalCommand(text.toLowerCase())) return { answer: state.lastReply, engine: 'local-command' };

    terminalBusy = true;
    setStatus($('#edexTerminalStatus'), 'IRA THINKING', 'warn');
    const pending = addTerminalLine('thinking', 'Establishing cloud-brain relay…');
    try {
      const result = await askIRA(text);
      resolveTerminalLine(pending, state.lastReply, result && result.source);
      setStatus($('#edexTerminalStatus'), 'READY', 'online');
      return result;
    } catch (error) {
      pending.classList.remove('thinking');
      pending.classList.add('error');
      $('.edex-line-text', pending).textContent = `Relay failure: ${error.message || error}`;
      setStatus($('#edexTerminalStatus'), 'RELAY ERROR', 'error');
      return null;
    } finally {
      terminalBusy = false;
      if (!terminalBusy) setStatus($('#edexTerminalStatus'), 'READY', 'online');
    }
  }

  /* --------------------------------------------------------------- diagnostics */
  const diagnostics = {
    latest: null, pending: false, timer: null,
    cpu: [], memory: [], network: [],
  };

  function simulatedDiagnostics() {
    const t = Date.now() / 4000;
    return {
      ok: true, source: 'simulation', cpuEstimated: true,
      cpuPercent: 32 + Math.sin(t) * 13 + Math.sin(t * 2.4) * 5,
      memoryPercent: 57 + Math.sin(t * .37) * 6,
      networkKbps: 160 + Math.sin(t * 1.7) * 95 + Math.cos(t * .8) * 35,
      processes: 0, uptimeSeconds: 0, loadAverage: 0,
      platform: 'Browser', timestamp: Math.floor(Date.now() / 1000),
    };
  }

  function pushSample(target, value, maximum = 30) {
    target.push(Math.max(0, Number(value) || 0));
    if (target.length > maximum) target.shift();
  }

  function applyDiagnostics(data) {
    diagnostics.latest = data;
    pushSample(diagnostics.cpu, data.cpuPercent);
    pushSample(diagnostics.memory, data.memoryPercent);
    pushSample(diagnostics.network, data.networkKbps);
    $('#edexCpuValue').textContent = `${Number(data.cpuPercent).toFixed(1)}%`;
    $('#edexMemoryValue').textContent = `${Number(data.memoryPercent).toFixed(1)}%`;
    $('#edexNetworkValue').textContent = formatNetwork(data.networkKbps);
    $('#edexProcesses').textContent = data.processes ? String(data.processes) : 'N/A';
    $('#edexUptime').textContent = formatUptime(data.uptimeSeconds);
    $('#edexPlatform').textContent = String(data.platform || 'Unknown').toUpperCase();
    $('#edexLoadAverage').textContent = Number(data.loadAverage || 0).toFixed(2);
    const source = String(data.source || 'system').toUpperCase();
    setStatus($('#edexDiagSource'), source, source === 'SIMULATION' || source === 'ESTIMATED' ? 'warn' : 'live');
    $('#edexFooterDiag').textContent = `DIAGNOSTICS · ${source}`;
    $('#edexMemoryValue').title = data.memoryTotal
      ? `${(data.memoryUsed / 1073741824).toFixed(1)} / ${(data.memoryTotal / 1073741824).toFixed(1)} GiB`
      : 'Memory utilization';
    drawDiagnosticsChart();
  }

  async function sampleDiagnostics() {
    if (!active || diagnostics.pending) return;
    diagnostics.pending = true;
    try {
      const response = await fetch('/api/diagnostics', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Diagnostics unavailable');
      applyDiagnostics(data);
    } catch (error) {
      applyDiagnostics(simulatedDiagnostics());
    } finally {
      diagnostics.pending = false;
    }
  }

  function drawDiagnosticsChart() {
    const canvas = $('#edexDiagnosticsChart');
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const left = 18, right = 7, top = 9, bottom = 13;
    const graphWidth = width - left - right;
    const graphHeight = height - top - bottom;
    ctx.font = '5px Space Grotesk, monospace';
    ctx.lineWidth = .6;
    for (let i = 0; i <= 4; i++) {
      const y = top + graphHeight * i / 4;
      ctx.strokeStyle = 'rgba(121,230,237,.09)';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillStyle = 'rgba(102,147,153,.55)';
      ctx.fillText(String(100 - i * 25), 1, y + 2);
    }
    for (let i = 0; i <= 5; i++) {
      const x = left + graphWidth * i / 5;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - bottom); ctx.stroke();
    }
    const networkMax = Math.max(100, ...diagnostics.network);
    const series = [
      { values: diagnostics.cpu, color: '#79e6ed', max: 100 },
      { values: diagnostics.memory, color: '#b5a4ff', max: 100 },
      { values: diagnostics.network, color: '#ffc76a', max: networkMax },
    ];
    series.forEach(({ values, color, max }, seriesIndex) => {
      if (values.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.15;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = left + graphWidth * index / 29;
        const y = top + graphHeight * (1 - Math.min(100, value / max * 100) / 100);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (seriesIndex === 0) {
        const last = values[values.length - 1];
        const x = left + graphWidth * (values.length - 1) / 29;
        const y = top + graphHeight * (1 - Math.min(100, last) / 100);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  /* --------------------------------------------------------------------- globe */
  const globe = {
    land: [], markers: [HOME], rotation: -77.2, tilt: -13,
    rotating: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    dragging: false, lastX: 0, lastY: 0, frame: null, lastFrame: 0,
    worldLoaded: false, intelLoaded: false,
    stars: Array.from({ length: 45 }, (_, index) => ({
      x: ((index * 73) % 997) / 997, y: ((index * 137) % 991) / 991,
      alpha: .12 + (index % 5) * .055,
    })),
  };

  function projectGlobe(lat, lon, cx, cy, radius) {
    const latitude = lat * Math.PI / 180;
    const longitude = (lon + globe.rotation) * Math.PI / 180;
    const tilt = globe.tilt * Math.PI / 180;
    const x = Math.cos(latitude) * Math.sin(longitude);
    const rawY = Math.sin(latitude);
    const rawZ = Math.cos(latitude) * Math.cos(longitude);
    const y = rawY * Math.cos(tilt) - rawZ * Math.sin(tilt);
    const z = rawY * Math.sin(tilt) + rawZ * Math.cos(tilt);
    return { x: cx + x * radius, y: cy - y * radius, z };
  }

  function traceCoordinates(ctx, coordinates, cx, cy, radius, dots = false) {
    let open = false;
    coordinates.forEach(([lon, lat]) => {
      const point = projectGlobe(lat, lon, cx, cy, radius);
      if (point.z <= .015) { open = false; return; }
      if (!open) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      open = true;
      if (dots) ctx.fillRect(point.x - .45, point.y - .45, .9, .9);
    });
  }

  function drawGlobe(now = 0) {
    const canvas = $('#edexGlobe');
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2 - 2;
    const radius = Math.max(45, Math.min(width, height) * .405);

    globe.stars.forEach(star => {
      ctx.fillStyle = `rgba(121,230,237,${star.alpha})`;
      ctx.fillRect(star.x * width, star.y * height, 1, 1);
    });
    const glow = ctx.createRadialGradient(cx - radius * .25, cy - radius * .3, 2, cx, cy, radius * 1.15);
    glow.addColorStop(0, 'rgba(44,109,116,.22)');
    glow.addColorStop(.65, 'rgba(8,30,37,.42)');
    glow.addColorStop(1, 'rgba(1,6,9,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(3,15,21,.82)'; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

    ctx.lineWidth = .45;
    ctx.strokeStyle = 'rgba(106,193,199,.16)';
    for (let lat = -60; lat <= 60; lat += 20) {
      const points = []; for (let lon = -180; lon <= 180; lon += 4) points.push([lon, lat]);
      ctx.beginPath(); traceCoordinates(ctx, points, cx, cy, radius); ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 20) {
      const points = []; for (let lat = -88; lat <= 88; lat += 3) points.push([lon, lat]);
      ctx.beginPath(); traceCoordinates(ctx, points, cx, cy, radius); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(135,226,207,.48)';
    ctx.fillStyle = 'rgba(135,226,207,.45)';
    ctx.lineWidth = .55;
    globe.land.forEach(ring => {
      ctx.beginPath(); traceCoordinates(ctx, ring, cx, cy, radius, true); ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(121,230,237,.4)';
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(121,230,237,.1)';
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * 1.18, radius * .28, now * .00008, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    globe.markers.forEach(marker => {
      const point = projectGlobe(marker.lat, marker.lon, cx, cy, radius);
      if (point.z <= 0) return;
      const home = marker.kind === 'home';
      const pulse = home ? 4 + Math.sin(now * .004) * 1.5 : 2.5;
      const color = home ? '#a3f3cf' : marker.kind === 'seismic' ? '#ffc76a' : '#ff8f86';
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineWidth = home ? 1 : .65;
      ctx.beginPath(); ctx.arc(point.x, point.y, pulse + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(point.x, point.y, home ? 2 : 1.2, 0, Math.PI * 2); ctx.fill();
      if (home) {
        ctx.fillStyle = 'rgba(190,241,222,.85)'; ctx.font = '5px Space Grotesk, monospace';
        ctx.fillText('IRA / DELHI', point.x + 7, point.y - 6);
      }
    });
  }

  function animateGlobe(now) {
    if (!active) return;
    const elapsed = Math.min(50, now - (globe.lastFrame || now));
    globe.lastFrame = now;
    if (globe.rotating && !globe.dragging) globe.rotation -= elapsed * .0025;
    drawGlobe(now);
    globe.frame = requestAnimationFrame(animateGlobe);
  }

  async function loadWorld() {
    if (globe.worldLoaded) return;
    globe.worldLoaded = true;
    try {
      const response = await fetch('./data/world.geo.json', { cache: 'force-cache' });
      if (!response.ok) throw new Error('World map unavailable');
      const data = await response.json();
      const rings = [];
      (data.features || []).forEach(feature => {
        const geometry = feature.geometry || {};
        if (geometry.type === 'Polygon') rings.push(...(geometry.coordinates || []).slice(0, 1));
        if (geometry.type === 'MultiPolygon') (geometry.coordinates || []).forEach(polygon => rings.push(...polygon.slice(0, 1)));
      });
      globe.land = rings;
      setStatus($('#edexGlobeStatus'), globe.markers.length > 1 ? `${globe.markers.length - 1} LIVE SIGNALS` : 'HOME NODE', 'live');
    } catch (error) {
      globe.worldLoaded = false;
      setStatus($('#edexGlobeStatus'), 'MAP OFFLINE', 'warn');
    }
  }

  async function loadGlobeIntel() {
    if (globe.intelLoaded || !active) return;
    globe.intelLoaded = true;
    try {
      const response = await fetch('/api/intel?full=0', { cache: 'no-store', signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error('Live signals unavailable');
      const data = await response.json();
      const markers = [HOME];
      const add = (items, kind, limit) => (Array.isArray(items) ? items : []).slice(0, limit).forEach(item => {
        if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) markers.push({ ...item, kind });
      });
      if (data.earthquakes && data.earthquakes.ok) add(data.earthquakes.data, 'seismic', 28);
      if (data.naturalEvents && data.naturalEvents.ok) add(data.naturalEvents.data, 'natural', 14);
      if (data.iss && data.iss.ok && data.iss.data) add([data.iss.data], 'orbit', 1);
      globe.markers = markers;
      setStatus($('#edexGlobeStatus'), markers.length > 1 ? `${markers.length - 1} LIVE SIGNALS` : 'HOME NODE · FEEDS OFFLINE', markers.length > 1 ? 'live' : 'warn');
    } catch (error) {
      setStatus($('#edexGlobeStatus'), 'HOME NODE · FEEDS OFFLINE', 'warn');
    }
  }

  function initGlobeControls() {
    const canvas = $('#edexGlobe');
    canvas.addEventListener('pointerdown', event => {
      globe.dragging = true; globe.lastX = event.clientX; globe.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!globe.dragging) return;
      globe.rotation += (event.clientX - globe.lastX) * .32;
      globe.tilt = Math.max(-65, Math.min(65, globe.tilt + (event.clientY - globe.lastY) * .25));
      globe.lastX = event.clientX; globe.lastY = event.clientY;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, () => { globe.dragging = false; }));
    $('#edexGlobeToggle').addEventListener('click', () => {
      globe.rotating = !globe.rotating;
      $('#edexGlobeToggle').textContent = globe.rotating ? 'PAUSE ROTATION' : 'RESUME ROTATION';
    });
    $('#edexGlobeToggle').textContent = globe.rotating ? 'PAUSE ROTATION' : 'RESUME ROTATION';
  }

  /* -------------------------------------------------------------- YouTube relay */
  const video = {
    current: 0, player: null, generation: 0, apiPromise: null,
    watchdog: null, advanceTimer: null, muted: true,
  };

  function setVideoStatus(text, kind = '') {
    setStatus($('#edexVideoStatus'), text, kind);
  }

  function updateChannelUI() {
    const channel = CHANNELS[video.current];
    $$('[data-edex-channel]').forEach(button => button.classList.toggle('active', Number(button.dataset.edexChannel) === video.current));
    $('#edexChannelCounter').textContent = `CHANNEL ${String(video.current + 1).padStart(2, '0')} / ${String(CHANNELS.length).padStart(2, '0')}`;
    $('#edexVideoExternal').href = `https://www.youtube.com/channel/${channel.channel}/live`;
    $('#edexFooterRelay').textContent = `NEWS RELAY · ${channel.name}`;
  }

  function clearVideoTimers() {
    clearTimeout(video.watchdog); clearTimeout(video.advanceTimer);
    video.watchdog = null; video.advanceTimer = null;
  }

  function destroyVideo() {
    video.generation += 1;
    clearVideoTimers();
    const player = video.player;
    video.player = null;
    if (player && typeof player.destroy === 'function') {
      try { player.destroy(); } catch (error) { /* already destroyed */ }
    }
  }

  function showVideoPlaceholder(title, subtitle) {
    const mount = $('#edexVideoMount');
    const wrap = document.createElement('div');
    wrap.className = 'edex-video-placeholder';
    const icon = document.createElement('i'); icon.textContent = '▣';
    const heading = document.createElement('b'); heading.textContent = title;
    const detail = document.createElement('small'); detail.textContent = subtitle;
    wrap.append(icon, heading, detail);
    mount.replaceChildren(wrap);
  }

  function ensureYouTubeAPI() {
    if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve();
    if (video.apiPromise) return video.apiPromise;
    video.apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') previous();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('YouTube player API could not be loaded.'));
      document.head.appendChild(script);
      setTimeout(() => reject(new Error('YouTube player API timed out.')), 15000);
    });
    return video.apiPromise;
  }

  function scheduleNextChannel(generation, reason) {
    if (!active || generation !== video.generation || video.advanceTimer) return;
    clearTimeout(video.watchdog);
    setVideoStatus(`${reason} · NEXT CHANNEL`, 'warn');
    video.advanceTimer = setTimeout(() => {
      if (active && generation === video.generation) loadChannel((video.current + 1) % CHANNELS.length);
    }, 1100);
  }

  function updateMuteButton() {
    $('#edexVideoMute').textContent = video.muted ? 'UNMUTE' : 'MUTE';
    $('#edexVideoMute').setAttribute('aria-pressed', String(!video.muted));
  }

  async function loadChannel(index) {
    if (!active) return;
    destroyVideo();
    const generation = video.generation;
    video.current = (index + CHANNELS.length) % CHANNELS.length;
    video.muted = true;
    updateChannelUI(); updateMuteButton();
    const channel = CHANNELS[video.current];
    setVideoStatus('CONNECTING', 'warn');
    showVideoPlaceholder(`TUNING ${channel.name}`, 'Muted autoplay · automatic failover armed');
    try {
      await ensureYouTubeAPI();
      if (!active || generation !== video.generation) return;
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({
        channel: channel.channel, autoplay: '1', mute: '1', controls: '1',
        rel: '0', playsinline: '1', enablejsapi: '1', origin: location.origin,
      });
      iframe.src = `https://www.youtube-nocookie.com/embed/live_stream?${params}`;
      iframe.title = `${channel.name} live news`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      $('#edexVideoMount').replaceChildren(iframe);
      video.player = new window.YT.Player(iframe, {
        events: {
          onReady: event => {
            if (generation !== video.generation) return;
            event.target.mute();
            event.target.playVideo();
            setVideoStatus('ACQUIRING LIVE FEED', 'warn');
          },
          onStateChange: event => {
            if (!active || generation !== video.generation) return;
            if (event.data === 1) {
              clearTimeout(video.watchdog);
              setVideoStatus('LIVE · AUTO NEXT ARMED', 'live');
            } else if (event.data === 0) {
              scheduleNextChannel(generation, 'STREAM ENDED');
            } else if (event.data === 2) {
              setVideoStatus('PAUSED · MANUAL HOLD', 'warn');
            } else if (event.data === 3) {
              setVideoStatus('BUFFERING', 'warn');
            }
          },
          onError: () => scheduleNextChannel(generation, 'FEED UNAVAILABLE'),
        },
      });
      clearTimeout(video.watchdog);
      video.watchdog = setTimeout(() => scheduleNextChannel(generation, 'FEED TIMEOUT'), 16000);
    } catch (error) {
      if (generation !== video.generation) return;
      setVideoStatus('YOUTUBE OFFLINE', 'error');
      showVideoPlaceholder('NEWS RELAY OFFLINE', 'Use OPEN ↗ or choose another channel.');
    }
  }

  function stopVideoForExit() {
    destroyVideo();
    setVideoStatus('STANDBY');
    showVideoPlaceholder('NEWS RELAY STANDBY', 'Automatic channel failover armed');
  }

  /* -------------------------------------------------------------------- events */
  async function refreshBridgeStatus() {
    const label = $('#edexBridgeStatus');
    label.textContent = 'LOCAL BRIDGE · CHECKING';
    if (typeof checkBridge === 'function') await checkBridge();
    label.textContent = state.bridge ? 'LOCAL BRIDGE · CONNECTED' : 'LOCAL BRIDGE · OFFLINE';
  }

  function init() {
    if (initialized) return;
    initialized = true;
    addTerminalLine('system', 'IRA EDEX command environment initialized.');
    addTerminalLine('system', 'Cloud-brain relay armed. Diagnostics, world view, applications, and news manager are online.');
    addTerminalLine('assistant', `Welcome, ${state.userTitle}. This is your main terminal—talk to me naturally, or type /help.`);

    $('#edexTerminalForm').addEventListener('submit', event => {
      event.preventDefault();
      const input = $('#edexTerminalInput');
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      askEdex(value);
    });
    $('#edexTerminalMic').addEventListener('click', () => $('#micBtn').click());
    $$('[data-edex-prompt]').forEach(button => button.addEventListener('click', () => askEdex(button.dataset.edexPrompt)));
    $$('[data-edex-command]').forEach(button => button.addEventListener('click', () => askEdex(button.dataset.edexCommand)));
    $$('[data-edex-action]').forEach(button => button.addEventListener('click', () => {
      if (typeof requestAutomation === 'function') requestAutomation(button.dataset.edexAction, button.dataset.edexLabel);
    }));

    $$('[data-edex-channel]').forEach(button => button.addEventListener('click', () => loadChannel(Number(button.dataset.edexChannel))));
    $('#edexVideoPrevious').addEventListener('click', () => loadChannel(video.current - 1));
    $('#edexVideoNext').addEventListener('click', () => loadChannel(video.current + 1));
    $('#edexVideoPlayPause').addEventListener('click', () => {
      if (!video.player) { loadChannel(video.current); return; }
      try {
        if (video.player.getPlayerState() === 1) video.player.pauseVideo(); else video.player.playVideo();
      } catch (error) { loadChannel(video.current); }
    });
    $('#edexVideoMute').addEventListener('click', () => {
      if (!video.player) return;
      try {
        if (video.muted) video.player.unMute(); else video.player.mute();
        video.muted = !video.muted; updateMuteButton();
      } catch (error) { setVideoStatus('AUDIO CONTROL UNAVAILABLE', 'warn'); }
    });
    initGlobeControls();
    updateChannelUI(); updateMuteButton(); tickClock();
    addEventListener('resize', () => { drawDiagnosticsChart(); drawGlobe(); });
  }

  function enter() {
    if (active) return;
    init();
    active = true;
    $('#edexPromptName').textContent = (state.userTitle || 'Commander').toLowerCase().replace(/\s+/g, '-');
    tickClock();
    clearInterval(clockTimer); clockTimer = setInterval(tickClock, 1000);
    clearInterval(diagnostics.timer);
    sampleDiagnostics(); diagnostics.timer = setInterval(sampleDiagnostics, 2000);
    cancelAnimationFrame(globe.frame); globe.lastFrame = 0;
    globe.frame = requestAnimationFrame(animateGlobe);
    loadWorld(); loadGlobeIntel();
    loadChannel(video.current);
    refreshBridgeStatus();
    setTimeout(() => { if (active && innerWidth > 1000) $('#edexTerminalInput').focus(); }, 250);
  }

  function leave() {
    if (!active) return;
    active = false;
    clearInterval(clockTimer); clearInterval(diagnostics.timer);
    clockTimer = null; diagnostics.timer = null;
    cancelAnimationFrame(globe.frame); globe.frame = null;
    stopVideoForExit();
  }

  window.askEdex = askEdex;
  window.iraEdexEnter = enter;
  window.iraEdexLeave = leave;
  init();
  if (modeIsActive()) enter();
})();
