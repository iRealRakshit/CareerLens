// Shared utilities across pages (isolated scope)
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const API = {
    ping: () => fetch('/api/ping').then(r => r.json()),
    adaptiveQuizStart: () => fetch('/api/adaptive_quiz/start', { method: 'POST' }).then(r => r.json()),
    adaptiveQuizNext: (conversationHistory) => fetch('/api/adaptive_quiz/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory })
    }).then(r => r.json()),
    quiz: (answers) => fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) }).then(r => r.json()),
    market: (role, region) => fetch('/api/market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, region }) }).then(r => r.json()),
    recommend: (role, background, weeks) => fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, background, weeks }) }).then(r => r.json()),
    compare: (role_a, role_b, region) => fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_a, role_b, region }) }).then(r => r.json()),
    analyzeResume: (resume_text, target_role, job_description) => fetch('/api/resume/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume_text, target_role, job_description }) }).then(r => r.json()),
    roadmap: (job, weeks) => fetch('/api/roadmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job, weeks }) }).then(r => r.json()),
  };

  // Dynamic loader text that cycles through phrases to keep UI lively
  const LOADER_PHRASES = [
    'Thinking…',
    'Analyzing…',
    'Connecting dots…',
    'Weighing options…',
    'Crunching numbers…',
    'Checking playbook…',
    'Sketching a plan…',
    'Almost there…'
  ];

  function startCycler(el, phrases = LOADER_PHRASES, interval = 350) {
    if (!el) return () => {};
    let i = 0;
    el.textContent = phrases[i];
    const id = setInterval(() => {
      i = (i + 1) % phrases.length;
      el.textContent = phrases[i];
    }, interval);
    return () => clearInterval(id);
  }

  function setStatus(msg, cls) {
    const el = $('#status');
    if (!el) return;
    // Dot indicator; tooltip shows details
    el.className = `status status-dot ${cls || ''}`.trim();
    el.textContent = '';
    el.setAttribute('title', String(msg || ''));
    el.setAttribute('aria-label', String(msg || ''));
  }

  async function initPing() {
    // Neutral dot while checking
    setStatus('Checking AI connectivity…', '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6-second timeout
    try {
      const res = await fetch('/api/ping', { signal: controller.signal }).then(r => r.json());
      const ok = !!(res && res.ok);
      if (ok) {
        setStatus(`AI connected`, 'ok');
      } else {
        setStatus(`AI unavailable: ${res.error || 'Unknown error'}`, 'err');
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setStatus('AI check timed out', 'err');
      } else {
        setStatus(`AI unavailable: ${e.message || 'Network error'}`, 'err');
      }
    } finally {
      clearTimeout(timeout);
      // Set active nav link regardless of ping result
      const path = location.pathname.replace(/\/$/, '') || '/';
      document.querySelectorAll('.navbar a').forEach(a => {
        const href = a.getAttribute('href');
        const hrefNorm = href.replace(/\/$/, '') || '/';
        if (hrefNorm === path) a.classList.add('active');
      });
    }
  }

  function parseQuery() {
    const params = new URLSearchParams(location.search);
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  }

  // Minimal charting
  function drawAxes(ctx, w, h, padding) {
    ctx.strokeStyle = '#263046';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(padding, padding);
    ctx.stroke();
  }

  function drawLineChart(canvas, labels, values, title) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, pad = 36;
    ctx.clearRect(0,0,w,h);
    drawAxes(ctx, w, h, pad);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.fillText(title || 'Trend', pad, pad - 10);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const yMin = Math.floor((min - 5) / 5) * 5;
    const yMax = Math.ceil((max + 5) / 5) * 5;
    const xStep = (w - pad*2) / (values.length - 1 || 1);
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const t = yMin + (i * (yMax - yMin) / 4);
      const y = h - pad - ((t - yMin) / (yMax - yMin || 1)) * (h - pad*2);
      ctx.fillText(String(Math.round(t)), pad - 6, y + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }
    ctx.textAlign = 'center';
    labels.forEach((lab, i) => {
      const x = pad + i * xStep;
      ctx.fillText(String(lab), x, h - pad + 14);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad + i * xStep;
      const y = h - pad - ((v - yMin) / (yMax - yMin || 1)) * (h - pad*2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function drawBarChart(canvas, labels, values, title) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, pad = 36;
    ctx.clearRect(0,0,w,h);
    drawAxes(ctx, w, h, pad);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.fillText(title || 'Bar Chart', pad, pad - 10);
    const max = Math.max(...values, 1);
    const barW = (w - pad*2) / (values.length || 1) * 0.7;
    const step = (w - pad*2) / (values.length || 1);
    ctx.textAlign = 'center';
    values.forEach((v, i) => {
      const x = pad + i * step + (step - barW)/2;
      const hVal = ((v / max) * (h - pad*2));
      const y = h - pad - hVal;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x, y, barW, hVal);
      ctx.fillStyle = '#6b7280';
      ctx.fillText(String(labels[i]), x + barW/2, h - pad + 14);
    });
  }

  function readFileAsText(file, ext) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      if ((ext || '').toLowerCase() === 'pdf') {
        reader.onload = async () => {
          try {
            const buf = new Uint8Array(reader.result);
            // Try robust extraction with PDF.js first (CDN). Fallback to lightweight parser.
            let text = '';
            try { text = await extractWithPdfJs(buf); } catch (e) { /* ignore */ }
            if (!text || text.length < 40) {
              try { text = await extractPdfTextAsync(buf); } catch (e) { /* ignore */ }
            }
            resolve(text || '');
          } catch (e) {
            console.warn('PDF extract error', e);
            resolve('');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsText(file);
      }
    });
  }

  // Load PDF.js from CDN and extract text (best effort)
  async function extractWithPdfJs(uint8) {
    const w = window;
    if (!w.pdfjsLib) {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
      if (!w.pdfjsLib) throw new Error('pdfjsLib not available');
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    const loadingTask = w.pdfjsLib.getDocument({ data: uint8 });
    const pdf = await loadingTask.promise;
    let out = '';
    const maxPages = Math.min(pdf.numPages || 1, 20);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str).filter(Boolean);
      out += strings.join(' ') + '\n';
    }
    return out.trim();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(el);
    });
  }

  // Best-effort PDF text extractor using Tj/TJ operators and FlateDecode streams.
  async function extractPdfTextAsync(uint8) {
    const latin1 = new TextDecoder('latin1');
    const src = latin1.decode(uint8);
    const pieces = [];
    const rePar = /\((?:\\.|[^\\()])*\)/g;

    function parseTjTJ(s) {
      // Tj strings: (....) Tj
      const reTj = /\((?:\\.|[^\\()])*\)\s*Tj/g;
      let m;
      while ((m = reTj.exec(s))) {
        const pm = m[0].match(rePar);
        if (pm && pm[0]) pieces.push(unescapePdfString(pm[0]));
      }
      // TJ arrays: [(..)..] TJ
      const reTJa = /\[(.*?)\]\s*TJ/gs;
      let ma;
      while ((ma = reTJa.exec(s))) {
        const arr = ma[1];
        const segs = arr.match(rePar) || [];
        const joined = segs.map(unescapePdfString).join('');
        if (joined) pieces.push(joined);
      }
    }

    // 1) Try top-level (uncompressed)
    parseTjTJ(src);

    // 2) Try FlateDecode streams (compressed)
    if (typeof DecompressionStream !== 'undefined') {
      let pos = 0;
      while (true) {
        const iStream = src.indexOf('stream\n', pos);
        if (iStream === -1) break;
        // Look back for Filter
        const headerStart = Math.max(0, iStream - 800);
        const header = src.slice(headerStart, iStream);
        const hasFlate = /\/Filter\s*\/FlateDecode/.test(header);
        const dataStart = iStream + 'stream\n'.length;
        const iEnd = src.indexOf('endstream', dataStart);
        if (iEnd === -1) break;
        if (hasFlate) {
          try {
            const bytes = uint8.subarray(dataStart, iEnd);
            const inflated = await inflateFlate(bytes);
            if (inflated && inflated.length) {
              const text = latin1.decode(inflated);
              parseTjTJ(text);
            }
          } catch (e) {
            // ignore individual stream errors
          }
        }
        pos = iEnd + 'endstream'.length;
      }
    }

    const text = pieces.join('\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  async function inflateFlate(bytes) {
    try {
      const ds = new DecompressionStream('deflate');
      const stream = new Response(new Blob([bytes]).stream().pipeThrough(ds));
      const ab = await stream.arrayBuffer();
      return new Uint8Array(ab);
    } catch (e) {
      return null;
    }
  }

  function unescapePdfString(parenWrapped) {
    // Remove outer parentheses and unescape common sequences
    let s = String(parenWrapped || '');
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
    return s
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  window.CareerLensShared = { $, $$, API, setStatus, initPing, parseQuery, drawLineChart, drawBarChart, readFileAsText, startCycler, LOADER_PHRASES };

  // Initial ping on page load
  initPing();
  // Periodic ping to update status
  setInterval(initPing, 30000); // Every 30 seconds

})();
