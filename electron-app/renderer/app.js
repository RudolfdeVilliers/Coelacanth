const API_BASE = 'https://coelacanth-zeta.vercel.app'

const pill        = document.getElementById('pill')
const ideaInput   = document.getElementById('idea-input')
const attachBtn   = document.getElementById('attach-btn')
const fileInput   = document.getElementById('file-input')
const resultArea  = document.getElementById('result-area')
const resultIcon  = document.getElementById('result-icon')
const resultText  = document.getElementById('result-text')

let orgSlug = ''
let selectedFile = null
let resultTimer = null

// ── Rotating placeholders ─────────────────────────────────────────────────────

const PLACEHOLDERS = [
  "Email Sarah about tomorrow's meeting...",
  'Send a Slack message to #general...',
  'Find the Q4 report PDF...',
  'Message the team on Slack...',
]
let placeholderIdx = 0

setInterval(() => {
  if (!ideaInput.value) {
    placeholderIdx = (placeholderIdx + 1) % PLACEHOLDERS.length
    ideaInput.placeholder = PLACEHOLDERS[placeholderIdx]
  }
}, 3000)

// ── Init ──────────────────────────────────────────────────────────────────────

window.electronAPI.getOrgSlug().then(slug => { orgSlug = slug })

window.electronAPI.onReset(() => {
  reset()
  setTimeout(() => ideaInput.focus(), 60)
})

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
    const command = ideaInput.value.trim()
    if (command) executeCommand(command)
  }
})

// ── File attach ───────────────────────────────────────────────────────────────

attachBtn.addEventListener('click', e => {
  e.stopPropagation()
  fileInput.click()
})

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null
})

// ── Execute command ───────────────────────────────────────────────────────────

async function executeCommand(command) {
  if (!orgSlug) {
    window.electronAPI.openSettings()
    return
  }

  setLoading(true)

  try {
    const res = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, orgSlug }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      showResult(false, data.message || data.error || 'Something went wrong.')
    } else {
      showResult(true, data.message || 'Done.')
    }
  } catch {
    showResult(false, 'Could not reach Coelacanth. Check your connection.')
  }

  setLoading(false)
  ideaInput.value = ''
}

// ── State helpers ─────────────────────────────────────────────────────────────

function setLoading(on) {
  if (on) {
    pill.classList.add('loading')
    ideaInput.disabled = true
  } else {
    pill.classList.remove('loading')
    ideaInput.disabled = false
    ideaInput.focus()
  }
}

function showResult(success, message) {
  clearTimeout(resultTimer)
  resultArea.classList.remove('hidden', 'fading', 'error-state')
  resultIcon.textContent = success ? '✓' : '✕'
  resultText.textContent = message
  if (!success) resultArea.classList.add('error-state')

  resultTimer = setTimeout(() => {
    resultArea.classList.add('fading')
    setTimeout(() => {
      resultArea.classList.add('hidden')
      resultArea.classList.remove('fading', 'error-state')
    }, 400)
  }, 4000)
}

function reset() {
  clearTimeout(resultTimer)
  ideaInput.value = ''
  ideaInput.disabled = false
  ideaInput.placeholder = PLACEHOLDERS[0]
  selectedFile = null
  fileInput.value = ''
  pill.classList.remove('loading')
  resultArea.classList.add('hidden')
  resultArea.classList.remove('fading', 'error-state')
}
