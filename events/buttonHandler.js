const { Events, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const chalk = require('chalk');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.member;

        const customId = interaction.customId;

        if (customId.startsWith('pause_')) {
            await this.handlePause(interaction, client);
        } else if (customId.startsWith('skip_')) {
            await this.handleSkip(interaction, client);
        } else if (customId.startsWith('stop_')) {
            await this.handleStop(interaction, client);
        } else if (customId.startsWith('queue_')) {
            await this.handleQueue(interaction, client);
        } else if (customId.startsWith('shuffle_')) {
            await this.handleShuffle(interaction, client);
        } else if (customId.startsWith('volume_')) {
            await this.handleVolumeModal(interaction, client);
        } else if (customId.startsWith('loop_')) {
            await this.handleLoop(interaction, client);
        } else if (customId.startsWith('autoplay_')) {
            await this.handleAutoplay(interaction, client);
        } else if (customId.startsWith('lyrics_')) {
            await this.handleLyrics(interaction, client);
        } else if (customId.startsWith('autoplay_genre_')) {
            await this.handleAutoplayGenre(interaction, client);
        } else if (customId.startsWith('queue_close_')) {
            await interaction.deferUpdate();
            await interaction.deleteReply();
        }
    },

    async handlePause(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        if (player.paused) {
            player.resume();
            await interaction.reply({
                content: '▶️ Resumed playback!',
                ephemeral: true
            });
        } else {
            player.pause();
            await interaction.reply({
                content: '⏸️ Paused playback!',
                ephemeral: true
            });
        }

        if (client.musicEmbedManager) {
            await client.musicEmbedManager.updateNowPlayingEmbed(player);
        }
    },

    async handleSkip(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        if (player.queue.length === 0) {
            return await interaction.reply({
                content: '❌ No tracks in queue to skip to!',
                ephemeral: true
            });
        }

        const currentTrack = player.currentTrack;
        await player.skip();

        await interaction.reply({
            content: `⏭️ Skipped **${currentTrack?.info?.title || 'track'}**!`,
            ephemeral: true
        });
    },

    async handleStop(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        await player.stop();
        client.players.delete(interaction.guild.id);

        await interaction.reply({
            content: '⏹️ Stopped playback and cleared the queue!',
            ephemeral: true
        });
    },

    async handleQueue(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        const page = 0;
        const components = client.musicEmbedManager.createQueueDisplay(player, page);

        await interaction.reply({
            flags: COMPONENTS_V2_FLAG,
            components: components,
            ephemeral: true
        });
    },

    async handleShuffle(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        if (player.queue.length < 2) {
            return await interaction.reply({
                content: '❌ Need at least 2 tracks in queue to shuffle!',
                ephemeral: true
            });
        }

        player.toggleShuffle();

        await interaction.reply({
            content: player.shuffle ? '🔀 Shuffle enabled!' : '🔢 Shuffle disabled!',
            ephemeral: true
        });

        if (client.musicEmbedManager) {
            await client.musicEmbedManager.updateNowPlayingEmbed(player);
        }
    },

    async handleVolumeModal(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('volume_modal')
            .setTitle('Set Volume');

        const volumeInput = new TextInputBuilder()
            .setCustomId('volume_input')
            .setLabel('Volume (0-100)')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setPlaceholder('50')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(volumeInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },

    async handleLoop(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        const newMode = player.toggleLoop();

        let message;
        if (newMode === 'track') {
            message = '🔂 Loop: Track Repeat';
        } else if (newMode === 'queue') {
            message = '🔁 Loop: Queue Repeat';
        } else {
            message = '➡️ Loop: Off';
        }

        await interaction.reply({
            content: message,
            ephemeral: true
        });

        if (client.musicEmbedManager) {
            await client.musicEmbedManager.updateNowPlayingEmbed(player);
        }
    },

    async handleAutoplay(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== interaction.member.voice.channel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        if (player.autoplay) {
            player.autoplay = false;
            
            await interaction.reply({
                content: '🎯 Autoplay disabled!',
                ephemeral: true
            });

            if (client.musicEmbedManager) {
                await client.musicEmbedManager.updateNowPlayingEmbed(player);
            }
            return;
        }

        const genreSelect = new StringSelectMenuBuilder()
            .setCustomId(`autoplay_genre_${player.sessionId}`)
            .setPlaceholder('Select a genre for autoplay')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Pop').setValue('pop').setEmoji('🎵'),
                new StringSelectMenuOptionBuilder().setLabel('Rock').setValue('rock').setEmoji('🎸'),
                new StringSelectMenuOptionBuilder().setLabel('Hip-Hop').setValue('hiphop').setEmoji('🎤'),
                new StringSelectMenuOptionBuilder().setLabel('Electronic').setValue('electronic').setEmoji('🎹'),
                new StringSelectMenuOptionBuilder().setLabel('Jazz').setValue('jazz').setEmoji('🎺'),
                new StringSelectMenuOptionBuilder().setLabel('Classical').setValue('classical').setEmoji('🎻'),
                new StringSelectMenuOptionBuilder().setLabel('Metal').setValue('metal').setEmoji('⚡'),
                new StringSelectMenuOptionBuilder().setLabel('Country').setValue('country').setEmoji('🤠'),
                new StringSelectMenuOptionBuilder().setLabel('R&B').setValue('rnb').setEmoji('🎙️'),
                new StringSelectMenuOptionBuilder().setLabel('Indie').setValue('indie').setEmoji('🎭'),
                new StringSelectMenuOptionBuilder().setLabel('Latin').setValue('latin').setEmoji('💃'),
                new StringSelectMenuOptionBuilder().setLabel('K-Pop').setValue('kpop').setEmoji('🇰🇷'),
                new StringSelectMenuOptionBuilder().setLabel('Anime').setValue('anime').setEmoji('🎌'),
                new StringSelectMenuOptionBuilder().setLabel('Lo-Fi').setValue('lofi').setEmoji('☕'),
                new StringSelectMenuOptionBuilder().setLabel('Random').setValue('random').setEmoji('🎲')
            ]);

        const row = new ActionRowBuilder().addComponents(genreSelect);

        await interaction.reply({
            content: '🎲 Select a genre for autoplay:',
            components: [row],
            ephemeral: true
        });
    },


    async handleLyrics(interaction, client) {
        const player = client.players.get(interaction.guild.id);

        if (!player || !player.currentTrack) {
            return await interaction.reply({
                content: '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const lyrics = await player.getLyrics();

            if (!lyrics) {
                return await interaction.editReply({
                    content: '❌ No lyrics found for this track!'
                });
            }

            const track = player.currentTrack;
            const maxLength = 2000;
            let lyricsText = lyrics.lyrics || lyrics;

            if (lyricsText.length > maxLength) {
                lyricsText = lyricsText.substring(0, maxLength - 50) + '\n\n... [Lyrics truncated]';
            }

            const components = [
                {
                    type: 15,
                    color: 0x5865F2,
                    components: [
                        {
                            type: 10,
                            content: `📜 **Lyrics: ${track.info.title}**`
                        },
                        {
                            type: 10,
                            content: `👤 ${track.info.author}`
                        },
                        {
                            type: 12,
                            spacing_size: 2
                        },
                        {
                            type: 10,
                            content: lyricsText
                        }
                    ]
                }
            ];

            await interaction.editReply({
                content: '',
                flags: COMPONENTS_V2_FLAG,
                components: components
            });
        } catch (error) {
            console.error(chalk.red('Error fetching lyrics:'), error);
            await interaction.editReply({
                content: '❌ Failed to fetch lyrics!'
            });
        }
    }
};
