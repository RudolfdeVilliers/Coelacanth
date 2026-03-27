const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getOrgSlug: () => ipcRenderer.invoke('get-org-slug'),
  setOrgSlug: (slug) => ipcRenderer.invoke('set-org-slug', slug),
  hideWindow: () => ipcRenderer.send('hide-window'),
  openSettings: () => ipcRenderer.send('open-settings'),
  onReset: (callback) => ipcRenderer.on('reset', callback),
  openExternal: (url) => ipcRenderer.send('open-external', url),
})
