import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Return a dev server URL if we're in dev.
 * The Forge Vite plugin typically sets ELECTRON_RENDERER_URL(_MAIN_WINDOW),
 * but we also hard-fallback to http://127.0.0.1:5173 so dev always works.
 */
function getRendererDevUrl(): string | undefined {
  const candidates = [
    process.env.ELECTRON_RENDERER_URL,
    process.env.ELECTRON_RENDERER_URL_MAIN_WINDOW,
    process.env.ELECTRON_RENDERER_URL_main_window, // just in case
    process.env.VITE_DEV_SERVER_URL,
    'http://127.0.0.1:5173', // hard fallback
  ].filter(Boolean) as string[];
  return candidates[0];
}

/**
 * Resolve the renderer HTML path for PRODUCTION builds.
 * Use app.getAppPath() (resources/app) as the base; this is where the
 * @electron-forge/plugin-vite writes its output during packaging:
 *   .vite/build/main/index.cjs
 *   .vite/build/preload/index.cjs
 *   .vite/renderer/<name>/index.html
 */
function getRendererHtmlPath(): string {
  // Use the correct base for packaged app files
  const base = app.isPackaged ? app.getAppPath() : process.cwd();

  const candidates = [
    // Most common Forge+Vite output for a named renderer "main_window"
    path.join(base, '.vite', 'renderer', 'main_window', 'index.html'),
    // Some setups emit without the name folder
    path.join(base, '.vite', 'renderer', 'index.html'),
    // Fallbacks if files were copied next to built code
    path.join(__dirname, '../renderer/main_window/index.html'),
    path.join(__dirname, '../renderer/index.html'),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore and try next
    }
  }
  // Return the most likely expected path (used in error message)
  return candidates[0];
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 840,
    minHeight: 600,
    backgroundColor: '#F8FAFC',
    show: false,
    webPreferences: {
      // IMPORTANT: we emit preload as .cjs (set in vite.preload.config.ts)
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const devUrl = getRendererDevUrl();

  // In dev, pop DevTools automatically so blank screens show errors.
  if (!app.isPackaged && devUrl?.startsWith('http')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => win.show());

  try {
    if (!app.isPackaged && devUrl?.startsWith('http')) {
      await win.loadURL(devUrl);
    } else {
      const htmlPath = getRendererHtmlPath();
      if (!fs.existsSync(htmlPath)) {
        const msg = `Renderer HTML not found:\n${htmlPath}\n\n` +
          `Searched relative to app path: ${app.getAppPath()}`;
        console.error(msg);
        await dialog.showErrorBox('Renderer Not Found', msg);
        // Do NOT quit; leave the window up for troubleshooting.
        return;
      }
      await win.loadFile(htmlPath);
    }
  } catch (err: any) {
    console.error('Failed to load renderer:', err);
    await dialog.showErrorBox('Load Failed', String(err?.stack || err));
    // Do NOT quit immediately; keep the window so logs are visible.
  }
}

app.whenReady().then(() => {
  // Optional extra logging: set in shell before launching
  // set ELECTRON_ENABLE_LOGGING=1
  // set ELECTRON_ENABLE_STACK_DUMPING=1
  createWindow().catch(async (e) => {
    console.error(e);
    await dialog.showErrorBox('Startup Error', String(e?.stack || e));
    // Don't quit abruptly; let user see the error.
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(async (e) => {
        console.error(e);
        await dialog.showErrorBox('Startup Error', String(e?.stack || e));
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
