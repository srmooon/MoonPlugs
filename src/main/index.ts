import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import axios from 'axios';

const PLUGINS_JSON_URL = 'https://raw.githubusercontent.com/srmooon/MoonPlugs/main/plugins.json';

let mainWindow: BrowserWindow | null = null;

// Send log to renderer
function sendLog(message: string) {
  console.log(message);
  mainWindow?.webContents.send('console-log', message);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1a1b1e',
    icon: path.join(__dirname, '..', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());

// ============ HELPERS ============

function checkGit(): boolean {
  try { execSync('git --version', { stdio: 'pipe' }); return true; } catch { return false; }
}

function checkNode(): boolean {
  try { execSync('node --version', { stdio: 'pipe' }); return true; } catch { return false; }
}

function checkNpm(): boolean {
  try { execSync('npm --version', { stdio: 'pipe' }); return true; } catch { return false; }
}

function getDiscordPath(): string | null {
  const paths = [
    path.join(process.env.LOCALAPPDATA || '', 'Discord'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordPTB'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordCanary'),
  ];
  for (const p of paths) { if (fs.existsSync(p)) return p; }
  return null;
}

function detectInstallation(): { discord: boolean; mod: string | null; isDevBuild: boolean } {
  const discordPath = getDiscordPath();
  if (!discordPath) return { discord: false, mod: null, isDevBuild: false };

  const appData = process.env.APPDATA || '';
  
  if (fs.existsSync(path.join(appData, 'Vencord', 'src'))) {
    return { discord: true, mod: 'Vencord', isDevBuild: true };
  }
  if (fs.existsSync(path.join(appData, 'Equicord', 'src'))) {
    return { discord: true, mod: 'Equicord', isDevBuild: true };
  }

  try {
    const resourcesPath = fs.readdirSync(discordPath).filter(f => f.startsWith('app-')).sort().reverse()[0];
    if (resourcesPath) {
      const indexPath = path.join(discordPath, resourcesPath, 'resources', 'app', 'index.js');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8').toLowerCase();
        if (content.includes('equicord')) return { discord: true, mod: 'Equicord', isDevBuild: false };
        if (content.includes('vencord')) return { discord: true, mod: 'Vencord', isDevBuild: false };
      }
    }
  } catch {}

  return { discord: true, mod: null, isDevBuild: false };
}

function killDiscord(): Promise<void> {
  return new Promise((resolve) => {
    try { execSync('taskkill /F /IM Discord.exe', { stdio: 'pipe' }); } catch {}
    try { execSync('taskkill /F /IM DiscordPTB.exe', { stdio: 'pipe' }); } catch {}
    try { execSync('taskkill /F /IM DiscordCanary.exe', { stdio: 'pipe' }); } catch {}
    setTimeout(resolve, 2000);
  });
}

function isDiscordRunning(): boolean {
  try {
    return execSync('tasklist /FI "IMAGENAME eq Discord.exe"', { encoding: 'utf8' }).includes('Discord.exe');
  } catch { return false; }
}

function getUserPluginsPath(mod: string): string | null {
  const appData = process.env.APPDATA || '';
  const basePath = path.join(appData, mod, 'src', 'userplugins');
  if (fs.existsSync(path.join(appData, mod, 'src'))) {
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
    return basePath;
  }
  return null;
}

// Inject mod into Discord using pnpm inject (opens separate terminal)
async function injectMod(_mod: string, installPath: string): Promise<void> {
  // Send message to renderer to show confirmation popup
  mainWindow?.webContents.send('show-inject-popup');
  
  // Wait for user confirmation
  await new Promise<void>((resolve) => {
    ipcMain.once('inject-confirmed', () => {
      const { exec } = require('child_process');
      exec(`start cmd /c "cd /d "${installPath}" && pnpm inject && echo. && echo Injection complete! Closing in 3 seconds... && timeout /t 3"`, { shell: 'cmd.exe' });
      setTimeout(resolve, 20000);
    });
  });
}

