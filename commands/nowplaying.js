const { SlashCommandBuilder } = require('discord.js');
const config = require('../config');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows information about currently playing song'),

    async execute(interaction, client) {
        try {
            const guild = interaction.guild;
            const guildId = guild.id;

            const player = client.players.get(guild.id);
            if (!player) {
                const noPlayerMsg = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.no_player');
                return await interaction.reply({
                    content: `❌ ${noPlayerMsg || 'No music is currently playing!'}`,
                    ephemeral: true
                });
            }

            if (!player.currentTrack) {
                const noTrackMsg = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.no_track');
                return await interaction.reply({
                    content: `❌ ${noTrackMsg || 'No track is currently playing!'}`,
                    ephemeral: true
                });
            }

            const track = player.currentTrack;
            const currentTime = player.getCurrentTime();
            const status = player.getStatus();

            const title = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.title');
            const artistLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.artist');
            const platformLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.platform');
            const platformCode = (track.platform || 'unknown').toString().toLowerCase();
            const platformNameKey = `commands.nowplaying.platform_name_${platformCode}`;
            let platformName = await LanguageManager.getTranslation(guildId, platformNameKey);

            if (platformName === platformNameKey) {
                if (track.platform) {
                    platformName = track.platform.charAt(0).toUpperCase() + track.platform.slice(1);
                } else {
                    const unknownKey = 'commands.nowplaying.platform_name_unknown';
                    const unknownTranslation = await LanguageManager.getTranslation(guildId, unknownKey);
                    platformName = unknownTranslation === unknownKey ? 'Unknown' : unknownTranslation;
                }
            }

            const progressLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.progress');
            const statusLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.status');
            const statusPlaying = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.status_playing');
            const statusPaused = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.status_paused');
            const statusStopped = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.status_stopped');
            const repeatTrack = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.repeat_track');
            const repeatQueue = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.repeat_queue');
            const shuffleText = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.shuffle');

            let statusText = '';
            if (status.playing) {
                statusText += statusPlaying;
            } else if (status.paused) {
                statusText += statusPaused;
            } else {
                statusText += statusStopped;
            }

            const volumeKey = 'commands.nowplaying.volume';
            let volumeText = await LanguageManager.getTranslation(guildId, volumeKey, { volume: status.volume });
            if (volumeText === volumeKey) {
                volumeText = `🔊 %${status.volume}`;
            }

            statusText += ` • ${volumeText}`;

            if (status.loop === 'track') {
                statusText += ` • ${repeatTrack}`;
            } else if (status.loop === 'queue') {
                statusText += ` • ${repeatQueue}`;
            }

            if (status.shuffle) {
                statusText += ` • ${shuffleText}`;
            }

            const containerComponents = [
                {
                    type: 10,
                    content: `**${title || 'Now Playing'}**`
                },
                {
                    type: 14,
                    spacing_size: 1
                },
                {
                    type: 10,
                    content: `🎵 **[${track.title}](${track.url})**`
                }
            ];

            if (track.artist) {
                containerComponents.push({
                    type: 10,
                    content: `${artistLabel || 'Artist'}: ${track.artist}`
                });
            }

            if (track.album) {
                const albumLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.album');
                containerComponents.push({
                    type: 10,
                    content: `${albumLabel || 'Album'}: ${track.album}`
                });
            }

            containerComponents.push({
                type: 10,
                content: `${platformLabel || 'Platform'}: ${this.getPlatformEmoji(platformCode)} ${platformName}`
            });

            if (track.duration && track.duration > 0) {
                const progressBar = this.createProgressBar(currentTime, track.duration * 1000);
                const currentTimeFormatted = this.formatTime(currentTime);
                const totalTimeFormatted = this.formatDuration(track.duration);

                containerComponents.push(
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: `**${progressLabel || 'Progress'}**`
                    },
                    {
                        type: 10,
                        content: `${currentTimeFormatted} / ${totalTimeFormatted}`
                    },
                    {
                        type: 10,
                        content: progressBar
                    }
                );
            }

            if (track.requestedBy) {
                const requestedByLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.requested_by');
                containerComponents.push(
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: `${requestedByLabel || 'Requested by'}: <@${track.requestedBy.id}>`
                    }
                );
            }

            containerComponents.push(
                {
                    type: 14,
                    spacing_size: 1
                },
                {
                    type: 10,
                    content: `**${statusLabel || 'Status'}**`
                },
                {
                    type: 10,
                    content: statusText
                }
            );

            if (player.queue.length > 0) {
                const nextSongLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.next_song');
                const footerMoreSongs = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.footer_more_songs', { count: player.queue.length });

                containerComponents.push(
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: `**${nextSongLabel || 'Next Song'}**`
                    },
                    {
                        type: 10,
                        content: `[${player.queue[0].title}](${player.queue[0].url})`
                    },
                    {
                        type: 10,
                        content: `_${footerMoreSongs || `${player.queue.length} more songs in queue`}_`
                    }
                );
            } else {
                const footerNoSongs = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.footer_no_songs');
                containerComponents.push(
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: `_${footerNoSongs || 'No more songs in queue'}_`
                    }
                );
            }

            if (track.thumbnail) {
                containerComponents.splice(2, 0, {
                    type: 11,
                    url: track.thumbnail
                });
            }

            const components = [
                {
                    type: 17,
                    color: this.hexToInt(config.bot.embedColor),
                    components: containerComponents
                }
            ];

            await interaction.reply({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

        } catch (error) {
            console.error('Error in nowplaying command:', error);
            const guildId = interaction.guild.id;
            const errorMsg = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.error_getting_info');
            await interaction.reply({
                content: `❌ ${errorMsg || 'An error occurred while getting track info!'}`,
                ephemeral: true
            });
        }
    },

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';

        const totalSeconds = Math.floor(Number(seconds) || 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    },

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        return this.formatDuration(seconds);
    },

    createProgressBar(current, total, length = 15) {
        if (!total || total === 0) return '▬'.repeat(length);

        const currentMs = typeof current === 'number' ? current : 0;
        const totalMs = total;
        const progress = Math.min(currentMs / totalMs, 1);
        const filledLength = Math.round(progress * length);

        const filled = '▬'.repeat(filledLength);
        const empty = '▬'.repeat(length - filledLength);
        const indicator = '🔘';

        if (filledLength === 0) {
            return indicator + empty;
        } else if (filledLength === length) {
            return filled + indicator;
        } else {
            return filled + indicator + empty.substring(1);
        }
    },

    getPlatformEmoji(platform) {
        const emojis = {
            youtube: '🔴',
            spotify: '🟢',
            soundcloud: '🟠',
            direct: '🔗'
        };
        return emojis[platform] || '🎵';
    },

    hexToInt(hex) {
        return parseInt(hex.replace('#', ''), 16);
    }
};
