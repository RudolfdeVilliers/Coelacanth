const API_BASE = 'https://coelacanth-zeta.vercel.app'

// DOM elements
const setupScreen = document.getElementById('setup-screen')
const mainScreen = document.getElementById('main-screen')
const slugInput = document.getElementById('slug-input')
const slugSaveBtn = document.getElementById('slug-save-btn')
const setupError = document.getElementById('setup-error')
const ideaInput = document.getElementById('idea-input')
const charCount = document.getElementById('char-count')
const categorySelect = document.getElementById('category-select')
const submitBtn = document.getElementById('submit-btn')
const formArea = document.getElementById('form-area')
const successArea = document.getElementById('success-area')
const formError = document.getElementById('form-error')
const attachBtn = document.getElementById('attach-btn')
const fileInput = document.getElementById('file-input')
const fileNameEl = document.getElementById('file-name')

let selectedFile = null

// On load: check for saved orgSlug
chrome.storage.local.get(['orgSlug'], result => {
  if (result.orgSlug) {
    showMain()
  } else {
    showSetup()
  }
})

// Setup flow
slugSaveBtn.addEventListener('click', () => {
  const slug = slugInput.value.trim()
  if (!slug) {
    showError(setupError, 'Please enter your organisation code')
    return
  }
  chrome.storage.local.set({ orgSlug: slug }, () => {
    showMain()
  })
})

slugInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') slugSaveBtn.click()
})

// Character counter
ideaInput.addEventListener('input', () => {
  const len = ideaInput.value.length
  charCount.textContent = `${len} / 1000`
  charCount.style.color = len > 900 ? '#dc2626' : '#9ca3af'
})

// File attachment
attachBtn.addEventListener('click', () => {
  fileInput.click()
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0]
  if (file) {
    selectedFile = file
    fileNameEl.textContent = `\uD83D\uDCCE ${file.name}`
    fileNameEl.classList.remove('hidden')
  }
})

// Keyboard shortcut: Ctrl+Enter or Cmd+Enter to submit
ideaInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    submitBtn.click()
  }
})

// Submit
submitBtn.addEventListener('click', async () => {
  const idea = ideaInput.value.trim()

  if (!idea) {
    showError(formError, 'Please enter an idea before submitting')
    ideaInput.classList.add('error')
    return
  }
  if (idea.length < 5) {
    showError(formError, 'Your idea is too short (minimum 5 characters)')
    ideaInput.classList.add('error')
    return
  }

  hideError(formError)
  ideaInput.classList.remove('error')
  submitBtn.disabled = true
  submitBtn.textContent = 'Submitting\u2026'

  chrome.storage.local.get(['orgSlug'], async result => {
    const orgSlug = result.orgSlug
    if (!orgSlug) {
      showSetup()
      return
    }

    try {
      let filePayload = null
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile)
        filePayload = {
          name: selectedFile.name,
          type: selectedFile.type,
          data: base64,
        }
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

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      // Show success state
      formArea.classList.add('hidden')
      successArea.classList.remove('hidden')

      // Auto-close after 3 seconds
      setTimeout(() => window.close(), 3000)
    } catch (err) {
      showError(formError, err.message)
      submitBtn.disabled = false
      submitBtn.textContent = 'Submit'
    }
  })
})

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Strip the data URL prefix (e.g. "data:image/png;base64,")
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function showMain() {
  setupScreen.classList.add('hidden')
  mainScreen.classList.remove('hidden')
  setTimeout(() => ideaInput.focus(), 50)
}

function showSetup() {
  mainScreen.classList.add('hidden')
  setupScreen.classList.remove('hidden')
  setTimeout(() => slugInput.focus(), 50)
}

function showError(el, msg) {
  el.textContent = msg
  el.classList.remove('hidden')
}

function hideError(el) {
  el.textContent = ''
  el.classList.add('hidden')
}
