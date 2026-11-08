/* IRA Office: dedicated editable sector apps, one boss, and one shared server-side brain. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const roles = {
    atlas: { name: 'ATLAS', role: 'RESEARCH LEAD', app: 'research' },
    pixel: { name: 'PIXEL', role: 'SENIOR CODER', app: 'code' },
    worden: { name: 'WORDEN', role: 'DOCUMENT WRITER', app: 'word' },
    grid: { name: 'GRID', role: 'DATA ANALYST', app: 'excel' },
    slides: { name: 'SLIDES', role: 'PRESENTATION DESIGN', app: 'powerpoint' },
    scout: { name: 'SCOUT', role: 'WEB INVESTIGATOR', app: 'browser' },
    sage: { name: 'SAGE', role: 'WHITEBOARD ANALYST', app: 'whiteboard' },
    byte: { name: 'BYTE', role: 'QA ENGINEER', app: 'code' },
    archie: { name: 'ARCHIE', role: 'ONENOTE CURATOR', app: 'onenote' },
    echo: { name: 'ECHO', role: 'CLASSROOM COORDINATOR', app: 'classroom' },
  };
  const apps = {
    research: { title: 'Research Desk', icon: '⌕', agent: 'atlas', label: 'RESEARCH ASSIGNMENT', placeholder: 'Research a topic, compare sources, or investigate a question…', hint: 'Ollama first · Wikipedia and DuckDuckGo fallbacks', extension: 'txt' },
    code: { title: 'VS Code · Shared Engineering', icon: '</>', agent: 'pixel', directive: 'Ask Pixel to implement, or Byte to review, the shared code…' },
    word: { title: 'Word · Document Studio', icon: 'W', agent: 'worden', directive: 'Ask Worden to draft or revise this document…', kind: 'word', extension: 'docx' },
    excel: { title: 'Excel · Data Studio', icon: 'X', agent: 'grid', directive: 'Ask Grid to build or update this spreadsheet…', kind: 'excel', extension: 'xlsx' },
    powerpoint: { title: 'PowerPoint · Presentation Studio', icon: 'P', agent: 'slides', directive: 'Ask Slides to create or revise this presentation…', kind: 'powerpoint', extension: 'pptx' },
    onenote: { title: 'OneNote · Shared Notebook', icon: 'N', agent: 'archie', directive: 'Ask Archie to create a notebook page…', kind: 'word', extension: 'docx' },
    whiteboard: { title: 'Whiteboard · Analysis Board', icon: '◇', agent: 'sage', directive: 'Ask Sage to turn this into whiteboard notes…' },
    classroom: { title: 'Classroom · Local Class Stream', icon: '▤', agent: 'echo', directive: 'Ask Echo to create a lesson or assignment…' },
    browser: { title: 'Real Browser · Scout', icon: '◎', agent: 'scout' },
  };
  const specialized = new Set(['code', 'word', 'excel', 'powerpoint', 'onenote', 'whiteboard', 'classroom']);
  const STORAGE_KEY = 'iraOfficeSectorWorkspacesV1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const editableText = element => String(element?.innerText ?? element?.textContent ?? '');
  function richText(value) {
    return String(value ?? '').split('\n').map(line => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { const level = heading[1].length; return `<h${level}>${esc(heading[2])}</h${level}>`; }
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
      if (bullet) return `<div class="doc-bullet">• ${esc(bullet[1])}</div>`;
      return line.trim() ? `<p>${esc(line)}</p>` : '<div class="doc-space"><br></div>';
    }).join('');
  }
  const makeDefaults = () => ({
    code: { active: 0, files: [
      { name: 'main.py', language: 'python', content: '# IRA shared engineering workspace\n# Ask Pixel to implement code, or Byte to review it.\n\ndef greet(name):\n    return f"Hello, {name}!"\n' },
      { name: 'qa-review.md', language: 'markdown', content: '# QA review\n\nByte will place shared review notes and test plans here.\n' },
    ], updatedBy: 'YOU + PIXEL + BYTE' },
    word: { title: 'IRA Shared Document', content: 'Start writing here, or ask Worden to draft the document.\n\nYour edits and Worden\'s revisions stay in this shared page.', updatedBy: 'YOU + WORDEN' },
    excel: { title: 'IRA Shared Workbook', cells: [['Department', 'Owner', 'Status'], ['Engineering', 'Pixel + Byte', 'Ready'], ['Documents', 'Worden', 'Ready'], ['Research', 'Atlas + Scout', 'Ready']], updatedBy: 'YOU + GRID' },
    powerpoint: { title: 'IRA Shared Presentation', active: 0, slides: [{ title: 'IRA Office', bullets: ['One connected brain', 'Ten dedicated workspaces', 'Ask Slides to build this deck'] }], updatedBy: 'YOU + SLIDES' },
    onenote: { active: 0, pages: [{ title: 'Office notebook', content: 'Shared notes, filing plans, and next steps.\n\nAsk Archie to create a new page.' }], updatedBy: 'YOU + ARCHIE' },
    classroom: { posts: [{ title: 'Welcome to IRA Classroom', body: 'A local class stream for lessons and assignments. It is not synchronized to Google Classroom.', author: 'ECHO', at: Date.now() }], updatedBy: 'YOU + ECHO' },
    whiteboard: { strokes: [], notes: [{ id: 1, text: 'Ask Sage for analysis, then draw around the notes.', x: 34, y: 34, color: '#173f66' }], color: '#79c7ff', size: 3, updatedBy: 'YOU + SAGE' },
    browser: { currentUrl: 'https://www.wikipedia.org', research: '', sources: [], updatedBy: 'YOU + SCOUT' },
  });
  function loadWorkspaces() {
    const defaults = makeDefaults();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return defaults;
      Object.keys(defaults).forEach(key => { if (saved[key] && typeof saved[key] === 'object') defaults[key] = { ...defaults[key], ...saved[key] }; });
      return defaults;
    } catch { return defaults; }
  }
  const office = {
    active: false, busy: false, directBusy: false, currentAgent: 'atlas', currentApp: 'research', tasks: [], outputs: {}, drafts: {},
    clock: null, sequence: 0, workspaces: loadWorkspaces(), browserDrawing: false,
  };
  let brainKind = 'checking';

  function saveWorkspaces() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(office.workspaces)); } catch { /* Storage quotas must not break editing. */ } }
  function notify(message) { if (typeof window.toast === 'function') window.toast(message); }
  function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
  async function api(path, options = {}, timeout = 70000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(path, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || `IRA Office request failed (${response.status}).`);
      return data;
    } finally { clearTimeout(timer); }
  }
  function post(path, body, timeout) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeout); }
  function addLog(message) {
    const log = $('#officeActivityLog'), row = document.createElement('div'), time = document.createElement('time'), text = document.createElement('span');
    time.textContent = now(); text.textContent = message; row.append(time, text); log.prepend(row);
    while (log.children.length > 35) log.lastElementChild.remove();
  }
  function brainLabel(kind) { return { checking: 'CHECKING SHARED BRAIN', ollama: 'OLLAMA · LOCAL BRAIN', online: 'CLOUD BRAIN · ONLINE', ready: 'OLLAMA OFFLINE · FALLBACK READY', gateway: 'AI GATEWAY · ONLINE', fallback: 'LIVE KNOWLEDGE · FALLBACK', duckduckgo: 'DUCKDUCKGO · FALLBACK', offline: 'OFFLINE · START OLLAMA' }[kind] || 'SHARED IRA BRAIN'; }
  function updateBrain(kind, reason = '') { brainKind = kind; const label = brainLabel(kind); $('#officeBrainStatus').textContent = label; $('#officeBrainStatus').title = reason; $('#officeWorkspaceEngine').textContent = label; }
  document.addEventListener('ira:brain-status', event => updateBrain(event.detail.kind, event.detail.reason));
  async function refreshBrain() {
    try { const health = await api('/api/health', { cache: 'no-store' }, 6000); updateBrain(health.ollama?.ready ? 'ollama' : health.cloudBrain ? 'ready' : 'offline', health.ollama?.ready ? `Using local ${health.ollama.model}.` : 'Ollama is not ready. IRA will use existing knowledge fallbacks.'); }
    catch (error) { updateBrain('offline', error.message); }
  }
  function tickClock() { $('#officeClock').textContent = now(); }
  function enter() { office.active = true; tickClock(); refreshBrain(); if (!office.clock) office.clock = setInterval(tickClock, 1000); }
  function leave() { office.active = false; if (office.clock) clearInterval(office.clock); office.clock = null; $('#officeBrowserFrame').src = 'about:blank'; saveWorkspaces(); }

  function workspace(app = office.currentApp) { return office.workspaces[app]; }
  function padCells(cells, rows, columns) {
    const result = (Array.isArray(cells) ? cells : []).slice(0, 40).map(row => Array.isArray(row) ? row.map(value => String(value ?? '')) : [String(row ?? '')]);
    while (result.length < rows) result.push([]);
    result.forEach(row => { while (row.length < columns) row.push(''); });
    return result.map(row => row.slice(0, Math.max(columns, row.length)));
  }
  function cellsToCsv(cells) {
    return cells.map(row => row.map(value => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }).join(',')).join('\n');
  }
  function presentationText(data = workspace('powerpoint')) { return `Slide: ${data.title}\n${data.slides.map(slide => `Slide: ${slide.title}\n${slide.bullets.map(item => `- ${item}`).join('\n')}`).join('\n')}`; }
  function notebookText(data = workspace('onenote')) { return data.pages.map(page => `# ${page.title}\n\n${page.content}`).join('\n\n---\n\n'); }
  function classroomText(data = workspace('classroom')) { return data.posts.map(post => `${post.title}\n${post.body}\n— ${post.author}`).join('\n\n'); }
  function workText(app) {
    const data = workspace(app); if (!data) return '';
    if (app === 'code') return data.files.map(file => `// File: ${file.name}\n${file.content}`).join('\n\n');
    if (app === 'word') return `${data.title}\n\n${data.content}`;
    if (app === 'excel') return cellsToCsv(data.cells);
    if (app === 'powerpoint') return presentationText(data);
    if (app === 'onenote') return notebookText(data);
    if (app === 'classroom') return classroomText(data);
    if (app === 'whiteboard') return data.notes.map(note => `- ${note.text}`).join('\n');
    if (app === 'browser') return `Current page or query: ${office.currentUrl}\n${data.research}`;
    return office.outputs[`atlas:research`]?.text || '';
  }
  function captureCurrentWorkspace() {
    const app = office.currentApp, data = workspace(app); if (!data) return;
    if (app === 'code' && $('#codeEditor')) {
      const file = data.files[data.active] || data.files[0]; file.content = $('#codeEditor').value;
      file.name = $('#codeFileName').value.trim() || file.name; file.language = $('#codeLanguage').value;
    } else if (app === 'word' && $('#wordPage')) {
      data.title = $('#wordTitle').value.trim() || 'IRA Document'; data.content = editableText($('#wordPage'));
    } else if (app === 'excel' && $('#excelGrid')) {
      $$('#excelGrid [data-cell]').forEach(input => { const [row, column] = input.dataset.cell.split(':').map(Number); if (!data.cells[row]) data.cells[row] = []; data.cells[row][column] = input.value; });
      data.title = $('#excelTitle').value.trim() || 'IRA Workbook';
    } else if (app === 'powerpoint' && $('#slideTitle')) {
      const slide = data.slides[data.active]; if (slide) { slide.title = $('#slideTitle').value; slide.bullets = $('#slideBullets').value.split('\n').map(text => text.replace(/^[-*•]\s*/, '')).filter(Boolean); }
      data.title = $('#presentationTitle').value.trim() || 'IRA Presentation';
    } else if (app === 'onenote' && $('#notePage')) {
      const page = data.pages[data.active]; if (page) { page.title = $('#noteTitle').value.trim() || 'Untitled page'; page.content = editableText($('#notePage')); }
    } else if (app === 'whiteboard') {
      $$('.whiteboard-note', $('#officeSpecializedWorkspace')).forEach(element => { const note = data.notes.find(item => String(item.id) === element.dataset.noteId); if (note) note.text = editableText($('.whiteboard-note-text', element)); });
    }
    saveWorkspaces();
  }
  function markUserEdit(app = office.currentApp) { const data = workspace(app); if (data) { data.updatedBy = 'YOU'; data.updatedAt = Date.now(); } saveWorkspaces(); }

  function setAgentStatus(agent, status) {
    const card = $(`.office-agent[data-agent="${agent}"]`); if (!card) return;
    card.classList.remove('working', 'complete', 'error'); if (status !== 'ready') card.classList.add(status);
    $('em', card).textContent = { working: 'WORKING', complete: 'COMPLETE', error: 'CHECK TASK', ready: 'READY' }[status] || 'READY';
  }
  function progress() {
    const total = office.tasks.length, finished = office.tasks.filter(task => ['complete', 'error'].includes(task.status)).length;
    $('#officeProgressBar').style.width = total ? `${Math.round(finished / total * 100)}%` : '0%';
    const active = office.tasks.filter(task => task.status === 'working').length;
    $('#officeTaskCount').textContent = total ? `${active} ACTIVE · ${finished}/${total} FINISHED` : '0 ACTIVE TASKS';
  }
  function renderTasks() {
    const list = $('#officeTaskList'); list.replaceChildren();
    if (!office.tasks.length) { const empty = document.createElement('div'); empty.className = 'office-empty-state'; empty.textContent = 'No assignments yet. Your staff is ready.'; list.append(empty); progress(); return; }
    office.tasks.forEach(task => {
      const role = roles[task.agent], button = document.createElement('button'); button.type = 'button'; button.className = `office-task-item ${task.status}`;
      const avatar = document.createElement('span'); avatar.className = 'office-task-avatar'; avatar.textContent = role.name.slice(0, 2);
      const copy = document.createElement('div'), name = document.createElement('b'), assignment = document.createElement('small');
      name.textContent = `${role.name} · ${apps[task.app]?.title || 'Workspace'}`; assignment.textContent = task.task; assignment.title = task.task; copy.append(name, assignment);
      const status = document.createElement('em'); status.textContent = task.status.toUpperCase(); button.append(avatar, copy, status); button.onclick = () => openTask(task); list.append(button);
    }); progress();
  }
  function outputKey(agent = office.currentAgent, app = office.currentApp) { return `${agent}:${app}`; }
  function showOutput(record) {
    $('#officeAgentOutput').textContent = record?.text || 'Select an agent and run an assignment. The result will appear here.';
    $('#officeOutputStatus').textContent = record?.engine ? `${record.engine.toUpperCase()} · ANSWER READY` : 'READY';
    $('#officeOutputFileName').textContent = 'NO FILE GENERATED'; $('#officeDownloadOutput').disabled = !record?.text; $('#officeCopyOutput').disabled = !record?.text;
    $('#officeDownloadOutput').textContent = 'DOWNLOAD';
  }
  function parseTable(text) {
    const clean = String(text || '').replace(/```(?:csv|json|markdown)?/gi, '').replace(/```/g, '').trim();
    try {
      let parsed = JSON.parse(clean); if (!Array.isArray(parsed) && parsed) parsed = parsed.rows || parsed.data;
      if (Array.isArray(parsed) && parsed.length) {
        if (typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) { const headers = [...new Set(parsed.flatMap(row => Object.keys(row)))]; return [headers, ...parsed.map(row => headers.map(key => row[key] ?? ''))]; }
        return parsed.map(row => Array.isArray(row) ? row : [row]);
      }
    } catch { /* CSV/Markdown follows. */ }
    const lines = clean.split('\n').filter(line => line.trim());
    if (lines[0]?.includes('|')) return lines.filter(line => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line)).map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
    return lines.map(line => {
      const cells = []; let value = '', quoted = false;
      for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted; } else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; } else value += char; }
      cells.push(value.trim()); return cells;
    });
  }
  function syncTaskToWorkspace(task) {
    if (!task.answer || !specialized.has(task.app) && task.app !== 'browser') return;
    const data = workspace(task.app), answer = task.answer.trim(), role = roles[task.agent];
    if (task.app === 'code') {
      const content = answer.replace(/^```[\w-]*\n?/, '').replace(/```$/, '').trim() + '\n';
      const fileIndex = task.agent === 'byte' ? 1 : 0;
      if (!data.files[fileIndex]) data.files.push({ name: 'qa-review.md', language: 'markdown', content: '' });
      data.files[fileIndex].content = content; data.active = fileIndex;
    } else if (task.app === 'word') {
      data.content = answer; const heading = answer.match(/^#\s+(.+)$/m); data.title = heading?.[1] || task.task.slice(0, 70);
    } else if (task.app === 'excel') {
      const rows = parseTable(answer); const columns = Math.max(8, ...rows.map(row => row.length)); data.cells = padCells(rows, Math.max(14, rows.length + 3), columns); data.title = task.task.slice(0, 70) || data.title;
    } else if (task.app === 'powerpoint') {
      const slides = []; let current = null;
      answer.split('\n').forEach(raw => { const line = raw.trim(), match = line.match(/^(?:#+\s*)?slide(?:\s*\d+)?\s*[:.\-]\s*(.+)$/i); if (match) { if (current) slides.push(current); current = { title: match[1], bullets: [] }; } else if (line) { if (!current) current = { title: task.task.slice(0, 60), bullets: [] }; current.bullets.push(line.replace(/^[-*•]\s*/, '')); } });
      if (current) slides.push(current); if (slides.length) { data.slides = slides.slice(0, 12); data.active = 0; } data.title = task.task.slice(0, 70) || data.title;
    } else if (task.app === 'onenote') {
      const heading = answer.match(/^#\s+(.+)$/m), content = heading ? answer.replace(heading[0], '').trimStart() : answer;
      data.pages.unshift({ title: heading?.[1] || task.task.slice(0, 60) || 'IRA note', content }); data.pages = data.pages.slice(0, 15); data.active = 0;
    } else if (task.app === 'classroom') {
      const lines = answer.split('\n'), firstIndex = lines.findIndex(line => line.trim()), first = lines[firstIndex]?.replace(/^#+\s*/, '') || 'IRA class post';
      const body = lines.filter((_, index) => index !== firstIndex).join('\n').trim() || answer;
      data.posts.unshift({ title: first.slice(0, 90), body, author: role.name, at: Date.now() }); data.posts = data.posts.slice(0, 25);
    } else if (task.app === 'whiteboard') {
      const lines = answer.split('\n').map(line => line.replace(/^[-*•\d.\s]+/, '').trim()).filter(Boolean).slice(0, 6), start = data.notes.length;
      lines.forEach((text, index) => { const slot = start + index; data.notes.push({ id: Date.now() + index, text: text.slice(0, 180), x: 30 + (slot % 4) * 235, y: 30 + Math.floor(slot / 4) * 135, color: ['#173f66', '#27446e', '#164f58'][slot % 3] }); }); data.notes = data.notes.slice(-18);
    } else if (task.app === 'browser') {
      data.research = answer; data.sources = [...new Set(answer.match(/https?:\/\/[^\s<>"')\]]+/g) || [])].map(url => url.replace(/[.,;:]+$/, '')).slice(0, 8);
    }
    data.updatedBy = role.name; data.updatedAt = Date.now(); saveWorkspaces();
  }
  function storeOutput(task) {
    const record = { text: task.answer || task.error || '', engine: task.engine || task.status, task: task.task };
    office.outputs[`${task.agent}:${task.app}`] = record;
    if (task.answer) syncTaskToWorkspace(task);
    if (task.app === office.currentApp && specialized.has(task.app)) renderSpecializedApp(task.app);
    else if (task.app === office.currentApp && task.app === 'browser') updateBrowserFindings();
    else if (task.app === 'research' && outputKey(task.agent, task.app) === outputKey()) showOutput(record);
  }

  function updateWorkspaceHeader() {
    const role = roles[office.currentAgent], config = apps[office.currentApp];
    $('#officeStaffSelect').value = office.currentAgent;
    $('#officeWorkspaceTitle').textContent = config.title; $('#officeWorkspaceIcon').textContent = config.icon;
    const shared = office.currentApp === 'code' ? ' · PIXEL + BYTE SHARE FILES' : ` · ${config.title.split('·')[1]?.trim() || 'WORKSPACE'}`;
    $('#officeWorkspaceAgent').textContent = `${role.name} · ${role.role}${shared}`;
    $$('.office-workspace-tabs [data-office-app]').forEach(button => button.classList.toggle('active', button.dataset.officeApp === office.currentApp));
  }
  function openTask(task) {
    openAgent(task.agent, task.app);
    if (task.app === 'research') {
      office.drafts[outputKey()] = task.task; $('#officeAgentTask').value = task.task;
      if (task.status === 'working') { $('#officeAgentOutput').textContent = `${roles[task.agent].name} is working through IRA's shared brain…`; $('#officeOutputStatus').textContent = 'WORKING'; }
      else if (task.answer || task.error) showOutput(office.outputs[`${task.agent}:${task.app}`]);
    } else if (task.status === 'working' && $('#sectorAsk')) { $('#sectorAsk').disabled = true; $('#sectorAsk').textContent = `${roles[task.agent].name} WORKING…`; }
  }
  function openAgent(agent, preferredApp) {
    if (agent === 'boss') { $('#officeBossInput').focus(); return; }
    if (!roles[agent]) agent = 'atlas';
    captureCurrentWorkspace(); office.currentAgent = agent;
    $$('.office-agent').forEach(card => card.classList.toggle('selected', card.dataset.agent === agent));
    openApp(preferredApp || roles[agent].app, true, true); $('#officeWorkspace').hidden = false;
  }
  function openApp(app, preserveAgent = false, skipCapture = false) {
    if (!apps[app]) app = 'research';
    if (!skipCapture) captureCurrentWorkspace();
    if (!$('#officeAgentWorkspace').hidden) office.drafts[outputKey()] = $('#officeAgentTask').value;
    office.currentApp = app;
    if (!preserveAgent) { office.currentAgent = apps[app].agent; $$('.office-agent').forEach(card => card.classList.toggle('selected', card.dataset.agent === office.currentAgent)); }
    $('#officeWorkspace').hidden = false; updateWorkspaceHeader();
    const browser = app === 'browser', specialist = specialized.has(app);
    $('#officeBrowserWorkspace').hidden = !browser; $('#officeAgentWorkspace').hidden = app !== 'research'; $('#officeSpecializedWorkspace').hidden = !specialist;
    $('#officeWorkspaceEngine').textContent = browser ? 'EMBEDDED + EXTERNAL BROWSING' : brainLabel(brainKind);
    if (specialist) renderSpecializedApp(app);
    if (browser) { $('#officeBrowserUrl').value = office.currentUrl; updateBrowserFindings(); }
    if (app === 'research') {
      const config = apps.research; $('#officeAgentTaskLabel').textContent = config.label; $('#officeAgentTask').placeholder = config.placeholder; $('#officeAgentHint').textContent = config.hint;
      $('#officeAgentTask').value = office.drafts[outputKey()] || ''; showOutput(office.outputs[outputKey()]);
    }
  }

  function directiveTemplate(app, toolbar = '') {
    const role = roles[office.currentAgent], config = apps[app], data = workspace(app);
    return `<section class="sector-directive"><div><span>${esc(role.name)} · ${esc(config.title.split('·')[1] || 'WORKSPACE')}</span><small>SHARED WORK · ${esc(data?.updatedBy || 'YOU + ' + role.name)}</small></div><input id="sectorDirective" maxlength="1800" placeholder="${esc(config.directive)}" aria-label="Assignment for ${esc(role.name)}"><button type="button" id="sectorAsk">ASK ${esc(role.name)} ↗</button>${toolbar}</section>`;
  }
  function renderSpecializedApp(app) {
    if (!specialized.has(app) || office.currentApp !== app) return;
    const mount = $('#officeSpecializedWorkspace'), data = workspace(app); mount.hidden = false;
    if (app === 'code') {
      const file = data.files[data.active] || data.files[0];
      mount.innerHTML = `${directiveTemplate(app)}<div class="vscode-shell"><aside class="vscode-sidebar"><b>EXPLORER</b><span>IRA ENGINEERING</span>${data.files.map((item, index) => `<button type="button" data-code-file="${index}" class="${index === data.active ? 'active' : ''}">${esc(item.name.endsWith('.md') ? '▤' : '⋄')} ${esc(item.name)}</button>`).join('')}<button type="button" id="codeAddFile">＋ NEW FILE</button><div class="vscode-agents"><small>SECTOR STAFF</small><button type="button" data-code-agent="pixel" class="${office.currentAgent === 'pixel' ? 'active' : ''}">PIXEL · BUILD</button><button type="button" data-code-agent="byte" class="${office.currentAgent === 'byte' ? 'active' : ''}">BYTE · QA</button></div></aside><section class="vscode-main"><header><span>● ● ●</span><input id="codeFileName" value="${esc(file.name)}" aria-label="Code file name"><select id="codeLanguage" aria-label="Programming language">${['python', 'javascript', 'html', 'css', 'json', 'markdown', 'text'].map(language => `<option ${language === file.language ? 'selected' : ''}>${language}</option>`).join('')}</select><button type="button" id="codeDownload">DOWNLOAD FILE</button></header><div class="vscode-tab">${esc(file.name)}<small>SHARED · EDITABLE</small></div><div class="vscode-editor"><pre id="codeLineNumbers"></pre><textarea id="codeEditor" spellcheck="false" aria-label="Shared code editor">${esc(file.content)}</textarea></div><footer><span>Ln <b id="codeLineCount">1</b> · UTF-8</span><span id="sectorFileStatus">PIXEL & BYTE SEE THE SAME FILES</span></footer></section></div>`;
      setupCodeEditor();
    } else if (app === 'word') {
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="wordDownload">DOCX ↓</button>')}<div class="word-shell"><div class="word-ribbon"><input id="wordTitle" value="${esc(data.title)}" aria-label="Document title"><button type="button" data-word-command="bold"><b>B</b></button><button type="button" data-word-command="italic"><i>I</i></button><button type="button" data-word-command="underline"><u>U</u></button><button type="button" data-word-command="insertUnorderedList">• List</button><button type="button" data-word-command="removeFormat">Clear</button><span id="wordCount">0 WORDS</span></div><div class="word-canvas"><article id="wordPage" class="word-page" contenteditable="true" spellcheck="true" aria-label="Editable Word document">${richText(data.content)}</article></div><footer class="app-statusbar"><span>PAGE 1 · SHARED DOCUMENT</span><span id="sectorFileStatus">WORDEN CAN REVISE YOUR CURRENT TEXT</span></footer></div>`;
      setupWordEditor();
    } else if (app === 'excel') {
      data.cells = padCells(data.cells, 14, 8); const rows = data.cells.length, columns = Math.max(8, ...data.cells.map(row => row.length));
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="excelDownload">XLSX ↓</button>')}<div class="excel-shell"><div class="excel-ribbon"><input id="excelTitle" value="${esc(data.title)}" aria-label="Workbook title"><input id="excelFormula" placeholder="Select a cell or enter a value" aria-label="Formula bar"><button type="button" id="excelAddRow">＋ ROW</button><button type="button" id="excelAddColumn">＋ COLUMN</button></div><div class="excel-scroll"><table id="excelGrid"><thead><tr><th></th>${Array.from({ length: columns }, (_, index) => `<th>${columnName(index)}</th>`).join('')}</tr></thead><tbody>${data.cells.map((row, rowIndex) => `<tr><th>${rowIndex + 1}</th>${Array.from({ length: columns }, (_, columnIndex) => `<td><input data-cell="${rowIndex}:${columnIndex}" value="${esc(row[columnIndex] || '')}" aria-label="Cell ${columnName(columnIndex)}${rowIndex + 1}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><footer class="app-statusbar"><span id="excelSelection">A1</span><span id="sectorFileStatus">GRID RECEIVES THIS EXACT TABLE</span></footer></div>`;
      setupExcelEditor();
    } else if (app === 'powerpoint') {
      const slide = data.slides[data.active] || data.slides[0];
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="presentationDownload">PPTX ↓</button>')}<div class="presentation-shell"><header class="presentation-ribbon"><input id="presentationTitle" value="${esc(data.title)}" aria-label="Presentation title"><button type="button" id="slideAdd">＋ NEW SLIDE</button><button type="button" id="slideDelete">DELETE</button><span>${data.active + 1} / ${data.slides.length}</span></header><div class="presentation-workspace"><aside class="slide-thumbnails">${data.slides.map((item, index) => `<button type="button" data-slide="${index}" class="${index === data.active ? 'active' : ''}"><small>${index + 1}</small><b>${esc(item.title)}</b><span>${esc(item.bullets[0] || '')}</span></button>`).join('')}</aside><section class="slide-stage"><div class="slide-canvas"><input id="slideTitle" value="${esc(slide.title)}" aria-label="Slide title"><textarea id="slideBullets" aria-label="Slide bullet points">${esc(slide.bullets.map(item => `• ${item}`).join('\n'))}</textarea><small>IRA OFFICE · SHARED DECK</small></div></section></div></div>`;
      setupPresentationEditor();
    } else if (app === 'onenote') {
      const page = data.pages[data.active] || data.pages[0];
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="notebookDownload">DOCX ↓</button>')}<div class="onenote-shell"><aside class="onenote-pages"><header>IRA NOTEBOOK<button type="button" id="noteAddPage">＋</button></header>${data.pages.map((item, index) => `<button type="button" data-note-page="${index}" class="${index === data.active ? 'active' : ''}"><b>${esc(item.title)}</b><small>${esc(item.content.split('\n').find(line => line.trim() && !line.startsWith('#')) || 'Notes')}</small></button>`).join('')}</aside><section class="onenote-editor"><header><input id="noteTitle" value="${esc(page.title)}" aria-label="Notebook page title"><span>SHARED PAGE</span></header><article id="notePage" contenteditable="true" aria-label="Editable OneNote page">${richText(page.content)}</article><footer class="app-statusbar"><span>ARCHIE · NOTEBOOK</span><span id="sectorFileStatus">NEW AGENT WORK APPEARS AS A NEW PAGE</span></footer></section></div>`;
      setupNotebookEditor();
    } else if (app === 'classroom') {
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="classroomDownload">EXPORT ↓</button>')}<div class="classroom-shell"><header class="classroom-banner"><div><small>LOCAL CLASSROOM · NOT GOOGLE SYNCED</small><h2>IRA Learning & Operations</h2><span>10 staff members · shared class stream</span></div><b>IE</b></header><section class="classroom-composer"><input id="classPostTitle" placeholder="Announcement or assignment title"><textarea id="classPostBody" placeholder="Write instructions to the class…"></textarea><button type="button" id="classPostPublish">POST TO STREAM</button></section><div class="classroom-stream">${data.posts.map(post => `<article><span>${esc(post.author.slice(0, 2))}</span><div><small>${esc(post.author)} · ${new Date(post.at).toLocaleDateString()}</small><h3>${esc(post.title)}</h3><p>${esc(post.body)}</p></div></article>`).join('')}</div></div>`;
      setupClassroom();
    } else if (app === 'whiteboard') {
      mount.innerHTML = `${directiveTemplate(app, '<button type="button" id="whiteboardExport">PNG ↓</button>')}<div class="whiteboard-shell"><div class="whiteboard-tools"><button type="button" data-board-color="#79c7ff">BLUE</button><button type="button" data-board-color="#ffca7a">AMBER</button><button type="button" data-board-color="#a6f0d0">GREEN</button><label>SIZE <input id="boardSize" type="range" min="1" max="12" value="${data.size}"></label><button type="button" id="boardAddNote">＋ NOTE</button><button type="button" id="boardClear">CLEAR DRAWING</button></div><div class="whiteboard-canvas-wrap" id="whiteboardWrap"><canvas id="whiteboardCanvas" width="960" height="520"></canvas>${data.notes.map(note => `<div class="whiteboard-note" data-note-id="${note.id}" style="left:${note.x}px;top:${note.y}px;background:${esc(note.color)}"><div class="whiteboard-note-text" contenteditable="true">${esc(note.text)}</div></div>`).join('')}</div><footer class="app-statusbar"><span>DRAW WITH MOUSE OR TOUCH · EDIT STICKY NOTES</span><span id="sectorFileStatus">SAGE ADDS ANALYSIS TO THIS BOARD</span></footer></div>`;
      setupWhiteboard();
    }
    const ask = $('#sectorAsk'); if (ask) { ask.onclick = () => runSectorTask(); $('#sectorDirective').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); runSectorTask(); } }); }
  }
  function columnName(index) { let name = '', value = index + 1; while (value) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26); } return name; }
  function updateLineNumbers() { const editor = $('#codeEditor'); if (!editor) return; const count = editor.value.split('\n').length; $('#codeLineNumbers').textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n'); $('#codeLineCount').textContent = count; }
  function setupCodeEditor() {
    const editor = $('#codeEditor'); updateLineNumbers(); $('#codeLineNumbers').scrollTop = editor.scrollTop;
    editor.addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('code'); updateLineNumbers(); }); editor.addEventListener('scroll', () => { $('#codeLineNumbers').scrollTop = editor.scrollTop; });
    $('#codeFileName').addEventListener('change', () => { captureCurrentWorkspace(); markUserEdit('code'); renderSpecializedApp('code'); }); $('#codeLanguage').addEventListener('change', () => { captureCurrentWorkspace(); markUserEdit('code'); });
    $$('[data-code-file]').forEach(button => button.onclick = () => { captureCurrentWorkspace(); workspace('code').active = Number(button.dataset.codeFile); saveWorkspaces(); renderSpecializedApp('code'); });
    $$('[data-code-agent]').forEach(button => button.onclick = () => { captureCurrentWorkspace(); office.currentAgent = button.dataset.codeAgent; updateWorkspaceHeader(); renderSpecializedApp('code'); });
    $('#codeAddFile').onclick = () => { captureCurrentWorkspace(); const data = workspace('code'); data.files.push({ name: `untitled-${data.files.length + 1}.js`, language: 'javascript', content: '// New shared file\n' }); data.active = data.files.length - 1; markUserEdit('code'); renderSpecializedApp('code'); };
    $('#codeDownload').onclick = () => { captureCurrentWorkspace(); const data = workspace('code'), file = data.files[data.active]; downloadBlob(new Blob([file.content], { type: 'text/plain;charset=utf-8' }), file.name); };
  }
  function setupWordEditor() {
    const page = $('#wordPage'), count = () => { $('#wordCount').textContent = `${(editableText(page).trim().match(/\S+/g) || []).length} WORDS`; }; count();
    page.addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('word'); count(); }); $('#wordTitle').addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('word'); });
    $$('[data-word-command]').forEach(button => { button.onmousedown = event => event.preventDefault(); button.onclick = () => { document.execCommand(button.dataset.wordCommand, false); page.focus(); captureCurrentWorkspace(); markUserEdit('word'); }; });
    $('#wordDownload').onclick = () => downloadOfficeFile('word', $('#wordTitle').value, workText('word'));
  }
  function setupExcelEditor() {
    const select = input => { $('#excelSelection').textContent = `${columnName(Number(input.dataset.cell.split(':')[1]))}${Number(input.dataset.cell.split(':')[0]) + 1}`; $('#excelFormula').value = input.value; $('#excelFormula').dataset.cell = input.dataset.cell; };
    $$('#excelGrid [data-cell]').forEach(input => { input.addEventListener('focus', () => select(input)); input.addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('excel'); $('#excelFormula').value = input.value; }); });
    $('#excelFormula').addEventListener('input', event => { const ref = event.target.dataset.cell; if (!ref) return; const input = $(`#excelGrid [data-cell="${ref}"]`); if (input) { input.value = event.target.value; input.dispatchEvent(new Event('input')); } });
    $('#excelTitle').addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('excel'); });
    $('#excelAddRow').onclick = () => { captureCurrentWorkspace(); const data = workspace('excel'); data.cells.push(Array(Math.max(8, ...data.cells.map(row => row.length))).fill('')); markUserEdit('excel'); renderSpecializedApp('excel'); };
    $('#excelAddColumn').onclick = () => { captureCurrentWorkspace(); workspace('excel').cells.forEach(row => row.push('')); markUserEdit('excel'); renderSpecializedApp('excel'); };
    $('#excelDownload').onclick = () => downloadOfficeFile('excel', $('#excelTitle').value, workText('excel'));
  }
  function setupPresentationEditor() {
    ['slideTitle', 'slideBullets', 'presentationTitle'].forEach(id => $(`#${id}`).addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('powerpoint'); }));
    $$('[data-slide]').forEach(button => button.onclick = () => { captureCurrentWorkspace(); workspace('powerpoint').active = Number(button.dataset.slide); saveWorkspaces(); renderSpecializedApp('powerpoint'); });
    $('#slideAdd').onclick = () => { captureCurrentWorkspace(); const data = workspace('powerpoint'); data.slides.push({ title: 'New slide', bullets: ['Add your first point'] }); data.active = data.slides.length - 1; markUserEdit('powerpoint'); renderSpecializedApp('powerpoint'); };
    $('#slideDelete').onclick = () => { const data = workspace('powerpoint'); if (data.slides.length <= 1) return notify('A presentation needs at least one slide.'); data.slides.splice(data.active, 1); data.active = Math.max(0, data.active - 1); markUserEdit('powerpoint'); renderSpecializedApp('powerpoint'); };
    $('#presentationDownload').onclick = () => downloadOfficeFile('powerpoint', $('#presentationTitle').value, workText('powerpoint'));
  }
  function setupNotebookEditor() {
    ['noteTitle'].forEach(id => $(`#${id}`).addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('onenote'); })); $('#notePage').addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('onenote'); });
    $$('[data-note-page]').forEach(button => button.onclick = () => { captureCurrentWorkspace(); workspace('onenote').active = Number(button.dataset.notePage); saveWorkspaces(); renderSpecializedApp('onenote'); });
    $('#noteAddPage').onclick = () => { captureCurrentWorkspace(); const data = workspace('onenote'); data.pages.unshift({ title: 'Untitled page', content: 'Write shared notes here…' }); data.active = 0; markUserEdit('onenote'); renderSpecializedApp('onenote'); };
    $('#notebookDownload').onclick = () => downloadOfficeFile('word', $('#noteTitle').value, workText('onenote'));
  }
  function setupClassroom() {
    $('#classPostPublish').onclick = () => { const title = $('#classPostTitle').value.trim(), body = $('#classPostBody').value.trim(); if (!title || !body) return notify('Add a title and instructions before posting.'); workspace('classroom').posts.unshift({ title, body, author: 'YOU', at: Date.now() }); markUserEdit('classroom'); renderSpecializedApp('classroom'); };
    $('#classroomDownload').onclick = () => downloadBlob(new Blob([workText('classroom')], { type: 'text/plain;charset=utf-8' }), 'IRA-Classroom.txt');
  }
  function setupWhiteboard() {
    const canvas = $('#whiteboardCanvas'), data = workspace('whiteboard');
    canvas.height = Math.max(520, ...data.notes.map(note => Number(note.y) + 145));
    const context = canvas.getContext('2d');
    function point(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / (rect.width || canvas.width), y: (event.clientY - rect.top) * canvas.height / (rect.height || canvas.height) }; }
    function stroke(line) { if (!line.points.length) return; context.beginPath(); context.strokeStyle = line.color; context.lineWidth = line.size; context.lineCap = 'round'; context.lineJoin = 'round'; context.moveTo(line.points[0].x, line.points[0].y); line.points.slice(1).forEach(p => context.lineTo(p.x, p.y)); context.stroke(); }
    context.fillStyle = '#071a2d'; context.fillRect(0, 0, canvas.width, canvas.height); data.strokes.forEach(stroke);
    canvas.onpointerdown = event => { event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); office.browserDrawing = true; const line = { color: data.color, size: Number($('#boardSize').value), points: [point(event)] }; data.strokes.push(line); stroke(line); };
    canvas.onpointermove = event => { if (!office.browserDrawing) return; const line = data.strokes[data.strokes.length - 1], p = point(event), previous = line.points[line.points.length - 1]; context.beginPath(); context.strokeStyle = line.color; context.lineWidth = line.size; context.lineCap = 'round'; context.moveTo(previous.x, previous.y); context.lineTo(p.x, p.y); context.stroke(); line.points.push(p); };
    canvas.onpointerup = () => { office.browserDrawing = false; markUserEdit('whiteboard'); }; canvas.onpointercancel = canvas.onpointerup;
    $$('[data-board-color]').forEach(button => button.onclick = () => { data.color = button.dataset.boardColor; saveWorkspaces(); }); $('#boardSize').oninput = event => { data.size = Number(event.target.value); saveWorkspaces(); };
    $$('.whiteboard-note-text').forEach(element => element.addEventListener('input', () => { captureCurrentWorkspace(); markUserEdit('whiteboard'); }));
    $('#boardAddNote').onclick = () => { const slot = data.notes.length; data.notes.push({ id: Date.now(), text: 'New shared note', x: 30 + slot % 4 * 235, y: 30 + Math.floor(slot / 4) * 135, color: data.color === '#ffca7a' ? '#665025' : '#173f66' }); markUserEdit('whiteboard'); renderSpecializedApp('whiteboard'); };
    $('#boardClear').onclick = () => { data.strokes = []; markUserEdit('whiteboard'); renderSpecializedApp('whiteboard'); }; $('#whiteboardExport').onclick = exportWhiteboard;
  }
  function exportWhiteboard() {
    const data = workspace('whiteboard'), canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = Math.max(520, ...data.notes.map(note => Number(note.y) + 145)); const context = canvas.getContext('2d'); context.fillStyle = '#071a2d'; context.fillRect(0, 0, canvas.width, canvas.height);
    data.strokes.forEach(line => { context.beginPath(); context.strokeStyle = line.color; context.lineWidth = line.size; context.lineCap = 'round'; line.points.forEach((p, index) => index ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)); context.stroke(); });
    data.notes.forEach(note => { context.fillStyle = note.color; context.fillRect(note.x, note.y, 190, 100); context.fillStyle = '#e5f3ff'; context.font = '14px sans-serif'; const words = note.text.split(/\s+/); let line = '', y = note.y + 22; words.forEach(word => { if (context.measureText(line + word).width > 170) { context.fillText(line, note.x + 10, y); y += 18; line = ''; } line += `${word} `; }); context.fillText(line, note.x + 10, y); });
    canvas.toBlob(blob => { if (blob) downloadBlob(blob, 'IRA-Whiteboard.png'); }, 'image/png');
  }

  async function executeTask(task, reveal = false) {
    task.status = 'working'; setAgentStatus(task.agent, 'working'); renderTasks(); if (reveal) openTask(task);
    addLog(`${roles[task.agent].name} started: ${task.task.slice(0, 90)}`);
    try {
      captureCurrentWorkspace(); const context = workText(task.app).slice(0, 3800), base = task.task.slice(0, 1900);
      const message = context ? `${base}\n\n[Current shared ${task.app} workspace. Preserve useful user work and return the updated artifact.]\n${context}` : base;
      const language = $('#language')?.value || 'en-IN', title = localStorage.getItem('iraUserTitle') || 'Commander';
      const data = await post('/api/office/task', { agent: task.agent, message, language, title }, 90000);
      if (!data.answer) throw Error('The shared brain returned an empty answer.');
      task.answer = data.answer; task.engine = data.engine || 'offline'; task.status = data.engine === 'offline' ? 'error' : 'complete'; if (task.status === 'error') task.error = data.answer;
      setAgentStatus(task.agent, task.status); storeOutput(task); addLog(`${roles[task.agent].name} updated the shared ${task.app} workspace via ${task.engine}.`);
      if (reveal) $('#officeWorkspaceEngine').textContent = brainLabel(task.engine);
    } catch (error) {
      task.status = 'error'; task.error = error.message; task.engine = 'error'; setAgentStatus(task.agent, 'error');
      office.outputs[`${task.agent}:${task.app}`] = { text: error.message, engine: 'error', task: task.task }; addLog(`${roles[task.agent].name} could not finish: ${error.message}`);
      if (reveal) notify(error.message);
    } finally { renderTasks(); const ask = $('#sectorAsk'); if (ask) { ask.disabled = false; ask.textContent = `ASK ${roles[office.currentAgent].name} ↗`; } $('#officeAgentRun').disabled = false; }
    return task;
  }
  async function startDirectTask(message) {
    if (office.busy) return notify('The boss is coordinating a plan. Please wait for it to finish.');
    if (office.directBusy) return notify('This staff member is still updating the shared workspace.');
    office.directBusy = true;
    const task = { id: `direct-${Date.now()}-${office.sequence++}`, agent: office.currentAgent, app: office.currentApp, task: message, status: 'queued' };
    office.tasks.unshift(task); office.tasks = office.tasks.slice(0, 12); $('#officeBossState').textContent = 'DIRECT ASSIGNMENT';
    try {
      await executeTask(task, true); $('#officeBossState').textContent = task.status === 'complete' ? 'SHARED WORKSPACE UPDATED' : 'CHECK AGENT OUTPUT';
    } finally { office.directBusy = false; }
  }
  function runSectorTask() { const directive = $('#sectorDirective')?.value.trim() || `Review and improve the current shared ${office.currentApp} workspace.`; startDirectTask(directive); }
  async function runDirect(event) { event.preventDefault(); if (office.currentApp !== 'research') return runSectorTask(); const message = $('#officeAgentTask').value.trim(); if (message) startDirectTask(message); }
  async function delegate(goal) {
    goal = String(goal || '').trim(); if (!goal) return; if (office.busy) { notify('IRA Prime is already coordinating a plan.'); return; }
    office.busy = true; office.tasks = []; renderTasks(); $('#officeBossInput').value = goal; $('#officeBossForm button[type="submit"]').disabled = true; $('#officeBossState').textContent = 'PLANNING DELEGATION'; $('#officeGoalSummary').textContent = goal; addLog(`Boss received objective: ${goal.slice(0, 130)}`);
    try {
      const plan = await post('/api/office/plan', { goal }, 15000); office.tasks = plan.tasks.map(task => ({ ...task, status: 'queued' })); $('#officeBossState').textContent = `${office.tasks.length} SPECIALISTS ASSIGNED`; addLog(`Rule-based boss delegated ${office.tasks.length} assignments.`); renderTasks();
      for (const task of office.tasks) { $('#officeBossState').textContent = `${roles[task.agent].name} IS WORKING`; await executeTask(task); }
      const failed = office.tasks.filter(task => task.status === 'error').length; $('#officeBossState').textContent = failed ? `COMPLETE · ${failed} NEED ATTENTION` : 'ALL ASSIGNMENTS COMPLETE';
      $('#officeGoalSummary').textContent = `${goal} — ${office.tasks.length - failed}/${office.tasks.length} assignments completed. Open the sector app to see and edit the shared work.`; addLog(`Boss plan finished: ${office.tasks.length - failed}/${office.tasks.length} successful.`); notify(failed ? 'Office plan finished with fallback/error tasks to review.' : 'IRA Office updated the delegated sector workspaces.');
    } catch (error) { $('#officeBossState').textContent = 'DELEGATION ERROR'; $('#officeGoalSummary').textContent = error.message; addLog(`Boss planning failed: ${error.message}`); notify(error.message); }
    finally { office.busy = false; $('#officeBossForm button[type="submit"]').disabled = false; progress(); }
  }

  function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  async function downloadOfficeFile(kind, title, content) {
    captureCurrentWorkspace(); const status = $('#sectorFileStatus'); if (status) status.textContent = 'GENERATING OFFICE FILE LOCALLY…';
    try {
      const data = await post('/api/office/file', { kind, title: title || 'IRA Shared Work', content: content || workText(office.currentApp) }, 30000), binary = atob(data.content), bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index); downloadBlob(new Blob([bytes], { type: data.mime }), data.filename); if (status) status.textContent = `${data.filename} · ${Math.ceil(data.size / 1024)} KB`; addLog(`Generated ${data.filename} from the shared ${office.currentApp} workspace.`);
    } catch (error) { if (status) status.textContent = 'FILE GENERATION FAILED'; notify(error.message); }
  }
  async function downloadOutput() { const record = office.outputs[outputKey()]; if (record?.text) downloadBlob(new Blob([record.text], { type: 'text/plain;charset=utf-8' }), `IRA-${roles[office.currentAgent].name}-${Date.now()}.txt`); }
  async function copyOutput() { const record = office.outputs[outputKey()]; if (!record?.text) return; try { await navigator.clipboard.writeText(record.text); notify('Agent output copied.'); } catch { notify('Clipboard permission was denied. Select the output text to copy it.'); } }
  function normalizeUrl(value) { const text = String(value || '').trim(); if (!text) return office.currentUrl; const url = /\s/.test(text) || (!/^https?:\/\//i.test(text) && !text.includes('.')) ? `https://duckduckgo.com/?q=${encodeURIComponent(text)}` : /^https?:\/\//i.test(text) ? text : `https://${text}`; const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw Error('Only HTTP and HTTPS browsing is allowed.'); return parsed.href; }
  function browse(value) { try { office.currentUrl = normalizeUrl(value); workspace('browser').currentUrl = office.currentUrl; saveWorkspaces(); $('#officeBrowserUrl').value = office.currentUrl; $('#officeBrowserFrame').src = office.currentUrl; addLog(`SCOUT opened ${office.currentUrl}.`); } catch (error) { notify(error.message); } }
  function updateBrowserFindings() { const data = workspace('browser'), panel = $('#officeBrowserFindings'); panel.hidden = !data.research; $('#officeBrowserResearchOutput').textContent = data.research || ''; const sources = $('#officeBrowserSources'); sources.replaceChildren(); (data.sources || []).forEach(url => { const button = document.createElement('button'); button.type = 'button'; button.textContent = url.replace(/^https?:\/\//, '').slice(0, 70); button.onclick = () => browse(url); sources.append(button); }); }

  $$('.office-agent').forEach(card => { card.onclick = () => openAgent(card.dataset.agent); });
  $$('[data-office-app]').forEach(button => { button.onclick = () => openApp(button.dataset.officeApp, Boolean(button.closest('.office-workspace'))); });
  $('#officeBossCard').onclick = () => $('#officeBossInput').focus();
  $('#officeBossForm').onsubmit = event => { event.preventDefault(); const input = $('#officeBossInput'), goal = input.value.trim(); input.value = ''; delegate(goal); };
  $('#officeBossMic').onclick = () => $('#micBtn').click(); $('#officeAgentForm').onsubmit = runDirect;
  $('#officeStaffSelect').onchange = event => openAgent(event.target.value);
  $('#officeWorkspaceClose').onclick = () => { captureCurrentWorkspace(); $('#officeWorkspace').hidden = true; $('#officeBrowserFrame').src = 'about:blank'; };
  $('#officeDownloadOutput').onclick = downloadOutput; $('#officeCopyOutput').onclick = copyOutput;
  $('#officeBrowserForm').onsubmit = event => { event.preventDefault(); browse($('#officeBrowserUrl').value); };
  $('#officeBrowserResearch').onclick = () => { office.currentAgent = 'scout'; startDirectTask(`Research this browser page or query and return findings with reliable source URLs: ${$('#officeBrowserUrl').value}`); };
  $('#officeBrowserFindingsClose').onclick = () => { $('#officeBrowserFindings').hidden = true; };
  $('#officeBrowserExternal').onclick = () => window.open(office.currentUrl, '_blank', 'noopener,noreferrer');
  $$('[data-office-url]').forEach(button => { button.onclick = () => browse(button.dataset.officeUrl); });
  office.currentUrl = workspace('browser').currentUrl || 'https://www.wikipedia.org';
  window.IRAOffice = { enter, leave, delegate, openAgent, openApp, refreshBrain, captureCurrentWorkspace, getState: () => ({ ...office, tasks: office.tasks.map(task => ({ ...task })) }) };
  window.askOffice = delegate; tickClock(); updateBrain('checking');
})();
