const API_BASE = 'https://coelacanth-zeta.vercel.app'

const pill         = document.getElementById('pill')
const ideaInput    = document.getElementById('idea-input')
const pillRow2     = document.getElementById('pill-row2')
const categorySelect = document.getElementById('category-select')
const submitBtn    = document.getElementById('submit-btn')
const attachBtn    = document.getElementById('attach-btn')
const fileInput    = document.getElementById('file-input')

let orgSlug = ''
let selectedFile = null
let isExpanded = false
let anonymous = true

// ── Load org slug ─────────────────────────────────────────────────────────────

window.electronAPI.getOrgSlug().then(slug => {
  orgSlug = slug
})

// ── Reset on show ─────────────────────────────────────────────────────────────

window.electronAPI.onReset(() => {
  reset()
  setTimeout(() => ideaInput.focus(), 60)
})

// Focus input when clicking anywhere on the pill
pill.addEventListener('click', () => ideaInput.focus())

// ── Keyboard ──────────────────────────────────────────────────────────────────

ideaInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    reset()
    window.electronAPI.hideWindow()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (!ideaInput.value.trim()) return
    if (!isExpanded) {
      expand()
    } else {
      doSubmit()
    }
  }
})

// Cmd+Enter / Ctrl+Enter also submits from anywhere
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    if (isExpanded) doSubmit()
  }
})

// ── File attach ───────────────────────────────────────────────────────────────

attachBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  fileInput.click()
})

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null
})

// ── Submit button ─────────────────────────────────────────────────────────────

submitBtn.addEventListener('click', () => doSubmit())

// ── Expand to show category + toggle ─────────────────────────────────────────

function expand() {
  isExpanded = true
  pill.classList.add('hovered')
  pillRow2.classList.add('visible')
  categorySelect.focus()
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function doSubmit() {
  const idea = ideaInput.value.trim()

  if (!idea || idea.length < 5) {
    ideaInput.classList.add('error')
    ideaInput.focus()
    return
  }

  if (!orgSlug) {
    window.electronAPI.openSettings()
    return
  }

  submitBtn.textContent = '…'
  submitBtn.disabled = true

  try {
    let filePayload = null
    if (selectedFile) {
      const base64 = await fileToBase64(selectedFile)
      filePayload = { name: selectedFile.name, type: selectedFile.type, data: base64 }
    }

    const res = await fetch(`${API_BASE}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ANONYMITY: do not add user tracking here
      body: JSON.stringify({
        idea,
        category: categorySelect.value || undefined,
        orgSlug,
        anonymous: true,
        ...(filePayload ? { file: filePayload } : {}),
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Submission failed')
    }

    // Success: flash cyan then hide
    pillRow2.classList.remove('visible')
    pill.classList.remove('hovered')
    pill.classList.add('success')

    setTimeout(() => {
      reset()
      window.electronAPI.hideWindow()
    }, 750)

  } catch (err) {
    submitBtn.textContent = 'Submit'
    submitBtn.disabled = false
    ideaInput.placeholder = err.message || 'Error — try again'
    setTimeout(() => {
      ideaInput.placeholder = 'Share an idea or suggestion...'
    }, 2500)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reset() {
  ideaInput.value = ''
  ideaInput.placeholder = 'Share an idea or suggestion...'
  ideaInput.classList.remove('error')
  categorySelect.value = ''
  selectedFile = null
  fileInput.value = ''
  isExpanded = false
  pill.classList.remove('hovered', 'success')
  pillRow2.classList.remove('visible')
  submitBtn.textContent = 'Submit'
  submitBtn.disabled = false
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
