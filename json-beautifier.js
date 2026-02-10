const input = document.getElementById('jsonInput');
const outputEl = document.getElementById('jsonOutput');
const statusEl = document.getElementById('status');

const btnBeautify = document.getElementById('btnBeautify');
const btnCopy = document.getElementById('btnCopy');
const btnClear = document.getElementById('btnClear');

// Formatted plain-text kept for "Copy output".
let formattedText = '';

function setStatus(message, type = 'neutral') {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('is-error', type === 'error');
}

function setErrorState(isError) {
  input.classList.toggle('is-error', isError);
  statusEl.classList.toggle('is-error', isError);
}

function setCopyEnabled(enabled) {
  btnCopy.disabled = !enabled;
}

async function copyToClipboard(text) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: create a temporary textarea, select, and copy.
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    document.body.appendChild(tmp);
    tmp.select();
    const ok = document.execCommand('copy');
    tmp.remove();
    return ok;
  }
}

// ----- Collapsible JSON tree builder -----

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function jsonToTree(value, key, isLast) {
  const comma = isLast ? '' : ',';

  if (value === null) {
    return `<span class="jt-key">${key !== undefined ? `"${escapeHTML(String(key))}": ` : ''}</span><span class="jt-null">null</span>${comma}`;
  }

  const type = typeof value;

  if (type === 'boolean') {
    return `<span class="jt-key">${key !== undefined ? `"${escapeHTML(String(key))}": ` : ''}</span><span class="jt-bool">${value}</span>${comma}`;
  }

  if (type === 'number') {
    return `<span class="jt-key">${key !== undefined ? `"${escapeHTML(String(key))}": ` : ''}</span><span class="jt-num">${value}</span>${comma}`;
  }

  if (type === 'string') {
    return `<span class="jt-key">${key !== undefined ? `"${escapeHTML(String(key))}": ` : ''}</span><span class="jt-str">"${escapeHTML(value)}"</span>${comma}`;
  }

  // Array or Object
  const isArray = Array.isArray(value);
  const entries = isArray ? value : Object.entries(value);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  const count = isArray ? value.length : Object.keys(value).length;
  const label = key !== undefined ? `"${escapeHTML(String(key))}": ` : '';

  if (count === 0) {
    return `<span class="jt-key">${label}</span>${open}${close}${comma}`;
  }

  let children = '';
  if (isArray) {
    entries.forEach((item, i) => {
      children += `<div class="jt-line">${jsonToTree(item, undefined, i === count - 1)}</div>`;
    });
  } else {
    entries.forEach(([k, v], i) => {
      children += `<div class="jt-line">${jsonToTree(v, k, i === count - 1)}</div>`;
    });
  }

  return (
    `<details open>` +
    `<summary><span class="jt-key">${label}</span><span class="jt-bracket">${open}</span> <span class="jt-count">${count} item${count !== 1 ? 's' : ''}</span></summary>` +
    `<div class="jt-children">${children}</div>` +
    `<span class="jt-bracket">${close}</span>${comma}` +
    `</details>`
  );
}

// ----- Actions -----

btnBeautify.addEventListener('click', () => {
  const raw = input.value.trim();

  if (!raw) {
    outputEl.innerHTML = '';
    formattedText = '';
    setCopyEnabled(false);
    setErrorState(false);
    setStatus('Paste JSON into the input box.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    formattedText = JSON.stringify(parsed, null, 2);
    outputEl.innerHTML = `<div class="jt-line">${jsonToTree(parsed, undefined, true)}</div>`;
    setCopyEnabled(formattedText.length > 0);
    setErrorState(false);
    setStatus('Formatted. Click arrows to collapse/expand.');
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Parse error';
    setErrorState(true);
    setStatus(`Invalid JSON: ${msg}`, 'error');
  }
});

btnCopy.addEventListener('click', async () => {
  if (!formattedText) return;

  const ok = await copyToClipboard(formattedText);
  setStatus(ok ? 'Copied.' : 'Copy failed. Select the text and copy manually.', ok ? 'neutral' : 'error');
});

btnClear.addEventListener('click', () => {
  input.value = '';
  outputEl.innerHTML = '';
  formattedText = '';
  setCopyEnabled(false);
  setErrorState(false);
  setStatus('');
  input.focus();
});

setCopyEnabled(false);
setStatus('Paste JSON into the input box.');