// Uninject mod from Discord using pnpm uninject + manual cleanup
async function uninjectMod(_mod: string, installPath: string): Promise<void> {
  // Open separate terminal for uninject if folder exists
  if (fs.existsSync(installPath)) {
    // Send message to renderer to show confirmation popup
    mainWindow?.webContents.send('show-uninject-popup');
    
    // Wait for user confirmation
    await new Promise<void>((resolve) => {
      ipcMain.once('uninject-confirmed', () => {
        const { exec } = require('child_process');
        exec(`start cmd /c "cd /d "${installPath}" && pnpm uninject && echo. && echo Uninjection complete! Closing in 3 seconds... && timeout /t 3"`, { shell: 'cmd.exe' });
        setTimeout(resolve, 15000);
      });
    });
  }
  
  // Always clean manually too (backup)
  cleanDiscordInjection();
}

// ============ IPC HANDLERS ============

ipcMain.handle('check-dependencies', () => ({ git: checkGit(), node: checkNode(), npm: checkNpm() }));
ipcMain.handle('detect-installation', () => detectInstallation());
ipcMain.handle('check-discord-running', () => isDiscordRunning());
ipcMain.handle('kill-discord', async () => { await killDiscord(); return { success: true }; });

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
    return fs.readdirSync(pluginsPath).filter(f => fs.statSync(path.join(pluginsPath, f)).isDirectory());
  } catch { return []; }
});

ipcMain.handle('install-plugin', async (_, { mod, plugin }) => {
  const pluginsPath = getUserPluginsPath(mod);
  if (!pluginsPath) return { success: false, error: 'DevBuild not found' };

  const pluginDir = path.join(pluginsPath, plugin.id);
  const tempDir = path.join(process.env.TEMP || '', 'MoonPlugs', plugin.id);
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    sendLog(`Installing plugin: ${plugin.name}...`);
    
    sendLog('Closing Discord...');
    await killDiscord();
    await new Promise(r => setTimeout(r, 2000));

    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true, force: true });

    sendLog(`Cloning ${plugin.repository}...`);
    execSync(`git clone "${plugin.repository}" "${tempDir}"`, { stdio: 'pipe' });
    fs.mkdirSync(pluginDir, { recursive: true });

    sendLog('Copying plugin files...');
    const excludeFiles = ['.git', 'README.md', 'README.pt-BR.md', 'LICENSE', '.gitignore', '.vscode'];
    for (const file of fs.readdirSync(tempDir)) {
      if (excludeFiles.includes(file)) continue;
      const srcPath = path.join(tempDir, file);
      const destPath = path.join(pluginDir, file);
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });

    sendLog('Rebuilding mod...');
    execSync('pnpm build', { cwd: installPath, stdio: 'pipe' });
    
    sendLog('Reinjecting...');
    sendLog('>>> A terminal window will open - select your Discord and press Enter <<<');
    await injectMod(mod, installPath);

    sendLog(`Plugin ${plugin.name} installed successfully!`);
    return { success: true };
  } catch (error: any) {
    sendLog(`Error: ${error.message}`);
    try { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return { success: false, error: error.message };
  }
});

