const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const LanguageManager = require('./LanguageManager');
const chalk = require('chalk');

const COMPONENTS_V2_FLAG = 1 << 15;

class MusicEmbedManager {
    constructor(client) {
        this.client = client;
    }

    createNowPlayingComponents(player) {
        const track = player.currentTrack;
        if (!track) return this.createQueueEndedComponents(player);

        const progress = this.getProgressBar(player.position, track.info.duration);
        const duration = this.formatTime(track.info.duration);
        const position = this.formatTime(player.position);

        const statusEmoji = player.paused ? '⏸️' : '▶️';
        const loopEmoji = player.loop === 'track' ? '🔂' : player.loop === 'queue' ? '🔁' : '➡️';
        const shuffleEmoji = player.shuffle ? '🔀' : '🔢';
        const autoplayEmoji = player.autoplay ? '🎲' : '🎯';

        const titleText = `${statusEmoji} **${track.info.title}**`;
        const authorText = `👤 ${track.info.author}`;
        const durationText = `⏱️ ${position} / ${duration}`;
        const queueText = `📋 Queue: ${player.queue.length} tracks`;
        const statusText = `${loopEmoji} Loop • ${shuffleEmoji} Shuffle • ${autoplayEmoji} Autoplay`;

        const components = [
            {
                type: 17,
                color: this.hexToInt(player.guild.members.me.displayHexColor || '#5865F2'),
                components: [
                    {
                        type: 10,
                        content: titleText
                    },
                    {
                        type: 10,
                        content: authorText
                    },
                    {
                        type: 10,
                        content: progress
                    },
                    {
                        type: 10,
                        content: durationText
                    },
                    {
                        type: 10,
                        content: queueText
                    },
                    {
                        type: 10,
                        content: statusText
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: player.paused ? ButtonStyle.Success : ButtonStyle.Secondary,
                        custom_id: `pause_${player.sessionId}`,
                        emoji: { name: player.paused ? '▶️' : '⏸️' },
                        label: player.paused ? 'Resume' : 'Pause'
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Primary,
                        custom_id: `skip_${player.sessionId}`,
                        emoji: { name: '⏭️' },
                        label: 'Skip',
                        disabled: player.queue.length === 0
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Danger,
                        custom_id: `stop_${player.sessionId}`,
                        emoji: { name: '⏹️' },
                        label: 'Stop'
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `queue_${player.sessionId}`,
                        emoji: { name: '📋' },
                        label: 'Queue'
                    },
                    {
                        type: 2,
                        style: player.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary,
                        custom_id: `shuffle_${player.sessionId}`,
                        emoji: { name: '🔀' },
                        label: 'Shuffle',
                        disabled: player.queue.length < 2
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `volume_${player.sessionId}`,
                        emoji: { name: '🔊' },
                        label: `Volume ${player.volume}%`
                    },
                    {
                        type: 2,
                        style: player.loop ? ButtonStyle.Success : ButtonStyle.Secondary,
                        custom_id: `loop_${player.sessionId}`,
                        emoji: { name: player.loop === 'track' ? '🔂' : player.loop === 'queue' ? '🔁' : '➡️' },
                        label: player.loop === 'track' ? 'Loop Track' : player.loop === 'queue' ? 'Loop Queue' : 'No Loop'
                    },
                    {
                        type: 2,
                        style: player.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary,
                        custom_id: `autoplay_${player.sessionId}`,
                        emoji: { name: '🎲' },
                        label: player.autoplay ? `Autoplay: ${player.autoplay}` : 'Autoplay Off'
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `lyrics_${player.sessionId}`,
                        emoji: { name: '📜' },
                        label: 'Lyrics'
                    }
                ]
            }
        ];

        return components;
    }

    createQueueEndedComponents(player) {
        const components = [
            {
                type: 17,
                color: this.hexToInt('#99AAB5'),
                components: [
                    {
                        type: 10,
                        content: '⏹️ **Playback Ended**'
                    },
                    {
                        type: 10,
                        content: 'The queue is empty. Use `/play` to add more music!'
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `ended_${player.sessionId}`,
                        emoji: { name: '⏹️' },
                        label: 'Queue Ended',
                        disabled: true
                    }
                ]
            }
        ];

        return components;
    }

    createQueueDisplay(player, page = 0) {
        const itemsPerPage = 10;
        const queue = player.getQueue(page * itemsPerPage, itemsPerPage);
        const totalPages = Math.ceil(player.queue.length / itemsPerPage);

        if (queue.length === 0) {
            return [
                {
                    type: 17,
                    color: this.hexToInt('#99AAB5'),
                    components: [
                        {
                            type: 10,
                            content: '📋 **Queue is Empty**'
                        },
                        {
                            type: 10,
                            content: 'Add tracks with `/play` command!'
                        }
                    ]
                }
            ];
        }

        let queueText = `📋 **Queue** (Page ${page + 1}/${totalPages || 1})\n\n`;
        queue.forEach((track, index) => {
            const position = page * itemsPerPage + index + 1;
            queueText += `${position}. **${track.info.title}** - ${track.info.author} (${this.formatTime(track.info.duration)})\n`;
        });

        const components = [
            {
                type: 17,
                color: this.hexToInt(player.guild.members.me.displayHexColor || '#5865F2'),
                components: [
                    {
                        type: 10,
                        content: queueText
                    }
                ]
            }
        ];

        if (totalPages > 1) {
            components.push({
                type: 1,
                components: [
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `queue_prev_${player.sessionId}_${page}`,
                        emoji: { name: '◀️' },
                        label: 'Previous',
                        disabled: page === 0
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `queue_next_${player.sessionId}_${page}`,
                        emoji: { name: '▶️' },
                        label: 'Next',
                        disabled: page >= totalPages - 1
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        custom_id: `queue_close_${player.sessionId}`,
                        emoji: { name: '❌' },
                        label: 'Close'
                    }
                ]
            });
        }

        return components;
    }

    async sendNowPlaying(player) {
        try {
            const components = this.createNowPlayingComponents(player);
            
            const message = await player.textChannel.send({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

            player.nowPlayingMessage = message;
            return message;
        } catch (error) {
            console.error(chalk.red('❌ Error sending now playing message:'), error);
            return null;
        }
    }

    async updateNowPlayingEmbed(player) {
        try {
            if (!player.nowPlayingMessage) {
                return await this.sendNowPlaying(player);
            }

            const components = this.createNowPlayingComponents(player);
            
            await player.nowPlayingMessage.edit({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

            return player.nowPlayingMessage;
        } catch (error) {
            console.error(chalk.red('❌ Error updating now playing message:'), error);
            player.nowPlayingMessage = null;
            return await this.sendNowPlaying(player);
        }
    }

    async handlePlaybackEnd(player) {
        try {
            if (!player.nowPlayingMessage) return;

            const components = this.createQueueEndedComponents(player);
            
            await player.nowPlayingMessage.edit({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });
        } catch (error) {
            console.error(chalk.red('❌ Error handling playback end:'), error);
        }
    }

    getProgressBar(position, duration, length = 20) {
        if (!duration || duration === 0) return '▬'.repeat(length);
        
        const progress = Math.min(position / duration, 1);
        const filled = Math.round(progress * length);
        const empty = length - filled;
        
        return '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, empty - 1));
    }

    formatTime(ms) {
        if (!ms || ms === 0) return '0:00';
        
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    hexToInt(hex) {
        return parseInt(hex.replace('#', ''), 16);
    }
}

module.exports = MusicEmbedManager;
