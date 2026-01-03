import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  repository: string;
  files: string[];
  tags?: string[];
}

interface PluginsData {
  name: string;
  author: string;
  plugins: Plugin[];
}

interface Installation {
  discord: boolean;
  mod: string | null;
  isDevBuild: boolean;
}

type Page = 'plugins' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('plugins');
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [pluginsData, setPluginsData] = useState<PluginsData | null>(null);
  const [installedPlugins, setInstalledPlugins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [selectedMod, setSelectedMod] = useState<'Vencord' | 'Equicord'>('Vencord');
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    
    const inst = await ipcRenderer.invoke('detect-installation');
    setInstallation(inst);

    if (!inst.discord) {
      setLoading(false);
      return;
    }

    if (!inst.isDevBuild) {
      setSetupMode(true);
      setLoading(false);
      return;
    }

    const plugins = await ipcRenderer.invoke('fetch-plugins');
    setPluginsData(plugins);

    const installed = await ipcRenderer.invoke('get-installed-plugins', inst.mod);
    setInstalledPlugins(installed);

    setLoading(false);
  }

  async function installDevBuild() {
    setSetupLoading(true);
    const result = await ipcRenderer.invoke('install-devbuild', selectedMod);
    if (result.success) {
      setSetupMode(false);
      await init();
    } else {
      alert('Error: ' + result.error);
    }
    setSetupLoading(false);
  }

  async function installPlugin(plugin: Plugin) {
    if (!installation?.mod) return;
    
    setInstalling(plugin.id);
    const result = await ipcRenderer.invoke('install-plugin', {
      mod: installation.mod,
      plugin
    });

    if (result.success) {
      setInstalledPlugins([...installedPlugins, plugin.id]);
      // Rebuild to apply changes
      await ipcRenderer.invoke('rebuild-mod', installation.mod);
    } else {
      alert('Error: ' + result.error);
    }
    setInstalling(null);
  }

  async function uninstallPlugin(pluginId: string) {
    if (!installation?.mod) return;
    
    setInstalling(pluginId);
    const result = await ipcRenderer.invoke('uninstall-plugin', {
      mod: installation.mod,
      pluginId
    });

    if (result.success) {
      setInstalledPlugins(installedPlugins.filter(p => p !== pluginId));
      await ipcRenderer.invoke('rebuild-mod', installation.mod);
    } else {
      alert('Error: ' + result.error);
    }
    setInstalling(null);
  }

  function openExternal(url: string) {
    ipcRenderer.invoke('open-external', url);
  }

  if (loading) {
    return (
      <div className="app">
        <TitleBar />
        <div className="loading">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!installation?.discord) {
    return (
      <div className="app">
        <TitleBar />
        <div className="setup-container">
          <div className="setup-icon">❌</div>
          <h1 className="setup-title">Discord Not Found</h1>
          <p className="setup-subtitle">
            Please install Discord first, then run MoonPlugs again.
          </p>
        </div>
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="app">
        <TitleBar />
        <div className="setup-container">
          <div className="setup-icon">🚀</div>
          <h1 className="setup-title">Setup Required</h1>
          <p className="setup-subtitle">
            {installation.mod 
              ? `You have ${installation.mod} installed, but it's not the DevBuild version. DevBuild is required to use custom plugins.`
              : 'No mod detected. Choose which one you want to install:'}
          </p>
          
          <div className="mod-selector">
            <div 
              className={`mod-option ${selectedMod === 'Vencord' ? 'selected' : ''}`}
              onClick={() => setSelectedMod('Vencord')}
            >
              <h3>Vencord</h3>
              <p>Original mod</p>
            </div>
            <div 
              className={`mod-option ${selectedMod === 'Equicord' ? 'selected' : ''}`}
              onClick={() => setSelectedMod('Equicord')}
            >
              <h3>Equicord</h3>
              <p>Enhanced fork</p>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={installDevBuild}
            disabled={setupLoading}
          >
            {setupLoading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Installing...
              </>
            ) : (
              <>Install {selectedMod} DevBuild</>
            )}
          </button>

          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            This will clone and build {selectedMod} from source. Requires Git and Node.js.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar />
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              🌙 <span>Moon</span>Plugs
            </div>
            <div className="sidebar-status">
              <div className="status-item">
                <div className={`status-dot ${installation.isDevBuild ? 'success' : 'warning'}`} />
                <span>{installation.mod} {installation.isDevBuild ? 'DevBuild' : ''}</span>
              </div>
              <div className="status-item">
                <div className="status-dot success" />
                <span>{installedPlugins.length} plugins installed</span>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div 
              className={`nav-item ${page === 'plugins' ? 'active' : ''}`}
              onClick={() => setPage('plugins')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Plugins
            </div>
            <div 
              className={`nav-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => setPage('settings')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </div>
          </nav>
        </aside>

        <main className="content">
          {page === 'plugins' && (
            <>
              <h1 className="page-title">Plugins</h1>
              <p className="page-subtitle">Browse and install custom plugins</p>

              {pluginsData ? (
                <div className="plugins-grid">
                  {pluginsData.plugins.map(plugin => {
                    const isInstalled = installedPlugins.includes(plugin.id);
                    const isLoading = installing === plugin.id;

                    return (
                      <div key={plugin.id} className="plugin-card">
                        <div className="plugin-header">
                          <div className="plugin-info">
                            <h3>{plugin.name}</h3>
                            <span className="version">v{plugin.version} by {plugin.author}</span>
                          </div>
                          {isInstalled && (
                            <div className="installed-badge">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Installed
                            </div>
                          )}
                        </div>

                        <p className="plugin-description">{plugin.description}</p>

                        {plugin.tags && (
                          <div className="plugin-tags">
                            {plugin.tags.map(tag => (
                              <span key={tag} className="tag">{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="plugin-actions">
                          {isInstalled ? (
                            <button 
                              className="btn btn-danger"
                              onClick={() => uninstallPlugin(plugin.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? 'Removing...' : 'Uninstall'}
                            </button>
                          ) : (
                            <button 
                              className="btn btn-primary"
                              onClick={() => installPlugin(plugin)}
                              disabled={isLoading}
                            >
                              {isLoading ? 'Installing...' : 'Install'}
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary"
                            onClick={() => openExternal(plugin.repository)}
                          >
                            View Source
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Failed to load plugins. Check your internet connection.</p>
                  <button className="btn btn-secondary" onClick={init} style={{ marginTop: 16 }}>
                    Retry
                  </button>
                </div>
              )}
            </>
          )}

          {page === 'settings' && (
            <>
              <h1 className="page-title">Settings</h1>
              <p className="page-subtitle">Configure MoonPlugs</p>

              <div className="plugin-card">
                <h3 style={{ marginBottom: 12 }}>Current Installation</h3>
                <p className="plugin-description">
                  <strong>Mod:</strong> {installation.mod}<br />
                  <strong>Type:</strong> {installation.isDevBuild ? 'DevBuild' : 'Regular'}<br />
                  <strong>Plugins Installed:</strong> {installedPlugins.length}
                </p>
              </div>

              <div className="plugin-card" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 12 }}>About</h3>
                <p className="plugin-description">
                  MoonPlugs v1.0.0<br />
                  Created by SrMoon
                </p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => openExternal('https://github.com/srmooon/MoonPlugs')}
                  style={{ marginTop: 12 }}
                >
                  GitHub Repository
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TitleBar() {
  const { ipcRenderer } = window.require('electron');

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        🌙 <span>Moon</span>Plugs
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => ipcRenderer.send('window-minimize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect y="5" width="12" height="2" fill="currentColor"/>
          </svg>
        </button>
        <button className="titlebar-btn close" onClick={() => ipcRenderer.send('window-close')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
