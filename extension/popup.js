const API_BASE = 'https://YOUR_APP.vercel.app' // replace at deploy time

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
const similarCount = document.getElementById('similar-count')

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
  if (len > 900) {
    charCount.style.color = '#dc2626'
  } else {
    charCount.style.color = '#9ca3af'
  }
})

// Submit
submitBtn.addEventListener('click', async () => {
  const idea = ideaInput.value.trim()

  if (!idea) {
    showError(formError, 'Please enter an idea before submitting')
    return
  }
  if (idea.length < 5) {
    showError(formError, 'Your idea is too short (minimum 5 characters)')
    return
  }

  hideError(formError)
  submitBtn.disabled = true
  submitBtn.textContent = 'Submitting…'

  chrome.storage.local.get(['orgSlug'], async result => {
    const orgSlug = result.orgSlug
    if (!orgSlug) {
      showSetup()
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ANONYMITY: do not add user tracking here
        body: JSON.stringify({
          idea,
          category: categorySelect.value || undefined,
          orgSlug,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      // Show success state
      formArea.classList.add('hidden')
      successArea.classList.remove('hidden')

      if (data.similar_count && data.similar_count > 1) {
        similarCount.textContent = `${data.similar_count} ideas shared this week`
        similarCount.classList.remove('hidden')
      }

      // Auto-close after 3 seconds
      setTimeout(() => window.close(), 3000)
    } catch (err) {
      showError(formError, err.message)
      submitBtn.disabled = false
      submitBtn.textContent = 'Submit anonymously'
    }
  })
})

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
