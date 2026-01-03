import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execSync, spawn } from 'child_process';
import axios from 'axios';

const PLUGINS_JSON_URL = 'https://raw.githubusercontent.com/srmooon/MoonPlugs/main/plugins.json';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1a1b1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());

// Get Discord path
function getDiscordPath(): string | null {
  const paths = [
    path.join(process.env.LOCALAPPDATA || '', 'Discord'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordPTB'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordCanary'),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Check what's installed
function detectInstallation(): { discord: boolean; mod: string | null; isDevBuild: boolean } {
  const discordPath = getDiscordPath();
  if (!discordPath) return { discord: false, mod: null, isDevBuild: false };

  const appData = process.env.APPDATA || '';
  
  // Check for Vencord DevBuild
  const vencordDevPath = path.join(appData, 'Vencord');
  const vencordSrcPath = path.join(vencordDevPath, 'src');
  if (fs.existsSync(vencordSrcPath)) {
    return { discord: true, mod: 'Vencord', isDevBuild: true };
  }

  // Check for Equicord DevBuild
  const equicordDevPath = path.join(appData, 'Equicord');
  const equicordSrcPath = path.join(equicordDevPath, 'src');
  if (fs.existsSync(equicordSrcPath)) {
    return { discord: true, mod: 'Equicord', isDevBuild: true };
  }

  // Check for regular Vencord/Equicord (asar files)
  const resourcesPath = fs.readdirSync(discordPath)
    .filter(f => f.startsWith('app-'))
    .sort()
    .reverse()[0];
  
  if (resourcesPath) {
    const appAsarPath = path.join(discordPath, resourcesPath, 'resources', 'app.asar');
    if (fs.existsSync(appAsarPath)) {
      // Check if injected
      const appPath = path.join(discordPath, resourcesPath, 'resources', 'app');
      if (fs.existsSync(appPath)) {
        const indexPath = path.join(appPath, 'index.js');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath, 'utf8');
          if (content.includes('equicord')) return { discord: true, mod: 'Equicord', isDevBuild: false };
          if (content.includes('vencord')) return { discord: true, mod: 'Vencord', isDevBuild: false };
        }
      }
    }
  }

  return { discord: true, mod: null, isDevBuild: false };
}

// Get userplugins path
function getUserPluginsPath(mod: string): string | null {
  const appData = process.env.APPDATA || '';
  const basePath = path.join(appData, mod, 'src', 'userplugins');
  if (fs.existsSync(path.join(appData, mod, 'src'))) {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    return basePath;
  }
  return null;
}

// IPC Handlers
ipcMain.handle('detect-installation', () => detectInstallation());

ipcMain.handle('fetch-plugins', async () => {
  try {
    const response = await axios.get(PLUGINS_JSON_URL);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch plugins:', error);
    return null;
  }
});

ipcMain.handle('get-installed-plugins', (_, mod: string) => {
  const pluginsPath = getUserPluginsPath(mod);
  if (!pluginsPath) return [];
  
  try {
    return fs.readdirSync(pluginsPath).filter(f => {
      const stat = fs.statSync(path.join(pluginsPath, f));
      return stat.isDirectory();
    });
  } catch {
    return [];
  }
});

ipcMain.handle('install-plugin', async (_, { mod, plugin }) => {
  const pluginsPath = getUserPluginsPath(mod);
  if (!pluginsPath) return { success: false, error: 'DevBuild not found' };

  const pluginDir = path.join(pluginsPath, plugin.id);
  
  try {
    // Create plugin directory
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    // Download each file
    for (const file of plugin.files) {
      const fileUrl = `https://raw.githubusercontent.com/srmooon/${plugin.id}/main/${file}`;
      const response = await axios.get(fileUrl);
      fs.writeFileSync(path.join(pluginDir, file), response.data);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('uninstall-plugin', (_, { mod, pluginId }) => {
  const pluginsPath = getUserPluginsPath(mod);
  if (!pluginsPath) return { success: false, error: 'DevBuild not found' };

  const pluginDir = path.join(pluginsPath, pluginId);
  
  try {
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-devbuild', async (_, mod: string) => {
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    // Clone repository
    const repoUrl = mod === 'Vencord' 
      ? 'https://github.com/Vendicated/Vencord.git'
      : 'https://github.com/Equicord/Equicord.git';

    if (fs.existsSync(installPath)) {
      fs.rmSync(installPath, { recursive: true });
    }

    execSync(`git clone ${repoUrl} "${installPath}"`, { stdio: 'pipe' });
    
    // Install dependencies
    execSync('npm install', { cwd: installPath, stdio: 'pipe' });
    
    // Build
    execSync('npm run build', { cwd: installPath, stdio: 'pipe' });
    
    // Inject
    execSync('npm run inject', { cwd: installPath, stdio: 'pipe' });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rebuild-mod', async (_, mod: string) => {
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    execSync('npm run build', { cwd: installPath, stdio: 'pipe' });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', (_, url: string) => {
  shell.openExternal(url);
});