ipcMain.handle('uninstall-plugin', async (_, { mod, pluginId }) => {
  const pluginsPath = getUserPluginsPath(mod);
  if (!pluginsPath) return { success: false, error: 'DevBuild not found' };

  const pluginDir = path.join(pluginsPath, pluginId);
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    // Close Discord first
    await killDiscord();
    await new Promise(r => setTimeout(r, 2000));

    if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true, force: true });

    // Rebuild and reinject
    execSync('pnpm build', { cwd: installPath, stdio: 'pipe' });
    await injectMod(mod, installPath);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-devbuild', async (_, mod: string) => {
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    sendLog(`Starting install of ${mod}...`);
    
    if (!checkGit()) return { success: false, error: 'Git is not installed. Download at: https://git-scm.com/download/win' };
    if (!checkNode() || !checkNpm()) return { success: false, error: 'Node.js is not installed. Download at: https://nodejs.org/' };

    sendLog('Closing Discord...');
    await killDiscord();
    await new Promise(r => setTimeout(r, 3000));

    const repoUrl = mod === 'Vencord' 
      ? 'https://github.com/Vendicated/Vencord.git'
      : 'https://github.com/Equicord/Equicord.git';

    if (fs.existsSync(path.join(installPath, '.git'))) {
      sendLog('Updating existing installation...');
      execSync('git reset --hard HEAD', { cwd: installPath, stdio: 'pipe' });
      execSync('git pull', { cwd: installPath, stdio: 'pipe' });
    } else {
      if (fs.existsSync(installPath)) {
        sendLog('Removing old folder...');
        try { execSync(`rmdir /s /q "${installPath}"`, { stdio: 'pipe', shell: 'cmd.exe' }); } 
        catch { fs.rmSync(installPath, { recursive: true, force: true }); }
        await new Promise(r => setTimeout(r, 1000));
      }
      sendLog(`Cloning ${repoUrl}...`);
      execSync(`git clone ${repoUrl} "${installPath}"`, { stdio: 'pipe' });
    }
    
    sendLog('Installing dependencies (pnpm install)...');
    try { execSync('pnpm --version', { stdio: 'pipe' }); } catch { execSync('npm install -g pnpm', { stdio: 'pipe' }); }
    execSync('pnpm install --frozen-lockfile', { cwd: installPath, stdio: 'pipe' });
    
    sendLog('Building (pnpm build)...');
    execSync('pnpm build', { cwd: installPath, stdio: 'pipe' });
    
    sendLog('Injecting into Discord...');
    sendLog('>>> A terminal window will open - select your Discord and press Enter <<<');
    await injectMod(mod, installPath);
    
    sendLog('Installation complete!');
    return { success: true };
  } catch (error: any) {
    sendLog(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Update mod (git pull + rebuild + reinject)
ipcMain.handle('update-mod', async (_, mod: string) => {
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    await killDiscord();
    await new Promise(r => setTimeout(r, 2000));

    execSync('git reset --hard HEAD', { cwd: installPath, stdio: 'pipe' });
    execSync('git pull', { cwd: installPath, stdio: 'pipe' });
    
    if (mod === 'Equicord') {
      execSync('pnpm install --frozen-lockfile', { cwd: installPath, stdio: 'pipe' });
      execSync('pnpm build', { cwd: installPath, stdio: 'pipe' });
    } else {
      execSync('pnpm install --frozen-lockfile', { cwd: installPath, stdio: 'pipe' });
      execSync('pnpm build', { cwd: installPath, stdio: 'pipe' });
    }
    
    await injectMod(mod, installPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Clean Discord injection manually (remove resources/app folder + restore app.asar)
function cleanDiscordInjection(): void {
  const discordPaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Discord'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordPTB'),
    path.join(process.env.LOCALAPPDATA || '', 'DiscordCanary'),
  ];
  
  for (const discordPath of discordPaths) {
    if (!fs.existsSync(discordPath)) continue;
    try {
      const appFolders = fs.readdirSync(discordPath).filter(f => f.startsWith('app-'));
      for (const appFolder of appFolders) {
        const resourcesPath = path.join(discordPath, appFolder, 'resources');
        
        // Remove injected app folder
        const injectedApp = path.join(resourcesPath, 'app');
        if (fs.existsSync(injectedApp)) {
          fs.rmSync(injectedApp, { recursive: true, force: true });
        }
        
        // Restore original app.asar if backup exists
        const appAsar = path.join(resourcesPath, 'app.asar');
        const backupAsar = path.join(resourcesPath, '_app.asar');
        const backupAsar2 = path.join(resourcesPath, '_app.asar.backup');
        
        if (fs.existsSync(backupAsar)) {
          if (fs.existsSync(appAsar)) fs.rmSync(appAsar, { force: true });
          fs.renameSync(backupAsar, appAsar);
        } else if (fs.existsSync(backupAsar2)) {
          if (fs.existsSync(appAsar)) fs.rmSync(appAsar, { force: true });
          fs.renameSync(backupAsar2, appAsar);
        }
      }
    } catch {}
  }
}

// Uninstall mod completely
ipcMain.handle('uninstall-mod', async (_, mod: string) => {
  const appData = process.env.APPDATA || '';
  const installPath = path.join(appData, mod);
  
  try {
    await killDiscord();
    await new Promise(r => setTimeout(r, 2000));

    // Try uninject first (may fail if folder is broken)
    await uninjectMod(mod, installPath);

    // Clean Discord injection manually - this is the important part!
    cleanDiscordInjection();

    // Delete mod folder
    if (fs.existsSync(installPath)) {
      try { execSync(`rmdir /s /q "${installPath}"`, { stdio: 'pipe', shell: 'cmd.exe' }); } 
      catch { fs.rmSync(installPath, { recursive: true, force: true }); }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', (_, url: string) => { shell.openExternal(url); });
