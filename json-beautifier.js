const input = document.getElementById('jsonInput');
const output = document.getElementById('jsonOutput');
const statusEl = document.getElementById('status');

const btnBeautify = document.getElementById('btnBeautify');
const btnCopy = document.getElementById('btnCopy');
const btnClear = document.getElementById('btnClear');

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
    // Fallback for older browsers / permissions.
    output.focus();
    output.select();
    const ok = document.execCommand('copy');
    window.getSelection?.().removeAllRanges?.();
    btnCopy.focus();
    return ok;
  }
}

btnBeautify.addEventListener('click', () => {
  const raw = input.value.trim();

  if (!raw) {
    output.value = '';
    setCopyEnabled(false);
    setErrorState(false);
    setStatus('Paste JSON into the input box.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    output.value = JSON.stringify(parsed, null, 2);
    setCopyEnabled(output.value.length > 0);
    setErrorState(false);
    setStatus('Formatted.');
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Parse error';
    setErrorState(true);
    setStatus(`Invalid JSON: ${msg}`, 'error');
  }
});

btnCopy.addEventListener('click', async () => {
  const text = output.value;
  if (!text) return;

  const ok = await copyToClipboard(text);
  setStatus(ok ? 'Copied.' : 'Copy failed. Select the text and copy manually.', ok ? 'neutral' : 'error');
});

btnClear.addEventListener('click', () => {
  input.value = '';
  output.value = '';
  setCopyEnabled(false);
  setErrorState(false);
  setStatus('');
  input.focus();
});

setCopyEnabled(false);
setStatus('Paste JSON into the input box.');
