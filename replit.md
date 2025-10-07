# MusicMaker Discord Bot - Replit Setup

## Overview
MusicMaker is an advanced Discord music bot with support for YouTube, Spotify, SoundCloud, and direct audio links. It features dynamic embeds, smart queuing, autoplay, lyrics, and multi-language support (21 languages).

## Project Status
✅ **Imported and configured** - Dependencies installed, workflow created
⚠️ **Requires Discord Bot Configuration** - See setup steps below

## Recent Changes
- **October 7, 2025**: Initial import to Replit
  - Installed Node.js 22 and Python 3.11
  - Installed all npm dependencies
  - Created .gitignore for Node.js project
  - Configured Discord Bot workflow (console output)
  - Added required secrets: DISCORD_TOKEN, CLIENT_ID, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET

## Project Architecture

### Core Components
- **index.js**: Main bot entry point, handles Discord client initialization and event management
- **config.js**: Configuration management with environment variable fallbacks
- **commands/**: Slash command handlers (/play, /search, /help, /language, /nowplaying)
- **src/**: Core services
  - `MusicPlayer.js`: Audio playback engine with queue management
  - `MusicEmbedManager.js`: Dynamic embed updates for now playing interface
  - `Spotify.js`, `YouTube.js`, `SoundCloud.js`, `DirectLink.js`: Platform integrations
  - `LyricsManager.js`: Genius/LRCLIB lyrics fetching
  - `PlayerStateManager.js`: Persistent state for session restoration
- **events/**: Button and modal interaction handlers
- **languages/**: 21 JSON language packs for localization
- **database/**: Local JSON storage for guild preferences and player state

### Technology Stack
- **Discord.js v14.22**: Discord API integration
- **@discordjs/voice**: Voice channel audio streaming
- **ytdl-core & youtube-dl-exec**: YouTube audio extraction
- **spotify-web-api-node**: Spotify integration
- **genius-lyrics**: Lyrics fetching
- **ffmpeg-static**: Audio processing (bundled, no system install needed)

### Key Features
- 🎛️ Dynamic "Now Playing" embeds with auto-refresh
- 🪄 Smart queue with preloading and shuffle
- 🔁 Three loop modes: Off, Track Repeat, Queue Repeat
- 🎲 Genre-based autoplay with content filtering
- 💾 Local audio caching for buffer-free playback
- 🌐 21 language support with runtime switching
- 📜 Lyrics from Genius/LRCLIB with pagination
- 🛡️ Resilient playback with auto-reconnect

## Required Setup Steps

### 1. Enable Discord Bot Intents
The bot requires specific intents to function. Go to the Discord Developer Portal and enable:

1. Visit https://discord.com/developers/applications
2. Select your bot application
3. Go to the **Bot** section
4. Scroll down to **Privileged Gateway Intents**
5. Enable these intents:
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**
6. Click **Save Changes**

### 2. Invite Bot to Your Server
Use this URL format (replace CLIENT_ID with your actual client ID):
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=277028620608&scope=applications.commands%20bot
```

Required permissions:
- View Channels
- Send Messages
- Embed Links
- Connect to Voice
- Speak
- Use Slash Commands

### 3. Optional: YouTube Cookie Setup
If you encounter YouTube "bot detection" errors, add cookies:

**Method 1 (Recommended)**: Browser cookies
- Set `COOKIES_FROM_BROWSER` secret to: `chrome`, `firefox`, `edge`, or `safari`
- Make sure you're logged into YouTube in that browser

**Method 2**: cookies.txt file
- Export cookies using a browser extension
- Upload to project root as `cookies.txt`
- Set `COOKIES_FILE` secret to: `./cookies.txt`

### 4. Optional: Genius Lyrics API
The bot works without Genius API (uses web scraping), but you can add credentials for higher rate limits:
- Get credentials from https://genius.com/api-clients
- Add `GENIUS_CLIENT_ID` and `GENIUS_CLIENT_SECRET` secrets

## Running the Bot

The bot runs automatically via the "Discord Bot" workflow. To restart:
1. Stop the current workflow
2. Click "Run" or the workflow will auto-restart

## Secrets Configuration

Required secrets (already configured):
- `DISCORD_TOKEN`: Discord bot token
- `CLIENT_ID`: Discord application ID
- `SPOTIFY_CLIENT_ID`: Spotify API client ID
- `SPOTIFY_CLIENT_SECRET`: Spotify API client secret

Optional secrets:
- `GENIUS_CLIENT_ID`: Genius API client ID (optional)
- `GENIUS_CLIENT_SECRET`: Genius API client secret (optional)
- `COOKIES_FROM_BROWSER`: Browser for YouTube cookies (chrome/firefox/edge/safari)
- `COOKIES_FILE`: Path to cookies.txt file
- `GUILD_ID`: Guild ID for faster command deployment during testing

## Slash Commands

- `/play <query>` - Play music from YouTube, Spotify, SoundCloud, or direct link
- `/search <keywords>` - Search YouTube and select from results
- `/nowplaying` - Show current track with controls
- `/language` - Change server language (21 languages available)
- `/help` - Display all commands and features

## Playback Controls

Buttons on now playing embed:
- ⏸️/▶️ Pause/Resume
- ⏭️ Skip
- ⏹️ Stop
- 📋 Queue
- 🔀 Shuffle
- 🔊 Volume
- 🔁 Loop (Off → Track → Queue)
- 🎲 Autoplay (with genre selection)

## Sharding (for 1000+ servers)

The bot includes sharding support. To enable:
1. Set `TOTAL_SHARDS` secret to `auto` or a specific number
2. Run with: `node shard.js` instead of `node index.js`
3. See SHARDING.md for detailed documentation

## Troubleshooting

### Bot won't start
- **"Used disallowed intents"**: Enable MESSAGE CONTENT and SERVER MEMBERS intents in Discord Developer Portal
- **Invalid token**: Regenerate bot token and update DISCORD_TOKEN secret

### YouTube playback issues
- Add YouTube cookies (see setup step 3)
- Check console for specific error messages

### Spotify not working
- Verify SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are correct
- Ensure credentials are from https://developer.spotify.com/dashboard

### Commands not appearing
- Wait up to 1 hour for global commands to propagate
- Or set GUILD_ID secret for instant testing in specific server

## File Structure
```
├── commands/          # Slash command implementations
├── events/           # Button/modal interaction handlers
├── src/              # Core music player and platform services
├── languages/        # 21 language JSON files
├── database/         # Local JSON storage (auto-created)
├── audio_cache/      # Temporary audio files (auto-created)
├── config.js         # Configuration with env fallbacks
├── index.js          # Main bot entry point
├── shard.js          # Sharding manager for 1000+ servers
└── package.json      # Dependencies and scripts
```

## Support & Documentation

- [GitHub Repository](https://github.com/umutxyp/musicbot)
- [Official Website](https://musicmaker.vercel.app)
- [Support Server](https://discord.gg/ACJQzJuckW)
- See README.md for complete feature documentation
- See SHARDING.md for sharding guide
- See YOUTUBE_FIX.md for YouTube troubleshooting
