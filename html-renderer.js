const input = document.getElementById('htmlInput');
const iframe = document.getElementById('htmlPreview');
const statusEl = document.getElementById('status');

const btnRender = document.getElementById('btnRender');
const btnClear = document.getElementById('btnClear');

function setStatus(message, type = 'neutral') {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('is-error', type === 'error');
}

// ----- Sanitization helpers -----

// Strict Content-Security-Policy injected into every srcdoc.
// Blocks ALL external network requests (images, fonts, scripts, styles, etc.).
// Only inline styles and data-URI / blob images are permitted.
const CSP_META =
  '<meta http-equiv="Content-Security-Policy" ' +
  'content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:;">';

// Strip dangerous markup that could still cause harm even inside a
// script-blocked sandbox (e.g. `<meta http-equiv="refresh">` redirects,
// `<form>` auto-submits if sandbox is ever loosened, event-handler attrs).
function sanitizeHTML(raw) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  // Remove all <script>, <iframe>, <object>, <embed>, <applet>, <form>, <base>
  // and <meta http-equiv="refresh"> elements.
  const dangerous = 'script, iframe, object, embed, applet, form, base, link[rel="import"]';
  doc.querySelectorAll(dangerous).forEach((el) => el.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => el.remove());

  // Strip all on* event-handler attributes from every element.
  const allEls = doc.querySelectorAll('*');
  for (const el of allEls) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
    // Strip javascript: hrefs/srcs.
    for (const name of ['href', 'src', 'action', 'formaction', 'xlink:href']) {
      const val = el.getAttribute(name);
      if (val && /^\s*javascript\s*:/i.test(val)) {
        el.removeAttribute(name);
      }
    }
  }

  return doc.documentElement.outerHTML;
}

// ----- Core render / clear -----

function render() {
  const raw = input.value;

  if (!raw.trim()) {
    iframe.srcdoc = '';
    setStatus('Paste HTML into the input box.');
    return;
  }

  // 1. Sanitize (remove scripts, event handlers, dangerous elements).
  // 2. Inject a strict CSP meta tag so the iframe can't load external resources.
  const clean = sanitizeHTML(raw);
  iframe.srcdoc = `<!doctype html><html><head>${CSP_META}</head><body>${clean}</body></html>`;
  setStatus('Rendered (sanitized).');
}

btnRender.addEventListener('click', render);

btnClear.addEventListener('click', () => {
  input.value = '';
  iframe.srcdoc = '';
  setStatus('');
  input.focus();
});

setStatus('Paste HTML into the input box.');
