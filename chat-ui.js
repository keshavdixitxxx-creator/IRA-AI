/* IRA Chat — UI 7. Simple conversational interface (Gemini/ChatGPT style):
   one stream, one rounded composer, honest engine chip, local persistence. */
(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const STORE_KEY = 'iraChatHistoryV1';
  const MAX_MESSAGES = 60;

  let busy = false;
  let revealTimer = null;
  let messages = [];

  const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      messages = Array.isArray(data) ? data.slice(-MAX_MESSAGES) : [];
    } catch {
      messages = [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      // Quota exceeded or blocked — the chat still works, just isn't persisted.
    }
  }

  function userInitial() {
    const t = (typeof state !== 'undefined' && state.userTitle) || localStorage.getItem('iraUserTitle') || 'You';
    return String(t).trim().charAt(0).toUpperCase() || 'Y';
  }

  function scrollToEnd() {
    const scroller = $('#chatScroll');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  function renderEmptyState() {
    const empty = $('#chatEmpty');
    if (empty) empty.style.display = messages.length ? 'none' : '';
  }

  function appendRow(role) {
    const inner = $('#chatInner');
    if (!inner) return null;
    const row = document.createElement('div');
    row.className = 'chat-msg ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'ira' ? 'IA' : userInitial();
    const body = document.createElement('div');
    const roleLine = document.createElement('div');
    roleLine.className = 'chat-role';
    roleLine.textContent = role === 'ira' ? 'IRA' : ((typeof state !== 'undefined' && state.userTitle) || 'YOU').toUpperCase();
    const text = document.createElement('div');
    text.className = 'chat-text';
    body.append(roleLine, text);
    row.append(avatar, body);
    inner.appendChild(row);
    return { row, roleLine, text };
  }

  function addIraBadge(roleLine, engine) {
    if (!engine) return;
    const badge = document.createElement('span');
    badge.className = 'chat-engine';
    badge.textContent = String(engine).replace('cloud-brain', 'cloud brain');
    roleLine.appendChild(badge);
  }

  function renderMessage(msg, { animate } = {}) {
    const parts = appendRow(msg.role);
    if (!parts) return;
    parts.text.textContent = msg.content;
    if (msg.role === 'ira' && msg.engine) addIraBadge(parts.roleLine, msg.engine);
    if (animate && msg.role === 'ira') typewriter(parts.text, msg.content);
  }

  function typewriter(el, fullText) {
    if (revealTimer) clearInterval(revealTimer);
    const text = String(fullText);
    let i = 0;
    el.classList.add('typing');
    el.textContent = '';
    revealTimer = setInterval(() => {
      i = Math.min(text.length, i + 2);
      el.textContent = text.slice(0, i);
      scrollToEnd();
      if (i >= text.length) {
        clearInterval(revealTimer);
        revealTimer = null;
        el.classList.remove('typing');
      }
    }, 8);
    const finish = () => {
      if (revealTimer) clearInterval(revealTimer);
      revealTimer = null;
      el.textContent = text;
      el.classList.remove('typing');
    };
    el.addEventListener('click', finish, { once: true });
  }

  function rebuildStream() {
    const inner = $('#chatInner');
    if (!inner) return;
    inner.replaceChildren();
    messages.forEach((msg) => renderMessage(msg, { animate: false }));
    renderEmptyState();
    scrollToEnd();
  }

  function setBusy(on) {
    busy = on;
    const send = $('#chatSend');
    if (send) send.disabled = on;
  }

  function showThinking() {
    const inner = $('#chatInner');
    if (!inner) return null;
    const row = document.createElement('div');
    row.className = 'chat-msg ira chat-thinking-row';
    row.innerHTML = '<div class="chat-avatar">IA</div><div class="chat-thinking" aria-label="IRA is thinking"><i></i><i></i><i></i></div>';
    inner.appendChild(row);
    scrollToEnd();
    return row;
  }

  async function askChat(question) {
    const q = String(question || '').trim();
    if (!q || busy) return null;
    setBusy(true);

    messages.push({ role: 'you', content: q });
    const userParts = appendRow('you');
    if (userParts) userParts.text.textContent = q;
    renderEmptyState();
    saveHistory();
    scrollToEnd();

    const thinkingRow = showThinking();
    let result = null;
    try {
      result = await askIRA(q);
    } catch (err) {
      console.warn('Chat: brain call failed', err);
    }
    if (thinkingRow) thinkingRow.remove();

    const answer = (result && result.answer) || "I couldn't reach my brain just now. Please try again in a moment.";
    const engine = (result && result.engine) || null;
    messages.push({ role: 'ira', content: answer, engine });
    const iraParts = appendRow('ira');
    if (iraParts) {
      if (engine) addIraBadge(iraParts.roleLine, engine);
      typewriter(iraParts.text, answer);
    }
    renderEmptyState();
    saveHistory();
    setBusy(false);
    return result;
  }

  function newChat() {
    messages = [];
    saveHistory();
    const inner = $('#chatInner');
    if (inner) inner.replaceChildren();
    renderEmptyState();
    const input = $('#chatInput');
    if (input) input.focus();
    return null;
  }

  function bind() {
    const form = $('#chatComposer');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      const input = $('#chatInput');
      const autoresize = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      };
      input.addEventListener('input', autoresize);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        input.value = '';
        autoresize();
        askChat(q);
      });
    }
    $$('#chatSuggestions button').forEach((b) => {
      b.onclick = () => askChat(b.dataset.prompt || b.textContent);
    });
    const newBtn = $('#chatNewBtn');
    if (newBtn) newBtn.onclick = () => newChat();
    const clearBtn = $('#chatClearBtn');
    if (clearBtn) clearBtn.onclick = () => newChat();
  }

  function enter() {
    loadHistory();
    bind();
    rebuildStream();
    const input = $('#chatInput');
    if (input) setTimeout(() => input.focus(), 80);
  }

  function leave() {
    if (revealTimer) clearInterval(revealTimer);
    revealTimer = null;
  }

  window.iraChatEnter = enter;
  window.iraChatLeave = leave;
  window.askChat = askChat;
})();
