/* IRA Dispatch — UI 8. A broadsheet intelligence paper generated from today's
   wire. Every line of copy is traceable to a feed item or labelled as such. */
(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  let loaded = false;
  let headlines = [];
  let memory = null;

  const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortTime = (raw) => {
    const t = Date.parse(raw || '');
    if (Number.isNaN(t)) return '';
    const d = new Date(t);
    return d.toUTCString().slice(17, 22) + ' UTC';
  };
  const edition = () => {
    const n = memory && Number.isFinite(memory.sessionCount) ? memory.sessionCount : null;
    return n ? `EDITION № ${n}` : 'EDITION —';
  };

  async function loadAll() {
    const [newsRes, memRes] = await Promise.allSettled([
      fetch('/api/intel/news', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/hermes/status', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    if (memRes.status === 'fulfilled' && memRes.value) memory = memRes.value;
    if (newsRes.status === 'fulfilled' && newsRes.value && newsRes.value.ok && Array.isArray(newsRes.value.headlines)) {
      headlines = newsRes.value.headlines;
    } else {
      headlines = [];
    }
    render();
  }

  function autoDigest() {
    if (!headlines.length) {
      return 'The wire is unreachable from this machine, so this edition carries no reporting. When the network allows, reload and IRA will compose the day\u2019s dispatch from public RSS feeds. Ask the Desk below still works.';
    }
    const lead = headlines[0];
    const seconds = headlines.slice(1, 4).map((h) => h.title);
    const topicCount = new Set(headlines.map((h) => h.topic)).size;
    let text = `The wire leads with <b>“${escape(lead.title)}”</b> (${escape(lead.source || 'unknown source')}). `;
    if (seconds.length) text += `Also moving: ${seconds.map((t) => `“${escape(t)}”`).join('; ')}. `;
    text += `<b>${headlines.length} stories</b> across <b>${topicCount} desks</b> were monitored this cycle.`;
    text += `<small>Auto-digest · composed locally from RSS headlines · not editorial judgement</small>`;
    return text;
  }

  function render() {
    const offlineBanner = $('#dispatchOffline');
    if (offlineBanner) offlineBanner.classList.toggle('show', headlines.length === 0);

    const dateLine = $('#dispatchDate');
    if (dateLine) {
      dateLine.textContent = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    }
    const buildLine = $('#dispatchBuild');
    if (buildLine) buildLine.textContent = 'Composed ' + new Date().toUTCString().slice(17, 25) + ' UTC · ' + edition();

    // TOP STORY
    const lead = headlines[0];
    const kicker = $('#dispatchKicker');
    const headline = $('#dispatchHeadline');
    const topMeta = $('#dispatchTopMeta');
    const digest = $('#dispatchDigest');
    const photo = $('#dispatchLeadPhoto');
    const photoImg = $('#dispatchLeadPhotoImg');
    const photoCap = $('#dispatchLeadPhotoCap');
    if (lead) {
      if (kicker) kicker.textContent = 'Top Story · ' + String(lead.topic || 'world').toUpperCase();
      if (headline) {
        const a = document.createElement('a');
        a.href = lead.url || '#'; a.target = '_blank'; a.rel = 'noreferrer';
        a.textContent = lead.title;
        headline.replaceChildren(a);
      }
      if (topMeta) {
        const bits = [String(lead.source || 'NEWS').toUpperCase()];
        const t = shortTime(lead.published); if (t) bits.push(t);
        if (lead.geo) bits.push(`${lead.geo.name} · approx`.toUpperCase());
        topMeta.textContent = bits.join('  ·  ');
      }
      if (photo && photoImg && photoCap) {
        if (lead.image) {
          photoImg.src = lead.image;
          photoCap.textContent = `Photo via feed embed · ${lead.source || ''}`;
          photo.style.display = 'block';
        } else {
          photo.style.display = 'none';
        }
      }
    } else {
      if (kicker) kicker.textContent = 'Front Page';
      if (headline) headline.textContent = 'The wire is silent.';
      if (topMeta) topMeta.textContent = 'REACHING FOR THE WIRE · RETRY WITH RELOAD';
      if (photo) photo.style.display = 'none';
    }
    if (digest) digest.innerHTML = autoDigest();

    // THE BRIEFS — next 8 stories as cards
    const briefs = $('#dispatchBriefs');
    if (briefs) {
      briefs.replaceChildren();
      const picks = headlines.slice(1, 9);
      if (!picks.length) {
        const placeholder = document.createElement('div');
        placeholder.className = 'dispatch-brief';
        placeholder.innerHTML = '<div class="tag">Wire</div><h4>No briefs filed this cycle.</h4><div class="src">IRA DISPATCH</div>';
        briefs.appendChild(placeholder);
      }
      picks.forEach((h) => {
        const a = document.createElement('a');
        a.className = 'dispatch-brief' + (h.image ? ' with-photo' : '');
        a.href = h.url || '#'; a.target = '_blank'; a.rel = 'noreferrer';
        const img = h.image
          ? `<div class="brief-img"><img src="${escape(h.image)}" alt="" loading="lazy" onerror="this.closest('.brief-img').remove()"></div>`
          : '';
        a.innerHTML = `${img}<div class="tag">${escape(String(h.topic || 'news'))}</div><h4>${escape(h.title)}</h4><div class="src">${escape(String(h.source || 'NEWS').toUpperCase())}${h.geo ? ' · ' + escape(String(h.geo.name || '').toUpperCase()) : ''}</div>`;
        briefs.appendChild(a);
      });
    }

    // THE WIRE — next 10 as compact rows
    const wire = $('#dispatchWire');
    if (wire) {
      wire.replaceChildren();
      headlines.slice(9, 19).forEach((h) => {
        const a = document.createElement('a');
        a.className = 'wire-row';
        a.href = h.url || '#'; a.target = '_blank'; a.rel = 'noreferrer';
        a.innerHTML = `<div class="wire-time">${escape(shortTime(h.published) || '—')}</div><div class="wire-title">${escape(h.title)}</div>`;
        wire.appendChild(a);
      });
      if (!wire.childElementCount) wire.innerHTML = '<div class="wire-row"><div class="wire-time">—</div><div class="wire-title">Nothing further on the wire.</div></div>';
    }

    // Desk notes: IRA's own memory, printed like a colophon stat
    const memLine = $('#dispatchMemory');
    if (memLine && memory) {
      const topics = (memory.topTopics || []).slice(0, 3).map((t) => `${t.topic} ×${t.count}`).join(', ');
      memLine.textContent = `IRA has learned ${memory.totalInteractions || 0} interactions across ${Object.values(memory.topics || {}).filter((n) => n > 0).length || 0} desks this run. Focus: ${topics || 'general'}.`;
    }
  }

  async function askDesk(question) {
    const q = String(question || '').trim();
    if (!q) return;
    const host = $('#deskNotes');
    if (!host) return;
    const note = document.createElement('div');
    note.className = 'desk-note';
    note.innerHTML = `<div class="q">Desk Query · ${escape(new Date().toUTCString().slice(17, 22))} UTC</div><p>Composing…</p>`;
    host.prepend(note);
    try {
      const result = await askIRA(q);
      const p = note.querySelector('p');
      if (p) p.textContent = (result && result.answer) || 'The desk could not answer.';
    } catch {
      const p = note.querySelector('p');
      if (p) p.textContent = 'The wire is down and the desk could not be reached.';
    }
  }

  function bind() {
    const form = $('#deskAskForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const input = $('#deskAskInput');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      askDesk(q);
    });
  }

  function enter() {
    bind();
    loaded = true;
    loadAll();
  }

  function leave() {
    loaded = false;
  }

  window.iraDispatchEnter = enter;
  window.iraDispatchLeave = leave;
})();
