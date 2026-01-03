# MoonPlugs 🌙

A modern plugin installer for Vencord/Equicord DevBuild.

## ✨ Features

- 🔍 Auto-detects Discord and installed mods
- 🚀 Installs Vencord or Equicord DevBuild automatically
- � Browse aend install custom plugins with one click
- � IAutomatic rebuild after plugin changes
- 🎨 Modern, Discord-like UI

## 📥 Download

Download the latest version from [Releases](https://github.com/srmooon/MoonPlugs/releases).

## 📋 Requirements

- Windows 10/11
- Discord installed
- Git (for DevBuild installation)
- Node.js 18+ (for DevBuild installation)

## 🚀 How It Works

1. **Detection**: MoonPlugs checks if Discord is installed and what mod (if any) is present
2. **Setup**: If no DevBuild is found, it offers to install Vencord or Equicord DevBuild
3. **Plugins**: Once DevBuild is ready, you can browse and install plugins
4. **Rebuild**: After installing/uninstalling plugins, MoonPlugs automatically rebuilds the mod

## 📦 Available Plugins

| Plugin | Description |
|--------|-------------|
| [Voice Narrator Natural](https://github.com/srmooon/VoiceNarratorNatural) | TTS plugin that announces voice channel events using Windows Natural Voices |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run package:win
```

## 👤 Author

**SrMoon** - [GitHub](https://github.com/srmooon)

## 📄 License

GPL-3.0-or-later
