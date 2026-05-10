'use strict';
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

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

  // Ouvrir les liens externes dans le navigateur par défaut
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

app.whenReady().then(() => {
  createWindow();
  if (!isDev()) {
    // Vérifier les mises à jour 3s après le démarrage
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Auto-updater ──────────────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  log.info('Mise à jour disponible :', info.version);
  if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(progress.percent));
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Mise à jour téléchargée :', info.version);
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info.version);
});

autoUpdater.on('error', (err) => {
  log.error('Erreur auto-updater :', err);
});

// Installer la mise à jour sur demande de la page
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// Vérification manuelle depuis la page
ipcMain.on('check-update', () => {
  if (!isDev()) autoUpdater.checkForUpdates();
});
