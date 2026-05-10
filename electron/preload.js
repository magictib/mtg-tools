'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Mises à jour
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_e, v) => cb(v)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress',   (_e, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, v) => cb(v)),
  installUpdate:      ()   => ipcRenderer.send('install-update'),
  checkUpdate:        ()   => ipcRenderer.send('check-update'),
});
