// Minimal MV3 service worker — required by Chrome Extension Manifest V3
// No background logic needed for MVP
chrome.runtime.onInstalled.addListener(() => {
  console.log('Coelacanth extension installed')
})
