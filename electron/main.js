'use strict';
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const https = require('https');

let mainWindow;

function isDev() {
  return !app.isPackaged;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'),
    title: 'ManaLAB',
    backgroundColor: '#0c0a07',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function initUpdater() {
  // Lazy require : electron-updater a besoin que app soit prêt
  const { autoUpdater } = require('electron-updater');
  const log = require('electron-log');

  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
  });
  autoUpdater.on('download-progress', (p) => {
    if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(p.percent));
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info.version);
  });
  autoUpdater.on('error', (err) => log.error('updater:', err));

  ipcMain.on('install-update', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.on('check-update',   () => autoUpdater.checkForUpdates());

  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

// HTTP proxy handler for renderer (bypasses browser CORS)
ipcMain.handle('http-fetch', async (_event, { method, url, headers, body }) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port || 443,
      path: u.pathname + u.search,
      method: method || 'GET',
      headers: headers || {},
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', e => reject({ message: e.message }));
    if (body) req.write(body);
    req.end();
  });
});

app.whenReady().then(() => {
  createWindow();
  if (!isDev()) initUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
