# Contributing to MoonPlugs

Want to add your userplugin to MoonPlugs? Follow this guide!

## How MoonPlugs Works

MoonPlugs fetches the plugin list from `plugins.json` in this repository. When a user clicks "Install", it:

1. Clones your repository into the userplugins folder
2. Runs `pnpm build` to rebuild the mod
3. Done! The plugin is ready to use

## Plugin Format

Each plugin in `plugins.json` follows this structure:

```json
{
  "id": "YourPluginFolder",
  "name": "Your Plugin Name",
  "description": "Short description of what your plugin does",
  "version": "1.0.0",
  "author": "YourName",
  "repository": "https://github.com/youruser/YourPlugin",
  "tags": ["tag1", "tag2"]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Must match your repository name (folder name after clone) |
| `name` | Yes | Display name shown in MoonPlugs |
| `description` | Yes | Brief description of your plugin |
| `version` | Yes | Current version (e.g., "1.0.0") |
| `author` | Yes | Your name or username |
| `repository` | Yes | Full GitHub URL to your plugin |
| `tags` | No | Array of tags for categorization |

### Important Notes

- The `id` field **must** match your GitHub repository name exactly
- Example: If your repo is `https://github.com/user/CoolPlugin`, then `id` must be `CoolPlugin`
- This is because MoonPlugs uses `git clone` which creates a folder with the repo name

## How to Submit

1. Fork this repository
2. Edit `plugins.json` and add your plugin to the `plugins` array
3. Open a Pull Request

### Example

If `plugins.json` currently looks like this:

```json
{
  "name": "MoonPlugs",
  "author": "SrMoon",
  "description": "Custom plugins collection by SrMoon",
  "plugins": [
    {
      "id": "VoiceNarratorNatural",
      "name": "Voice Narrator Natural",
      "description": "TTS plugin using Windows Natural Voices",
      "version": "1.0.0",
      "author": "SrMoon",
      "repository": "https://github.com/srmooon/VoiceNarratorNatural",
      "tags": ["voice", "tts", "accessibility"]
    }
  ]
}
```

Add your plugin like this:

```json
{
  "name": "MoonPlugs",
  "author": "SrMoon",
  "description": "Custom plugins collection by SrMoon",
  "plugins": [
    {
      "id": "VoiceNarratorNatural",
      "name": "Voice Narrator Natural",
      "description": "TTS plugin using Windows Natural Voices",
      "version": "1.0.0",
      "author": "SrMoon",
      "repository": "https://github.com/srmooon/VoiceNarratorNatural",
      "tags": ["voice", "tts", "accessibility"]
    },
    {
      "id": "YourPlugin",
      "name": "Your Plugin",
      "description": "What your plugin does",
      "version": "1.0.0",
      "author": "YourName",
      "repository": "https://github.com/youruser/YourPlugin",
      "tags": ["your", "tags"]
    }
  ]
}
```

## Requirements

Before submitting, make sure your plugin:

- ✅ Is a valid Vencord/Equicord userplugin
- ✅ Has a public GitHub repository
- ✅ Works with the latest DevBuild
- ✅ Has a README with setup instructions (if needed)
- ✅ Does NOT contain malicious code

## Rules

By submitting a plugin, you agree to:

- Keep your repository public and accessible
- Not include any malicious, harmful, or deceptive code
- Be responsible for your own plugin and provide support to users
- Accept that your plugin may be removed from MoonPlugs at any time if it violates these rules

**Malicious plugins will be removed immediately and the author may be reported.**

## Updating Your Plugin

Once your plugin is approved, you can update the version and description yourself using the **Author Panel**:

👉 **[MoonPlugs Author Panel](https://moonplugs-api.srmooon.workers.dev)**

1. Login with your GitHub account
2. You'll see your plugins listed
3. Update version/description and click "Update Plugin"

The panel automatically verifies you own the repository before allowing changes.

## Questions?

Open an issue if you have any questions or problems!
