const { Events } = require('discord.js');
const config = require('../config');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.member;

        try {
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('autoplay_genre_')) {
                    await this.handleAutoplayGenre(interaction, client);
                    return;
                }
            }

            switch (interaction.customId) {
                case 'volume_modal':
                    await this.handleVolumeModal(interaction, client);
                    break;

                default:
                    await interaction.reply({
                        content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.unknown_modal') || '❌ Unknown modal!',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error in modal handler:', error);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.processing_error') || '❌ An error occurred!',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Error sending error reply:', replyError);
                }
            }
        }
    },

    async handleAutoplayGenre(interaction, client) {
        const guild = interaction.guild;
        const member = interaction.member;

        if (!member.voice.channel) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.voice_channel_required') || '❌ You need to be in a voice channel!',
                flags: [1 << 6]
            });
        }

        const player = client.players.get(guild.id);
        if (!player) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.no_music_playing') || '❌ No music is currently playing!',
                flags: [1 << 6]
            });
        }

        if (player.voiceChannel.id !== member.voice.channel.id) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.different_voice_channel') || '❌ You need to be in the same voice channel!',
                flags: [1 << 6]
            });
        }

        const selectedGenre = interaction.values[0];
        player.autoplay = selectedGenre;

        const genreName = await LanguageManager.getTranslation(guild?.id, `genres.${selectedGenre}`) || selectedGenre;
        const title = await LanguageManager.getTranslation(guild?.id, 'buttonhandler.autoplay_enabled') || 'Autoplay Enabled';
        const description = (await LanguageManager.getTranslation(guild?.id, 'buttonhandler.autoplay_enabled_desc') || 'Autoplay has been enabled with genre: {genre}').replace('{genre}', genreName);
        const changedBy = await LanguageManager.getTranslation(guild?.id, 'buttonhandler.changed_by') || 'Changed by';

        const components = [
            {
                type: 17,
                color: this.hexToInt(config.bot.embedColor),
                components: [
                    {
                        type: 10,
                        content: `🎲 **${title}**`
                    },
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: description
                    },
                    {
                        type: 14,
                        spacing_size: 1
                    },
                    {
                        type: 10,
                        content: `**${changedBy}:** ${member}`
                    }
                ]
            }
        ];

        await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });

        if (client.musicEmbedManager) {
            await client.musicEmbedManager.updateNowPlayingEmbed(player);
        }
    },

    async handleVolumeModal(interaction, client) {
        const guild = interaction.guild;
        const member = interaction.member;

        if (!member.voice.channel) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.voice_channel_required') || '❌ You need to be in a voice channel!',
                ephemeral: true
            });
        }

        const player = client.players.get(guild.id);
        if (!player) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.no_music_playing') || '❌ No music is currently playing!',
                ephemeral: true
            });
        }

        if (player.voiceChannel.id !== member.voice.channel.id) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.same_channel_required') || '❌ You need to be in the same voice channel!',
                ephemeral: true
            });
        }

        const volumeInput = interaction.fields.getTextInputValue('volume_input');
        const volume = parseInt(volumeInput);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            return await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.invalid_volume') || '❌ Volume must be between 0 and 100!',
                ephemeral: true
            });
        }

        const success = player.setVolume(volume);

        if (success) {
            const title = await LanguageManager.getTranslation(guild?.id, 'modalhandler.volume_changed_title') || 'Volume Changed';
            const description = await LanguageManager.getTranslation(guild?.id, 'modalhandler.volume_changed_desc', { volume }) || `Volume has been set to ${volume}%`;
            const setBy = await LanguageManager.getTranslation(guild?.id, 'modalhandler.set_by') || 'Set by';
            const level = await LanguageManager.getTranslation(guild?.id, 'modalhandler.level') || 'Level';
            const volumeBar = this.createVolumeBar(volume);

            const components = [
                {
                    type: 17,
                    color: this.hexToInt(config.bot.embedColor),
                    components: [
                        {
                            type: 10,
                            content: `🔊 **${title}**`
                        },
                        {
                            type: 14,
                            spacing_size: 1
                        },
                        {
                            type: 10,
                            content: description
                        },
                        {
                            type: 14,
                            spacing_size: 1
                        },
                        {
                            type: 10,
                            content: `**${setBy}:** ${member}`
                        },
                        {
                            type: 14,
                            spacing_size: 1
                        },
                        {
                            type: 10,
                            content: `**${level}:** ${volumeBar}`
                        }
                    ]
                }
            ];

            await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });

            if (client.musicEmbedManager) {
                await client.musicEmbedManager.updateNowPlayingEmbed(player);
            }
        } else {
            await interaction.reply({
                content: await LanguageManager.getTranslation(guild?.id, 'modalhandler.volume_error') || '❌ Failed to set volume!',
                ephemeral: true
            });
        }
    },

    createVolumeBar(volume) {
        const barLength = 20;
        const filledBars = Math.floor((volume / 100) * barLength);
        const emptyBars = barLength - filledBars;

        const bar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
        return `\`${bar}\` ${volume}%`;
    },

    hexToInt(hex) {
        return parseInt(hex.replace('#', ''), 16);
    }
};
