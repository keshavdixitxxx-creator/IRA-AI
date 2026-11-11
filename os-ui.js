/* IRA K-10 — UI 8. A simulated desktop: Windows 10 on the surface,
   Kali Linux at heart, and IRA as the AI on call. Everything is labelled
   honestly: scans are SIMULATED, the filesystem is a SIM, answers come
   from the real IRA brain via askIRA(). */
(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const sessionStart = Date.now();
  let entered = false;
  let bootSeen = false;
  let clockTimer = null;
  let diagTimer = null;
  let zTop = 20;
  let winSeq = 0;
  const windows = new Map(); // appId|notepad-key -> { el, taskBtn }

  /* ── shared glyphs ─────────────────────────────────────── */
  const GLYPH = {
    explorer: '<svg viewBox="0 0 48 48"><rect x="2" y="8" width="44" height="13" rx="2.5" fill="#f4c542"/><rect x="2" y="13" width="44" height="27" rx="2.5" fill="#ffd95e"/><rect x="6" y="27" width="36" height="9" rx="1" fill="#e8b62c" opacity=".55"/><circle cx="9" cy="14.5" r="1.6" fill="#7a5b00"/></svg>',
    terminal: '<svg viewBox="0 0 48 48"><rect x="3" y="6" width="42" height="36" rx="3" fill="#0c1015" stroke="#37e06b" stroke-opacity=".55" stroke-width="2"/><path d="M10 16l7.5 6L10 28" fill="none" stroke="#37e06b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 30h11" stroke="#37e06b" stroke-width="2.4" stroke-linecap="round"/></svg>',
    copilot: '<svg viewBox="0 0 48 48"><path d="M24 4l17 10v20L24 44 7 34V14L24 4z" fill="#0078d7"/><path d="M24 4l17 10-17 10L7 14 24 4z" fill="#2da3f5"/><path d="M24 24v20L7 34V14l17 10z" fill="#005a9e"/><circle cx="24" cy="19" r="3" fill="#eaf6ff"/></svg>',
    wire: '<svg viewBox="0 0 48 48"><path d="M8 10h32v8H8z" fill="#ffb454"/><path d="M8 22h23v6H8z" fill="#d18a2a"/><path d="M8 32h15v6H8z" fill="#8f6b2a"/></svg>',
    monitor: '<svg viewBox="0 0 48 48"><rect x="3" y="6" width="42" height="28" rx="2" fill="#0d1620" stroke="#38e8ff" stroke-opacity=".6" stroke-width="2"/><path d="M12 26l6-9 5 7 5-12 5 14 4-6h6" fill="none" stroke="#38e8ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><rect x="17" y="38" width="14" height="4" fill="#234"/></svg>',
    recycle: '<svg viewBox="0 0 48 48"><path d="M10 14h28l-3 26a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4l-3-26z" fill="#20303c" stroke="#5f8296" stroke-width="2"/><path d="M18 14V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5" fill="none" stroke="#5f8296" stroke-width="2"/><path d="M20 24v10M24 24v10M28 24v10" stroke="#5f8296" stroke-width="2" stroke-linecap="round"/></svg>',
    notepad: '<svg viewBox="0 0 48 48"><path d="M10 4h20l8 8v32H10z" fill="#f5f3ee" stroke="#b9b4a5" stroke-width="1.6"/><path d="M30 4v8h8" fill="#ddd9cf"/><path d="M16 20h16M16 26h16M16 32h11" stroke="#8a857a" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const winGlyphSvg = { explorer: GLYPH.explorer, terminal: GLYPH.terminal, copilot: GLYPH.copilot, wire: GLYPH.wire, monitor: GLYPH.monitor, notepad: GLYPH.notepad };

  /* ── toast ─────────────────────────────────────────────── */
  let toastTimer = null;
  function showToast(title, msg) {
    const toast = $('#osToast');
    if (!toast) return;
    toast.innerHTML = `<b>${escape(title)}</b>${escape(msg)}`;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4600);
  }

  /* ── clock (taskbar + lock) ────────────────────────────── */
  function tickClock() {
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const clock = $('#osClock'); if (clock) clock.textContent = time;
    const clockDate = $('#osClockDate'); if (clockDate) clockDate.textContent = date;
    const lockTime = $('#osLockTime'); if (lockTime) lockTime.textContent = `${p(now.getHours())}:${p(now.getMinutes())}`;
    const lockDate = $('#osLockDate'); if (lockDate) lockDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ── boot + lock ───────────────────────────────────────── */
  const BOOT_LINES = [
    '[ OK ] ira-kernel 1.0.0-k10 x86_64 GNU/Linux',
    '[ OK ] Mounting /sys/fs/hermes (persistent memory)',
    '[ OK ] Started hermes-heartbeat.service  (+1 XP/s)',
    '[ OK ] Started wire.service — google-news · guardian-rss',
    '[ OK ] Started osint-daemon.service  [ SIM LAYERS: ships · trains · vehicles · traffic ]',
    '[ OK ] edexbridge.service — automation bridge (every action confirm-gated)',
    '[ OK ] Started copilot.service — IRA orchestrator  [ ONLINE ]',
    '[INFO] Live feeds report LIVE / SIM / OFFLINE honestly at runtime',
    '[ OK ] Reached target graphical interface — launching K-10 session for root…',
  ];

  function runBoot() {
    const boot = $('#osBoot');
    const lines = $('#osBootLines');
    if (!boot || !lines) return Promise.resolve();
    bootSeen = true;
    boot.classList.remove('done');
    lines.textContent = '';
    let i = 0;
    return new Promise((resolve) => {
      const finish = () => {
        boot.classList.add('done');
        boot.removeEventListener('pointerdown', skip);
        resolve();
      };
      const skip = () => finish();
      boot.addEventListener('pointerdown', skip);
      const step = () => {
        if (i >= BOOT_LINES.length) { setTimeout(finish, 240); return; }
        lines.textContent += BOOT_LINES[i] + '\n';
        i += 1;
        $('#osBoot').scrollTop = 1e9;
        setTimeout(step, 105 + Math.random() * 90);
      };
      step();
    });
  }

  function showLock() { const lock = $('#osLock'); if (lock) { lock.classList.remove('away'); lock.setAttribute('aria-hidden', 'false'); } }
  function hideLock() { const lock = $('#osLock'); if (lock) { lock.classList.add('away'); lock.setAttribute('aria-hidden', 'true'); } }

  $('#osLock')?.addEventListener('click', hideLock);

  /* ── window manager ────────────────────────────────────── */
  function bringToFront(rec) {
    rec.el.style.zIndex = String(++zTop);
    $$('.os-window', $('#osWindows')).forEach((w) => w.classList.toggle('focused', w === rec.el));
    windows.forEach((r) => r.taskBtn?.classList.toggle('active', r === rec && !r.el.classList.contains('minimized')));
  }

  function syncTaskButton(rec) {
    if (!rec.taskBtn) return;
    const minimized = rec.el.classList.contains('minimized');
    rec.taskBtn.classList.toggle('active', !minimized && rec.el.classList.contains('focused'));
  }

  function closeWindow(key) {
    const rec = windows.get(key);
    if (!rec) return;
    rec.el.remove();
    rec.taskBtn?.remove();
    windows.delete(key);
  }

  function minimizeWindow(rec) {
    rec.el.classList.add('minimized');
    rec.taskBtn?.classList.remove('active');
  }

  function makeDraggable(el, titlebar) {
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.os-win-btn') || el.classList.contains('maximized')) return;
      const desktop = $('#osDesktop');
      const dRect = desktop.getBoundingClientRect();
      const wRect = el.getBoundingClientRect();
      const dx = e.clientX - wRect.left;
      const dy = e.clientY - wRect.top;
      titlebar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        let x = ev.clientX - dRect.left - dx;
        let y = ev.clientY - dRect.top - dy;
        x = Math.max(-wRect.width + 120, Math.min(dRect.width - 60, x));
        y = Math.max(0, Math.min(dRect.height - 40, y));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      };
      const up = () => {
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', up);
        titlebar.removeEventListener('pointercancel', up);
      };
      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', up);
      titlebar.addEventListener('pointercancel', up);
    });
    titlebar.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.os-win-btn')) el.classList.toggle('maximized');
    });
  }

  function createWindow(key, { title, glyph, w = 620, h = 420, onClose }) {
    if (windows.has(key)) {
      const rec = windows.get(key);
      rec.el.classList.remove('minimized');
      bringToFront(rec);
      return rec;
    }
    const layer = $('#osWindows');
    const el = document.createElement('div');
    el.className = 'os-window';
    el.setAttribute('role', 'dialog');
    el.style.width = `${Math.min(w, innerWidthSafe() - 24)}px`;
    el.style.height = `${Math.min(h, ($('#osDesktop')?.clientHeight || 640) - 12)}px`;
    const offset = (winSeq++ % 6) * 28;
    el.style.left = `${96 + offset}px`;
    el.style.top = `${34 + offset}px`;
    el.innerHTML = `
      <div class="os-titlebar">
        <span class="os-win-glyph">${glyph || GLYPH.notepad}</span>
        <span class="os-win-title">${escape(title)}</span>
        <span class="os-title-spacer"></span>
        <button class="os-win-btn os-win-min" aria-label="Minimize"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 6h9"/></svg></button>
        <button class="os-win-btn os-win-max" aria-label="Maximize or restore"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="1.5" width="9" height="9"/></svg></button>
        <button class="os-win-btn os-win-close" aria-label="Close"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>
      </div>
      <div class="os-window-body"></div>`;
    layer.appendChild(el);

    const body = $('.os-window-body', el);
    const taskBtns = $('#osTaskButtons');
    const taskBtn = document.createElement('button');
    taskBtn.className = 'os-task-btn active';
    taskBtn.innerHTML = `${glyph || GLYPH.notepad}<span>${escape(title)}</span>`;
    taskBtns.appendChild(taskBtn);

    const rec = { el, taskBtn, body };
    windows.set(key, rec);

    taskBtn.addEventListener('click', () => {
      if (rec.el.classList.contains('minimized')) { rec.el.classList.remove('minimized'); bringToFront(rec); }
      else if (rec.el.classList.contains('focused')) minimizeWindow(rec);
      else bringToFront(rec);
      syncTaskButton(rec);
    });
    $('.os-win-min', el).addEventListener('click', () => { minimizeWindow(rec); syncTaskButton(rec); });
    $('.os-win-max', el).addEventListener('click', () => el.classList.toggle('maximized'));
    $('.os-win-close', el).addEventListener('click', () => { onClose && onClose(); closeWindow(key); });
    el.addEventListener('pointerdown', () => bringToFront(rec));
    makeDraggable(el, $('.os-titlebar', el));
    bringToFront(rec);
    return rec;
  }

  function innerWidthSafe() { return window.innerWidth || 1280; }

  /* ── simulated filesystem ──────────────────────────────── */
  const FS = {
    name: 'This PC', type: 'root',
    children: [
      { name: 'System (C:)', type: 'drive', children: [
        { name: 'Users', type: 'folder', children: [
          { name: 'ira', type: 'folder', children: [
            { name: 'Desktop', type: 'folder', children: [] },
            { name: 'Documents', type: 'folder', children: [
              { name: 'notes.txt', type: 'file', file: 'notes' },
              { name: 'memory.sys', type: 'file', file: 'memory' },
              { name: 'brain.log', type: 'file', file: 'brain' },
            ] },
            { name: 'Downloads', type: 'folder', children: [] },
            { name: 'Pictures', type: 'folder', children: [] },
            { name: 'Music', type: 'folder', children: [] },
          ] },
        ] },
        { name: 'kali-tools', type: 'folder', children: [
          { name: 'ira-nmap.exe', type: 'file', file: 'tool-nmap' },
          { name: 'wireshark-sim.pcap', type: 'file', file: 'pcap' },
        ] },
        { name: 'logs', type: 'folder', children: [
          { name: 'wire.log', type: 'file', file: 'wirelog' },
        ] },
        { name: 'readme.txt', type: 'file', file: 'readme' },
      ] },
      { name: 'Backup (D:)', type: 'drive', children: [
        { name: 'ira-snapshot-2026-11-01.zip', type: 'file', file: 'zip' },
      ] },
    ],
  };
  const nodeAt = (path) => path.reduce((node, i) => (node.children || [])[i], FS);
  const pathLabel = (path) => ['This PC'].concat(path.map((i, idx) => {
    const node = nodeAt(path.slice(0, idx + 1));
    return node ? node.name : '?';
  }));

  async function fileContent(id) {
    const H = async () => (await fetch('/api/hermes/status', { cache: 'no-store' })).json().catch(() => null);
    switch (id) {
      case 'notes':
        return 'IRANOTA v1 — from the desk of root\n\nThe terminal (root@ira) is the fastest way around.\n  help      — list commands\n  news      — the world wire, right here\n  scan      — SIMULATED network sweep (no packets sent)\n  ask <q>   — straight to the brain\nor just type a question — anything that is not a command\ngoes to IRA herself.\n\nEverything in this machine is a simulation except IRA\nherself: her memory persists across restarts (hermes).';
      case 'readme':
        return 'IRA K-10 — READ ME\n==================\nK-10 is a simulated desktop that lives in this browser tab.\nNothing here touches your disk, your network, or any other\nmachine. Tools with real side effects (the automation\nbridge) still demand your explicit confirmation.\n\nHonest by construction:\n  • live feeds report LIVE / SIM / OFFLINE — never fake\n  • scans and traffic here are SIMULATED\n  • answers are AI-generated and can be wrong\n  • the only state that persists is Hermes memory';
      case 'memory': {
        const m = await H();
        if (!m) return 'memory.sys — could not read /api/hermes/status.\n(The Hermes daemon reports LIVE only when the server runs.)';
        return `HERMES MEMORY CORE — live dump\n==============================\nversion           ${m.version}\nlevel             LV ${m.level}\nxp                ${m.xp} (next at ${m.xpForNext})\ntotalInteractions ${m.totalInteractions}\nsessionCount      ${m.sessionCount}\nlastSeenAt        ${m.lastSeenAt}\nresume point      ${m.lastLeftOff}\nresuming…         ${m.resumeMessage}\nfocus             ${(m.topTopics || []).map((t) => `${t.topic} ×${t.count}`).join(', ') || '—'}\n\nThis counter is transparent — it is a notebook IRA keeps,\nnot neural-network training.`;
      }
      case 'brain': {
        const m = await H();
        return m ? `brain.log — last session tail\n============================\n${m.lastLeftOff || '(empty)'}\n\n${m.resumeMessage || ''}\n` : 'brain.log — hermes offline; no tail available.';
      }
      case 'wirelog': {
        try {
          const r = await fetch('/api/intel/news', { cache: 'no-store' });
          const data = await r.json();
          const items = (data && data.headlines) || [];
          if (!items.length) return 'wire.log — the wire is OFFLINE from this machine.\nNo headlines were fabricated. Check the network, reload.';
          return `wire.log — latest ${Math.min(8, items.length)} items\n========================\n` + items.slice(0, 8).map((h) => `[${String(h.published || '').slice(17, 22)}Z] (${h.source || '?'}) ${h.title}`).join('\n');
        } catch {
          return 'wire.log — /api/intel/news unreachable. Nothing fabricated.';
        }
      }
      case 'tool-nmap':
        return 'ira-nmap — SIMULATED network scanner\n\nRunning right here is always a drill: no packets leave\nthis machine. Use "scan" in the terminal, or read real\nnmap(1) documentation and only scan networks you own.';
      case 'pcap':
        return 'wireshark-sim.pcap — 0 bytes of real traffic\n\nThis pcap is a placeholder for the training lab. K-10\ndoes not capture, decrypt or store any real packets.';
      case 'zip':
        return 'ira-snapshot — simulated archive\n\nContents: not real backups. Real Hermes memory lives in\ndata/hermes-memory.json (git-ignored) on the host.';
      default:
        return 'Empty file.';
    }
  }

  function buildExplorer(body, rec) {
    let path = []; // indices into FS tree ([] = root "This PC")
    body.innerHTML = `
      <div class="os-explorer">
        <div class="os-exp-side">
          <button class="os-exp-link" data-jump="home">🏠 Home</button>
          <button class="os-exp-link" data-jump="docs">📄 Documents</button>
          <button class="os-exp-link" data-jump="kali">🧪 kali-tools</button>
          <button class="os-exp-link" data-jump="logs">📋 logs</button>
          <button class="os-exp-link" data-jump="root">🖥 This PC</button>
        </div>
        <div class="os-exp-main">
          <div class="os-exp-crumbs"></div>
          <div class="os-exp-grid"></div>
          <div class="os-exp-status"><span class="os-exp-count">0 objects</span><span>·</span><b>SIMULATED FS — NOT YOUR DISK</b></div>
        </div>
      </div>`;
    const grid = $('.os-exp-grid', body);
    const crumbs = $('.os-exp-crumbs', body);
    const count = $('.os-exp-count', body);

    const FOLDER_ICON = '<svg viewBox="0 0 48 48"><path d="M4 12a3 3 0 0 1 3-3h11l4 5h19a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V12z" fill="#f4c542"/><path d="M4 18h40v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V18z" fill="#ffd95e"/></svg>';
    const FILE_ICON = '<svg viewBox="0 0 48 48"><path d="M12 4h16l8 8v32H12z" fill="#e8ecf1"/><path d="M28 4v8h8" fill="#b9c4cd"/><path d="M18 20h12M18 26h12M18 32h9" stroke="#5b6b78" stroke-width="2" stroke-linecap="round"/></svg>';
    const DRIVE_ICON = '<svg viewBox="0 0 48 48"><rect x="4" y="14" width="40" height="20" rx="2" fill="#27333f" stroke="#4e6c7d" stroke-width="1.6"/><rect x="8" y="27" width="22" height="2.4" rx="1.2" fill="#38e8ff" opacity=".8"/><circle cx="38.5" cy="28.2" r="1.5" fill="#37e06b"/></svg>';

    const render = () => {
      const node = nodeAt(path);
      const kids = (node.children || []).slice().sort((a, b) => (a.type === 'file') - (b.type === 'file') || a.name.localeCompare(b.name));
      const labels = pathLabel(path);
      crumbs.innerHTML = labels.map((l, i) => {
        const here = i === labels.length - 1;
        return here ? `<b>${escape(l)}</b>` : `<span>${escape(l)}</span><span>▸</span>`;
      }).join('');
      grid.replaceChildren();
      for (const [i, child] of kids.entries()) {
        const idx = (node.children || []).indexOf(child);
        const btn = document.createElement('button');
        btn.className = 'os-exp-item';
        btn.innerHTML = `${child.type === 'file' ? FILE_ICON : child.type === 'drive' ? DRIVE_ICON : FOLDER_ICON}<span>${escape(child.name)}</span>`;
        btn.addEventListener('click', () => openChild(idx, child));
        grid.appendChild(btn);
      }
      count.textContent = `${kids.length} object${kids.length === 1 ? '' : 's'}`;
    };

    const openChild = async (idx, child) => {
      if (child.type === 'file') {
        const key = 'notepad-' + child.name;
        const text = await fileContent(child.file);
        const nrec = createWindow(key, { title: `${child.name} — Notepad`, glyph: GLYPH.notepad, w: 500, h: 380 });
        nrec.body.innerHTML = `<div class="os-notepad"><div class="os-notepad-head"><span>${escape(child.name)}</span><span>SIMULATED FILE</span></div><div class="os-notepad-body">${escape(text)}</div></div>`;
        return;
      }
      path = path.concat(idx);
      render();
    };

    body.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (!jump) return;
      const target = {
        root: [],
        home: [0, 0, 0],
        docs: [0, 0, 0, 1],
        kali: [0, 1],
        logs: [0, 2],
      }[jump.dataset.jump];
      if (target) { path = target; render(); }
    });
    render();
  }

  /* ── terminal app ──────────────────────────────────────── */
  function buildTerminal(body) {
    body.innerHTML = `
      <div class="os-term">
        <div class="os-term-out" aria-live="polite"></div>
        <div class="os-term-line">
          <span class="os-prompt"><b>root@ira</b>:~#</span>
          <input class="os-term-input" type="text" spellcheck="false" autocomplete="off" aria-label="Terminal input" />
        </div>
      </div>`;
    const out = $('.os-term-out', body);
    const input = $('.os-term-input', body);

    const print = (html, cls) => {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.innerHTML = html;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    };
    const dim = (t) => print(escape(t), 'dim');
    const pre = (t) => { const div = document.createElement('div'); const p = document.createElement('pre'); p.textContent = t; div.appendChild(p); out.appendChild(div); out.scrollTop = out.scrollHeight; };

    const uptime = () => {
      const s = Math.floor((Date.now() - sessionStart) / 1000);
      return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
    };

    const help = () => {
      print('<span class="cyan">IRA K-10 — available commands</span>');
      pre([
        '  help            this list',
        '  neofetch        system card',
        '  news            latest from the world wire',
        '  scan            SIMULATED sweep of 192.168.1.0/24',
        '  breach <t>      SIMULATED drill against a made-up target',
        '  ask <question>  straight to the IRA brain',
        '  date · uptime   session clock',
        '  whoami · hostname',
        '  clear           wipe the screen',
        '  exit            close this window',
        '',
        '  Anything else is treated as a question for IRA herself.',
      ].join('\n'));
    };

    const neofetch = () => {
      pre([
        ' ▄█▄ ▀█▀ ▄█▄    root@ira',
        ' █▀█  █  █▀█    ----------------------------',
        ' █▀▀  █  █▀▀    OS····: IRA K-10 (Win shell · Kali heart)',
        ' ▀    ▀  ▀      KERNEL·: ira-ai 1.0 · Hermes persistent memory',
        '                SHELL··: ira-sh (ai-augmented)',
        '                UPTIME·: ' + uptime(),
        '                AI·····: IRA orchestrator · ONLINE',
        '                TOOLS··: everything here is a drill — see help',
      ].join('\n'));
    };

    const news = async () => {
      dim('querying /api/intel/news …');
      try {
        const r = await fetch('/api/intel/news', { cache: 'no-store' });
        const data = await r.json();
        const items = (data && data.headlines) || [];
        if (!items.length) { print('<span class="warn">wire OFFLINE — no headlines fabricated. Try again with network.</span>'); return; }
        items.slice(0, 5).forEach((h) => print(`<span class="cyan">▸</span> ${escape(h.title)} <span class="dim">— ${escape(h.source || '?')}</span>`));
      } catch {
        print('<span class="err">wire UNREACHABLE — nothing fabricated, sorry.</span>');
      }
    };

    const scan = () => {
      print('<span class="warn">IRA-nmap 7.94 (K-10 simulation) — 192.168.1.0/24</span>');
      pre([
        'Host 192.168.1.1    53/udp open  domain',
        '                    80/tcp open  http     (router admin)',
        '                    443/tcp open https',
        'Host 192.168.1.14   9100/tcp open laserjet',
        'Host 192.168.1.27   22/tcp  open ssh     (workstation)',
        '                    445/tcp open microsoft-ds',
        'Host 192.168.1.31   80/tcp  open http    (hik-sim-cam — toy target)',
        'Host 192.168.1.44   22/tcp  open ssh     (ira-node)',
        '                    5173/tcp open http   (this very console)',
        '',
        '6 hosts up · latency 8ms · done in 0.42s (simulated)',
      ].join('\n'));
      print('<span class="warn">⚠ SIMULATION — no packets were sent. Real scanning needs explicit authorisation and real nmap.</span>');
    };

    const breach = (target) => {
      const t = target || 'sim-target.local';
      print(`<span class="warn">IRA BREACH TRAINER — target: ${escape(t)}</span>`);
      pre([
        '[*] scope check        : simulated lab only — authorization N/A',
        '[*] recon phase        : fingerprinted "VM-$TARGET" (fictional)',
        '[*] foothold           : pretend credentials accepted (it is a drill)',
        '[*] persistence        : imaginary, self-removing',
        '[*] exfiltration       : 0 bytes moved — there is no canal to cross',
        '[ OK ] drill complete  · 0 real systems touched',
      ].map((l) => l.replace('$TARGET', t)).join('\n'));
      print('<span class="warn">⚠ Training fiction. If you own this lab, use Metasploitable or Hack The Box.</span>');
    };

    const askBrain = async (q) => {
      print(`<span class="dim">→ IRA: “${escape(q)}”</span>`);
      try {
        const result = await askIRA(q);
        const answer = (result && result.answer) || 'No answer came back from the brain.';
        answer.split('\n').forEach((line) => print(escape(line)));
        if (result && result.engine) dim(`  [engine: ${result.engine}]`);
      } catch {
        print('<span class="err">The brain is unreachable right now.</span>');
      }
    };

    const run = (raw) => {
      const line = raw.trim();
      print(`<span class="os-prompt"><b>root@ira</b>:~#</span> ${escape(line)}`);
      if (!line) return;
      const [cmd, ...rest] = line.split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd.toLowerCase()) {
        case 'help': help(); break;
        case 'neofetch': neofetch(); break;
        case 'whoami': print('root — through IRA, who is watching the door'); break;
        case 'hostname': print('ira-k10'); break;
        case 'date': print(new Date().toString()); break;
        case 'uptime': print(uptime()); break;
        case 'news': news(); break;
        case 'scan': case 'nmap': scan(); break;
        case 'breach': case 'pwn': breach(arg || 'sim-target.local'); break;
        case 'ask': case 'ai': case 'ira': if (arg) askBrain(arg); else dim('usage: ask <question>'); break;
        case 'clear': out.replaceChildren(); break;
        case 'exit': closeWindow('terminal'); break;
        default:
          if (/^[a-z-]+$/.test(cmd) && !line.includes(' ')) { print(`<span class="err">command not found: ${escape(cmd)} — type 'help'</span>`); }
          else askBrain(line);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; run(v); }
    });
    body.addEventListener('click', () => input.focus());

    dim('IRA K-10 root terminal — all drills, no packets. Type \'help\'.');
    print('<span class="ok">Last login: this session</span>');
  }

  /* ── copilot app ───────────────────────────────────────── */
  function buildCopilot(body, rec) {
    body.innerHTML = `
      <div class="os-copilot">
        <div class="os-cop-stream" aria-live="polite"></div>
        <form class="os-cop-form"><input type="text" placeholder="Ask IRA…" aria-label="Message IRA" autocomplete="off" /><button type="submit">SEND</button></form>
      </div>`;
    const stream = $('.os-cop-stream', body);
    const form = $('.os-cop-form', body);
    const input = $('input', form);

    const add = (role, text, engine) => {
      const div = document.createElement('div');
      div.className = `os-cop-msg ${role}`;
      div.textContent = text;
      if (role === 'ira' && engine) {
        const small = document.createElement('small');
        small.textContent = String(engine).replace('cloud-brain', 'cloud brain');
        div.appendChild(small);
      }
      stream.appendChild(div);
      stream.scrollTop = stream.scrollHeight;
      return div;
    };

    const ask = async (q) => {
      q = String(q || '').trim();
      if (!q) return;
      add('you', q);
      const pending = add('ira', '…');
      try {
        const result = await askIRA(q);
        pending.textContent = (result && result.answer) || 'No answer came back from the brain.';
        if (result && result.engine) {
          const small = document.createElement('small');
          small.textContent = String(result.engine).replace('cloud-brain', 'cloud brain');
          pending.appendChild(small);
        }
      } catch {
        pending.textContent = 'The brain is unreachable right now. Check the server and try again.';
      }
      stream.scrollTop = stream.scrollHeight;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value; input.value = ''; ask(q);
    });
    rec.ask = ask;
    add('ira', 'Online and listening. AMA — or open the terminal and type “news”.', 'copilot-core');
  }

  /* ── wire app ──────────────────────────────────────────── */
  function buildWire(body) {
    body.innerHTML = `
      <div class="os-wire">
        <div class="os-wire-head">ARGUS WIRE — PUBLIC RSS<button type="button" class="os-wire-refresh">REFRESH</button></div>
        <div class="os-wire-list" role="feed"></div>
      </div>`;
    const list = $('.os-wire-list', body);
    const load = async () => {
      list.innerHTML = '<div class="os-wire-empty">Reading the wire…</div>';
      try {
        const r = await fetch('/api/intel/news', { cache: 'no-store' });
        const data = await r.json();
        const items = (data && data.headlines) || [];
        if (!items.length) { list.innerHTML = '<div class="os-wire-empty">THE WIRE IS OFFLINE FROM THIS MACHINE.<br/>No headlines fabricated — reload when the network allows.</div>'; return; }
        list.replaceChildren();
        items.slice(0, 14).forEach((h) => {
          const a = document.createElement('a');
          a.className = 'os-wire-row';
          a.href = h.url || '#'; a.target = '_blank'; a.rel = 'noreferrer';
          const t = Date.parse(h.published || '');
          const time = Number.isNaN(t) ? '--:--' : new Date(t).toUTCString().slice(17, 22);
          a.innerHTML = `<span class="os-wire-time">${time}Z</span><span class="os-wire-title">${escape(h.title)}</span><span class="os-wire-topic">${escape(String(h.topic || 'news').slice(0, 12))}</span>`;
          list.appendChild(a);
        });
      } catch {
        list.innerHTML = '<div class="os-wire-empty">/api/intel/news unreachable.<br/>Nothing fabricated — check the server.</div>';
      }
    };
    $('.os-wire-refresh', body).addEventListener('click', load);
    load();
  }

  /* ── monitor app ───────────────────────────────────────── */
  const diagSamples = [];
  function buildMonitor(body, rec) {
    body.innerHTML = `
      <div class="os-monitor">
        <div class="os-mon-row">
          <div class="os-gauge"><small>CPU</small><b class="os-g-cpu">—</b><em>percent of capacity</em><div class="os-meter"><i class="os-m-cpu"></i></div></div>
          <div class="os-gauge"><small>MEMORY</small><b class="os-g-mem">—</b><em>percent committed</em><div class="os-meter"><i class="os-m-mem"></i></div></div>
          <div class="os-gauge"><small>NETWORK</small><b class="os-g-net">—</b><em>kilobits / second</em><div class="os-meter"><i class="os-m-net"></i></div></div>
        </div>
        <div class="os-mon-canvas-wrap"><canvas width="480" height="92" aria-label="CPU history"></canvas><span class="os-mon-tag">LIVE</span></div>
        <div class="os-procs">
          <div class="os-procs-head"><span>PROCESSES — SIMULATED WORKLOAD</span><span class="os-proc-src">/api/diagnostics</span></div>
          <div class="os-proc-list"></div>
        </div>
      </div>`;
    const canvas = $('canvas', body);
    const ctx = canvas.getContext && canvas.getContext('2d');
    const tag = $('.os-mon-tag', body);
    const procBase = [
      ['ira-core', 18, 412], ['hermes-persistent', 6, 128], ['wire-syncer', 4, 96],
      ['osint-daemon [SIM]', 3, 210], ['copilot-brain', 9, 340], ['edex-bridge', 2, 74],
    ];
    const jitter = (v, spread, min = 0.5, max = 97) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * spread));

    const renderProcs = () => {
      $('.os-proc-list', body).innerHTML = procBase.map(([name, cpu, mem]) =>
        `<div class="os-proc"><span>${escape(name)}</span><span>${jitter(cpu, 6).toFixed(1)}% cpu</span><span>${Math.round(jitter(mem, 30))} MB</span></div>`
      ).join('');
    };
    const draw = () => {
      if (!ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050a10'; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(56, 232, 255, .12)';
      for (let y = 23; y < height; y += 23) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      if (diagSamples.length > 1) {
        ctx.strokeStyle = '#38e8ff'; ctx.lineWidth = 2; ctx.shadowColor = '#38e8ff'; ctx.shadowBlur = 6;
        ctx.beginPath();
        diagSamples.forEach((v, i) => {
          const x = (i / (diagSamples.length - 1)) * width;
          const y = height - (Math.min(100, Math.max(0, v)) / 100) * (height - 10) - 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.shadowBlur = 0;
      }
    };
    const sample = async () => {
      let data = null;
      try { data = await (await fetch('/api/diagnostics', { cache: 'no-store' })).json(); } catch { data = null; }
      const live = !!(data && data.ok);
      tag.textContent = live ? `LIVE · ${String(data.source || 'system').toUpperCase()}` : 'SIMULATED';
      tag.classList.toggle('sim', !live);
      const cpu = live ? data.cpuPercent : 20 + Math.sin(Date.now() / 9000) * 14 + Math.random() * 5;
      const mem = live ? data.memoryPercent : 48 + Math.sin(Date.now() / 13000) * 8 + Math.random() * 3;
      const net = live ? data.networkKbps : 120 + Math.random() * 420;
      diagSamples.push(cpu); if (diagSamples.length > 90) diagSamples.shift();
      $('.os-g-cpu', body).textContent = `${cpu.toFixed(1)}%`;
      $('.os-g-mem', body).textContent = `${mem.toFixed(1)}%`;
      $('.os-g-net', body).textContent = net.toFixed(0);
      $('.os-m-cpu', body).style.width = `${cpu}%`;
      $('.os-m-mem', body).style.width = `${mem}%`;
      $('.os-m-net', body).style.width = `${Math.min(100, net / 8)}%`;
      renderProcs();
      draw();
    };
    const procSrc = $('.os-proc-src', body); if (procSrc) procSrc.textContent = 'AUTO · 2s';
    rec.sample = sample;
    sample();
  }

  /* ── app registry + launch ─────────────────────────────── */
  const APPS = [
    { id: 'explorer', name: 'This PC', hint: 'FILE EXPLORER', glyph: GLYPH.explorer, w: 700, h: 430, build: buildExplorer },
    { id: 'terminal', name: 'IRA Root Terminal', hint: 'SHELL', glyph: GLYPH.terminal, w: 640, h: 420, build: buildTerminal },
    { id: 'copilot', name: 'IRA Copilot', hint: 'AI ASSISTANT', glyph: GLYPH.copilot, w: 430, h: 470, build: buildCopilot },
    { id: 'wire', name: 'Argus Wire', hint: 'WORLD NEWS', glyph: GLYPH.wire, w: 470, h: 440, build: buildWire },
    { id: 'monitor', name: 'System Monitor', hint: 'PERFORMANCE', glyph: GLYPH.monitor, w: 540, h: 400, build: buildMonitor },
  ];
  const appById = (id) => APPS.find((a) => a.id === id);

  function openApp(id) {
    const app = appById(id);
    if (!app) return null;
    const rec = createWindow(id, { title: app.name, glyph: app.glyph, w: app.w, h: app.h });
    if (!rec.built) { app.build(rec.body, rec); rec.built = true; }
    $('#osStart')?.classList.remove('open');
    $('#osStartBtn')?.classList.remove('open');
    $('#osStartBtn')?.setAttribute('aria-expanded', 'false');
    return rec;
  }

  /* desktop icons */
  const ICONS = [
    ['explorer', 'This PC'], ['terminal', 'Root Terminal'], ['copilot', 'IRA Copilot'], ['wire', 'Argus Wire'], ['monitor', 'System Monitor'], ['recycle', 'Recycle Bin'],
  ];
  function buildIcons() {
    const host = $('#osIcons');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    for (const [id, label] of ICONS) {
      const btn = document.createElement('button');
      btn.className = 'os-icon';
      btn.setAttribute('role', 'listitem');
      btn.innerHTML = `${GLYPH[id] || GLYPH.notepad}<span>${escape(label)}</span>`;
      btn.addEventListener('click', () => {
        if (id === 'recycle') showToast('RECYCLE BIN', '0 items. IRA keeps receipts — nothing is ever quietly deleted here.');
        else openApp(id);
      });
      host.appendChild(btn);
    }
  }

  /* start menu app list */
  function buildAppList() {
    const host = $('#osAppList');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    for (const app of APPS) {
      const btn = document.createElement('button');
      btn.className = 'os-app';
      btn.dataset.name = app.name.toLowerCase();
      btn.innerHTML = `${app.glyph}${escape(app.name)}<small>${escape(app.hint)}</small>`;
      btn.addEventListener('click', () => openApp(app.id));
      host.appendChild(btn);
    }
    const input = $('#osStartSearch');
    input?.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      $$('.os-app', host).forEach((b) => { b.style.display = !q || b.dataset.name.includes(q) ? '' : 'none'; });
    });
  }

  /* start menu toggle */
  function toggleStart(force) {
    const start = $('#osStart');
    const btn = $('#osStartBtn');
    if (!start || !btn) return;
    const open = force ?? !start.classList.contains('open');
    start.classList.toggle('open', open);
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  $('#osStartBtn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleStart(); });
  $('#osDesktop')?.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.os-start, .os-start-btn, .os-search-results')) toggleStart(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleStart(false); });

  /* app tiles */
  $$('.os-tile').forEach((tile) => tile.addEventListener('click', () => openApp(tile.dataset.app)));
  $$('.os-rail-btn[data-app]').forEach((btn) => btn.addEventListener('click', () => openApp(btn.dataset.app)));
  $('#osRailCopilot')?.addEventListener('click', () => openApp('copilot'));
  $('#osPowerBtn')?.addEventListener('click', () => { toggleStart(false); showLock(); });

  /* taskbar search → apps + "Ask IRA" */
  function bindSearch() {
    const input = $('#osSearchInput');
    const results = $('#osSearchResults');
    const wrap = $('#osSearchWrap');
    if (!input || !results || !wrap) return;
    const render = () => {
      const q = input.value.trim();
      const hits = q ? APPS.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : APPS;
      results.innerHTML = hits.map((a) => `<button class="os-hit" data-app="${a.id}">${a.glyph}${escape(a.name)}<small>${escape(a.hint)}</small></button>`).join('')
        + (q ? `<button class="os-hit os-hit-ask" data-ask="${escape(q)}">Ask IRA: “${escape(q)}”<small>BRAIN</small></button>` : '');
      results.classList.toggle('show', results.childElementCount > 0);
      results.setAttribute('aria-hidden', String(!results.classList.contains('show')));
    };
    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.blur(); results.classList.remove('show'); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const copilot = openApp('copilot');
        if (copilot && windows.get('copilot')?.ask) windows.get('copilot').ask(q);
        input.value = '';
        results.classList.remove('show');
      }
    });
    results.addEventListener('click', (e) => {
      const app = e.target.closest('[data-app]');
      const ask = e.target.closest('[data-ask]');
      if (app) { openApp(app.dataset.app); results.classList.remove('show'); }
      else if (ask) {
        openApp('copilot');
        const rec = windows.get('copilot');
        if (rec?.ask) rec.ask(ask.dataset.ask);
        input.value = '';
        results.classList.remove('show');
      }
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#osSearchWrap')) results.classList.remove('show'); });
  }

  /* show desktop */
  let showDesktopOn = false;
  $('#osShowDesktop')?.addEventListener('click', () => {
    const list = [...windows.values()];
    if (!list.length) return;
    showDesktopOn = !showDesktopOn;
    list.forEach((rec) => rec.el.classList.toggle('minimized', showDesktopOn));
    list.forEach((rec) => rec.taskBtn?.classList.toggle('active', !showDesktopOn));
  });

  /* tray caret + clock wrap + battery */
  $('#osTrayCaret')?.addEventListener('click', () => showToast('HIDDEN ICONS', 'IRA keeps the tray honest: no mystery daemons up here.'));
  $('#osClockWrap')?.addEventListener('click', () => {
    const d = new Date();
    showToast('CALENDAR', d.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' — Delhi time (system clock).');
  });
  try {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const el = $('#osBattery');
        const paint = () => { if (el) el.textContent = `${b.charging ? '⚡' : ''}${Math.round(b.level * 100)}%`; };
        paint();
        b.addEventListener('levelchange', paint);
        b.addEventListener('chargingchange', paint);
      }).catch(() => {});
    } else {
      const el = $('#osBattery'); if (el) el.textContent = 'AC';
    }
  } catch { const el = $('#osBattery'); if (el) el.textContent = 'AC'; }

  /* ── tiles: hydrate from live endpoints ────────────────── */
  async function hydrateTiles() {
    try {
      const [news, mem] = await Promise.allSettled([
        fetch('/api/intel/news', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/hermes/status', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      const headlines = news.status === 'fulfilled' && news.value && Array.isArray(news.value.headlines) ? news.value.headlines : [];
      const tileWire = $('#osTileWire');
      if (tileWire) tileWire.textContent = headlines.length ? headlines[0].title : 'Wire offline — nothing fabricated';
      const m = mem.status === 'fulfilled' ? mem.value : null;
      const tileMemory = $('#osTileMemory');
      if (tileMemory) tileMemory.textContent = m ? `LV ${m.level} · ${m.totalInteractions} LEARNED` : 'Hermes offline';
    } catch { /* tiles keep honest fallbacks */ }
    try {
      const d = await (await fetch('/api/diagnostics', { cache: 'no-store' })).json();
      const tileCpu = $('#osTileCpu');
      if (tileCpu && d && d.ok) tileCpu.textContent = `${d.cpuPercent.toFixed(0)}% CPU · ${d.memoryPercent.toFixed(0)}% MEM`;
    } catch { /* tile keeps placeholder */ }
  }

  /* ── enter / leave ─────────────────────────────────────── */
  async function enter() {
    if (entered) return;
    entered = true;
    buildIcons();
    buildAppList();
    bindSearch();
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    hydrateTiles();

    if (!bootSeen) {
      await runBoot();
      showLock();
    }
    // resume greeting — Hermes remembers where we left off
    try {
      const res = await fetch('/api/hermes/status', { cache: 'no-store' });
      const m = await res.json();
      const resume = (m && m.lastLeftOff) ? String(m.lastLeftOff).replace(/^Q:\s*/, '') : '';
      if (resume) showToast('WELCOME BACK, ROOT', `Picked up from: “${resume.slice(0, 110)}${resume.length > 110 ? '…' : ''}”`);
    } catch { /* no memory available — stay silent rather than pretend */ }

    // diagnostics pump for monitor windows
    const monitorRec = () => windows.get('monitor');
    diagTimer = setInterval(() => { const r = monitorRec(); if (r && r.sample) r.sample(); }, 2000);
  }

  function leave() {
    entered = false;
    if (clockTimer) clearInterval(clockTimer);
    if (diagTimer) clearInterval(diagTimer);
    clockTimer = null;
    diagTimer = null;
    toggleStart(false);
    windows.forEach((rec) => { rec.el.remove(); rec.taskBtn?.remove(); });
    windows.clear();
    hideLock();
    $('#osBoot')?.classList.add('done');
  }

  function askOs(q) {
    if (!entered) return null;
    openApp('copilot');
    const rec = windows.get('copilot');
    if (rec?.ask) rec.ask(q);
    return null;
  }

  window.iraOsEnter = enter;
  window.iraOsLeave = leave;
  window.askOs = askOs;
})();
