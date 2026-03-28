const { app, BrowserWindow, globalShortcut, Tray, Menu, MenuItem, ipcMain, screen, nativeImage, shell } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()

let mainWindow = null
let settingsWindow = null
let tray = null

// ── Main widget window ───────────────────────────────────────────────────────

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const winW = 620
  const winH = 240

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round((width - winW) / 2),
    y: Math.round(height / 3),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.webContents.on('context-menu', (e, params) => {
    const menu = new Menu()
    menu.append(new MenuItem({
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      click: () => mainWindow.webContents.paste()
    }))
    menu.append(new MenuItem({
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click: () => mainWindow.webContents.copy()
    }))
    menu.popup()
  })

  // Auto-hide when window loses focus
  mainWindow.on('blur', () => {
    mainWindow.hide()
  })
}

function showWindow() {
  if (!mainWindow) return
  // Re-centre on the current display each time
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const [winW, winH] = mainWindow.getSize()
  mainWindow.setPosition(
    Math.round((width - winW) / 2),
    Math.round(height / 3)
  )
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('reset')
}

function hideWindow() {
  if (!mainWindow) return
  mainWindow.hide()
}

function toggleWindow() {
  if (mainWindow && mainWindow.isVisible()) {
    hideWindow()
  } else {
    showWindow()
  }
}

// ── Settings window ──────────────────────────────────────────────────────────

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 380,
    title: 'Coelacanth Settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'))
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // On macOS, prevent Dock icon
  if (process.platform === 'darwin') app.dock.hide()

  createMainWindow()

  // Global shortcut
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+C', toggleWindow)
  if (!shortcutRegistered) {
    console.warn('Could not register global shortcut Cmd+Shift+C — already in use by another app')
  }

  // Tray icon
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Coelacanth')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Coelacanth', click: () => showWindow() },
    { label: 'Settings', click: () => openSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindow())
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Keep app alive when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault()
})

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-org-slug', () => store.get('orgSlug', ''))

ipcMain.handle('set-org-slug', (_, slug) => {
  store.set('orgSlug', slug)
  return true
})

ipcMain.on('hide-window', () => hideWindow())

ipcMain.on('open-settings', () => openSettings())

ipcMain.on('open-external', (_, url) => shell.openExternal(url))
