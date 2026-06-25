// Minimal Electron wrapper — spawns server.mjs as a child process
// and points a native window at http://localhost:3000.
const { app, BrowserWindow, shell, session, Menu, MenuItem } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let serverProc = null;
let mainWindow = null;

function startServer() {
  // In dev __dirname is the project root; in a packaged build it's
  // resources/app inside the install dir. Both contain server.mjs.
  const serverPath = path.join(__dirname, 'server.mjs');

  // In production, redirect server state (config.json, tasks.json,
  // ui-state.json) to the per-user app-data dir so reinstalls don't wipe the
  // user's configured paths and so writes go to a user-writable location.
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  if (app.isPackaged) {
    const dataDir = app.getPath('userData');
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    env.COWORK_DATA_DIR = dataDir;
  }

  serverProc = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  serverProc.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
  });
}

function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(500, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('server timeout'));
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function createWindow() {
  // Wipe Chromium's HTTP cache on every launch. Without this, an upgraded .exe
  // can still serve the previous build's HTML/JS from cache because BrowserWindow
  // is loading localhost — Chromium caches those responses aggressively and the
  // user sees the old UI even though server.mjs is bundling the new one.
  try { await session.defaultSession.clearCache(); } catch (e) { console.warn('[cache] clear failed:', e.message); }
  try { await session.defaultSession.clearStorageData({ storages: ['shadercache', 'serviceworkers'] }); } catch {}

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Promega Project Planner',
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      spellcheck: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Native context menu for misspelled words. Chromium underlines misspellings
  // already, but the suggestion menu is not shown by default in Electron — wire
  // it up here. We only intervene when the click is on a misspelled word so the
  // app's own custom right-click menus (wvTreeCtxMenu, etc.) keep working
  // everywhere else.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.misspelledWord) return;
    const menu = new Menu();
    const suggestions = params.dictionarySuggestions || [];
    if (suggestions.length === 0) {
      menu.append(new MenuItem({ label: 'No spelling suggestions', enabled: false }));
    } else {
      for (const suggestion of suggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        }));
      }
    }
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Add to Dictionary',
      click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    }));
    if (params.editFlags.canCut || params.editFlags.canCopy || params.editFlags.canPaste) {
      menu.append(new MenuItem({ type: 'separator' }));
      if (params.editFlags.canCut) menu.append(new MenuItem({ role: 'cut' }));
      if (params.editFlags.canCopy) menu.append(new MenuItem({ role: 'copy' }));
      if (params.editFlags.canPaste) menu.append(new MenuItem({ role: 'paste' }));
    }
    menu.popup({ window: mainWindow });
  });

  // F12 toggles DevTools so users can self-diagnose if something looks broken.
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.type === 'keyDown' && input.key === 'r' && (input.control || input.meta)) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  try {
    await waitForServer('http://localhost:3000');
    // Append a cache-busting query so even any residual proxy/intermediate cache
    // is ignored. Server ignores extra query params on `/`.
    mainWindow.loadURL('http://localhost:3000/?v=' + Date.now());
  } catch (e) {
    mainWindow.loadURL(
      'data:text/html,<h1 style="font-family:sans-serif;padding:32px">Server failed to start</h1><pre>' +
        String(e) +
        '</pre>'
    );
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProc) {
    try { serverProc.kill(); } catch (_) {}
    serverProc = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProc) {
    try { serverProc.kill(); } catch (_) {}
    serverProc = null;
  }
});
