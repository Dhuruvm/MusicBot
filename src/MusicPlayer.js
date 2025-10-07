const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const LanguageManager = require('./LanguageManager');
const LyricsManager = require('./LyricsManager');
const chalk = require('chalk');

class MusicPlayer {
    constructor(guild, textChannel, voiceChannel, lavalinkManager) {
        this.guild = guild;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.lavalinkManager = lavalinkManager;
        
        this.player = null;
        
        this.volume = config.bot.defaultVolume;
        this.loop = false;
        this.autoplay = false;
        this.shuffle = false;
        
        this.nowPlayingMessage = null;
        this.requesterId = null;
        this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        this.currentLyrics = null;
        
        this.pauseReasons = new Set();
        this.inactivityTimer = null;
        this.inactivityTimeoutMs = 2 * 60 * 1000;
    }

    async createPlayer() {
        if (this.player) return this.player;

        this.player = this.lavalinkManager.createPlayer({
            guildId: this.guild.id,
            voiceChannelId: this.voiceChannel.id,
            textChannelId: this.textChannel.id,
            selfDeaf: true,
            selfMute: false,
            volume: this.volume,
            instaUpdateFiltersFix: true,
            applyVolumeAsFilter: false
        });
        
        await this.player.connect();
        
        this.setupPlayerEvents();
        
        return this.player;
    }

    setupPlayerEvents() {
        if (!this.player) return;

        this.player.on('trackStart', async (player, track) => {
            console.log(chalk.cyan(`🎵 Now playing: ${track.info.title}`));
            
            try {
                const embedManager = global.clients?.musicEmbedManager;
                if (embedManager) {
                    await embedManager.updateNowPlayingEmbed(this);
                }
            } catch (error) {
                console.error(chalk.red('❌ Error updating now playing embed:'), error);
            }
        });

        this.player.on('trackEnd', async (player, track, payload) => {
            console.log(chalk.yellow(`⏭️ Track ended: ${track.info.title}`));
            
            if (this.loop === 'track') {
                await this.player.play({ track });
                return;
            }

            if (this.loop === 'queue' && this.player.queue.tracks.length === 0) {
                this.player.queue.add(track);
            }

            if (this.player.queue.tracks.length === 0 && this.autoplay) {
                await this.handleAutoplay();
            }

            if (this.player.queue.tracks.length === 0 && !this.autoplay) {
                const embedManager = global.clients?.musicEmbedManager;
                if (embedManager) {
                    await embedManager.handlePlaybackEnd(this);
                }
            }
        });

        this.player.on('queueEnd', async (player) => {
            console.log(chalk.magenta('📭 Queue ended'));
            
            if (this.autoplay) {
                await this.handleAutoplay();
            } else {
                const embedManager = global.clients?.musicEmbedManager;
                if (embedManager) {
                    await embedManager.handlePlaybackEnd(this);
                }
            }
        });

        this.player.on('playerDisconnect', (player, voiceChannelId) => {
            console.log(chalk.red(`🔌 Disconnected from voice channel ${voiceChannelId}`));
            this.cleanup();
        });

        this.player.on('playerSocketClosed', (player, payload) => {
            console.log(chalk.yellow('⚠️ WebSocket closed:', payload.reason));
        });
    }

    async play(query, requester) {
        try {
            if (!this.player) {
                await this.createPlayer();
            }

            const result = await this.lavalinkManager.search({
                query: query,
                source: this.detectSource(query)
            }, requester);

            if (!result || !result.tracks || result.tracks.length === 0) {
                return { success: false, message: 'No tracks found!' };
            }

            this.requesterId = requester.id;

            if (result.loadType === 'playlist') {
                this.player.queue.add(result.tracks);
                
                if (!this.player.playing && !this.player.paused) {
                    await this.player.play();
                }

                return {
                    success: true,
                    type: 'playlist',
                    playlistName: result.playlistInfo?.name || 'Playlist',
                    trackCount: result.tracks.length
                };
            } else {
                const track = result.tracks[0];
                this.player.queue.add(track);

                if (!this.player.playing && !this.player.paused) {
                    await this.player.play();
                }

                return {
                    success: true,
                    type: 'track',
                    track: track
                };
            }
        } catch (error) {
            console.error(chalk.red('❌ Error playing track:'), error);
            return { success: false, message: error.message };
        }
    }

    detectSource(query) {
        if (query.includes('spotify.com')) return 'spsearch';
        if (query.includes('soundcloud.com')) return 'scsearch';
        if (query.includes('youtube.com') || query.includes('youtu.be')) return 'ytsearch';
        return 'ytmsearch';
    }

    pause() {
        if (this.player && this.player.playing) {
            this.player.pause();
            this.pauseReasons.add('manual');
            return true;
        }
        return false;
    }

    pauseFor(reason) {
        this.pauseReasons.add(reason);
        if (this.player && this.player.playing) {
            this.player.pause();
            return true;
        }
        return false;
    }

    resume() {
        if (this.player && this.player.paused) {
            this.pauseReasons.delete('manual');
            if (this.pauseReasons.size === 0) {
                this.player.resume();
                return true;
            }
        }
        return false;
    }

    resumeFor(reason) {
        this.pauseReasons.delete(reason);
        if (this.pauseReasons.size === 0 && this.player && this.player.paused) {
            this.player.resume();
            return true;
        }
        return false;
    }

    async skip() {
        if (this.player && this.player.queue.current) {
            await this.player.skip();
            return true;
        }
        return false;
    }

    async stop() {
        if (this.player) {
            this.player.queue.clear();
            await this.player.stop();
            await this.player.disconnect();
            this.cleanup();
            return true;
        }
        return false;
    }

    setVolume(volume) {
        if (this.player) {
            this.volume = Math.max(0, Math.min(100, volume));
            this.player.setVolume(this.volume);
            return true;
        }
        return false;
    }

    toggleLoop() {
        if (this.loop === false) {
            this.loop = 'track';
        } else if (this.loop === 'track') {
            this.loop = 'queue';
        } else {
            this.loop = false;
        }
        return this.loop;
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        if (this.shuffle && this.player && this.player.queue.tracks.length > 0) {
            this.player.queue.shuffle();
        }
        return this.shuffle;
    }

    async toggleAutoplay() {
        this.autoplay = !this.autoplay;
        return this.autoplay;
    }

    setAutoplayGenre(genre) {
        this.autoplay = genre;
        return true;
    }

    async handleAutoplay() {
        if (!this.autoplay || typeof this.autoplay !== 'string') return;

        try {
            const genres = {
                'pop': ['pop music', 'top hits', 'popular songs'],
                'rock': ['rock music', 'classic rock', 'rock hits'],
                'hiphop': ['hip hop music', 'rap music', 'hip hop hits'],
                'electronic': ['electronic music', 'edm', 'house music'],
                'jazz': ['jazz music', 'smooth jazz', 'jazz classics'],
                'classical': ['classical music', 'orchestra music', 'classical piano'],
                'metal': ['metal music', 'heavy metal', 'metal hits'],
                'country': ['country music', 'country hits', 'modern country'],
                'rnb': ['r&b music', 'rnb hits', 'soul music'],
                'indie': ['indie music', 'indie rock', 'indie pop'],
                'latin': ['latin music', 'reggaeton', 'latin hits'],
                'kpop': ['kpop', 'korean pop', 'kpop hits'],
                'anime': ['anime opening', 'anime music', 'anime soundtrack'],
                'lofi': ['lofi hip hop', 'lofi beats', 'chill lofi'],
                'blues': ['blues music', 'blues rock', 'blues classics'],
                'reggae': ['reggae music', 'reggae hits', 'reggae classics'],
                'disco': ['disco music', 'disco hits', 'funk disco'],
                'punk': ['punk rock', 'punk music', 'punk hits'],
                'ambient': ['ambient music', 'ambient electronic', 'chill ambient'],
                'random': ['music', 'songs', 'hits']
            };

            const genreTerms = genres[this.autoplay.toLowerCase()] || genres['random'];
            const randomTerm = genreTerms[Math.floor(Math.random() * genreTerms.length)];

            console.log(chalk.cyan(`🎲 Autoplay: Finding ${this.autoplay} music...`));

            const result = await this.lavalinkManager.search({
                query: randomTerm,
                source: 'ytmsearch'
            }, { id: 'autoplay' });

            if (result && result.tracks && result.tracks.length > 0) {
                const filteredTracks = result.tracks.filter(track => {
                    const title = track.info.title.toLowerCase();
                    const duration = track.info.duration;
                    
                    if (duration < 30000 || duration > 600000) return false;
                    
                    const blockedKeywords = [
                        'tutorial', 'lesson', 'how to', 'guide', 'podcast',
                        'interview', 'review', 'full album', 'compilation',
                        'mix', 'dj set', 'lecture', 'asmr'
                    ];
                    
                    for (const keyword of blockedKeywords) {
                        if (title.includes(keyword)) return false;
                    }
                    
                    return true;
                });

                const track = filteredTracks[0] || result.tracks[0];
                this.player.queue.add(track);
                
                if (!this.player.playing && !this.player.paused) {
                    await this.player.play();
                }

                console.log(chalk.green(`✅ Autoplay: Added "${track.info.title}"`));
            }
        } catch (error) {
            console.error(chalk.red('❌ Autoplay error:'), error);
        }
    }

    startInactivityTimer() {
        this.clearInactivityTimer(false);
        this.pauseFor('alone');
        
        this.inactivityTimer = setTimeout(() => {
            console.log(chalk.yellow(`⏰ Inactivity timeout for guild ${this.guild.name}`));
            this.stop();
        }, this.inactivityTimeoutMs);
    }

    clearInactivityTimer(resume = true) {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
        if (resume) {
            this.resumeFor('alone');
        }
    }

    async moveToChannel(newChannel) {
        if (this.player) {
            this.voiceChannel = newChannel;
            this.player.voiceChannelId = newChannel.id;
        }
    }

    get currentTrack() {
        return this.player?.queue?.current || null;
    }

    get queue() {
        return this.player?.queue?.tracks || [];
    }

    get playing() {
        return this.player?.playing || false;
    }

    get paused() {
        return this.player?.paused || false;
    }

    get position() {
        return this.player?.position || 0;
    }

    getQueue(start = 0, limit = 10) {
        if (!this.player || !this.player.queue) return [];
        return this.player.queue.tracks.slice(start, start + limit);
    }

    cleanup() {
        this.clearInactivityTimer(false);
        
        if (this.player) {
            try {
                this.player.destroy();
            } catch (error) {
                console.error(chalk.red('Error destroying player:'), error);
            }
            this.player = null;
        }
        
        this.nowPlayingMessage = null;
        this.currentLyrics = null;
    }

    async getLyrics() {
        if (!this.currentTrack) return null;
        
        if (this.currentLyrics) return this.currentLyrics;

        try {
            const track = this.currentTrack;
            const lyrics = await LyricsManager.fetchLyrics(
                track.info.title,
                track.info.author
            );
            
            this.currentLyrics = lyrics;
            return lyrics;
        } catch (error) {
            console.error(chalk.red('Error fetching lyrics:'), error);
            return null;
        }
    }
}

module.exports = MusicPlayer;
