const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config.js');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search and select music on YouTube')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Music name or artist to search')
                .setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString('query');
        const guildId = interaction.guild.id;
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        try {
            await interaction.deferReply();

            const validationResult = await this.validateRequest(interaction, member, guild);
            if (!validationResult.success) {
                return await interaction.editReply({
                    content: validationResult.message
                });
            }

            const client = interaction.client;
            const searchResult = await client.lavalink.search({
                query: query
            });

            if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
                const noResultsMsg = await LanguageManager.getTranslation(guildId, 'commands.search.no_results');
                return await interaction.editReply({
                    content: noResultsMsg || '❌ No results found!'
                });
            }

            const results = searchResult.tracks.slice(0, 9).map(track => ({
                title: track.info.title,
                artist: track.info.author,
                duration: Math.floor(track.info.duration / 1000),
                url: track.info.uri,
                track: track
            }));

            await this.showSearchMenu(interaction, results, query, guildId);

        } catch (error) {
            console.error('Error in search command:', error);
            const errorMsg = await LanguageManager.getTranslation(guildId, 'commands.search.error_search');
            await interaction.editReply({
                content: errorMsg || '❌ An error occurred while searching!'
            });
        }
    },

    async validateRequest(interaction, member, guild) {
        if (!member.voice.channel) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.voice_channel_required');
            return { success: false, message: errorMsg || '❌ You need to be in a voice channel!' };
        }

        const permissions = member.voice.channel.permissionsFor(guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.no_permissions');
            return { success: false, message: errorMsg || '❌ I don\'t have permission to join or speak in your voice channel!' };
        }

        const botVoiceChannel = guild.members.me.voice.channel;
        if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.same_channel_required');
            return { success: false, message: errorMsg || '❌ You need to be in the same voice channel!' };
        }

        return { success: true };
    },

    async showSearchMenu(interaction, results, query, guildId) {
        const searchTitle = await LanguageManager.getTranslation(guildId, 'commands.search.title', { query });
        const selectDescription = await LanguageManager.getTranslation(guildId, 'commands.search.select_description');
        const footerText = await LanguageManager.getTranslation(guildId, 'commands.search.footer', { count: results.length });
        const unknownTitle = await LanguageManager.getTranslation(guildId, 'commands.search.unknown_title');
        const unknownChannel = await LanguageManager.getTranslation(guildId, 'commands.search.unknown_channel');
        const unknownDuration = await LanguageManager.getTranslation(guildId, 'commands.search.unknown_duration');

        const containerComponents = [
            {
                type: 10,
                content: `**${searchTitle || `🔍 Search Results for "${query}"`}**`
            },
            {
                type: 14,
                spacing_size: 1
            },
            {
                type: 10,
                content: selectDescription || 'Select a track using the buttons below:'
            },
            {
                type: 14,
                spacing_size: 2
            }
        ];

        const maxResults = Math.min(results.length, 9);
        for (let index = 0; index < maxResults; index++) {
            const result = results[index];
            const title = result.title || unknownTitle || 'Unknown Title';
            const uploader = result.artist || unknownChannel || 'Unknown Channel';
            const duration = this.formatDuration(result?.duration, unknownDuration || 'Unknown');
            
            let valueLine = await LanguageManager.getTranslation(guildId, 'commands.search.result_line', {
                uploader,
                duration
            });
            
            if (valueLine === 'commands.search.result_line') {
                valueLine = `${uploader} • ${duration}`;
            }

            containerComponents.push(
                {
                    type: 10,
                    content: `**${index + 1}. ${title}**`
                },
                {
                    type: 10,
                    content: valueLine
                },
                {
                    type: 14,
                    spacing_size: 1
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
                content: `_${footerText || `Showing ${maxResults} results`}_`
            }
        );

        const components = [
            {
                type: 17,
                color: this.hexToInt(config.bot.embedColor),
                components: containerComponents
            }
        ];

        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();

        let hasSecondRow = false;

        for (let i = 0; i < maxResults; i++) {
            const button = new ButtonBuilder()
                .setCustomId(`search_select_${i}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Secondary);

            if (i < 4) {
                row1.addComponents(button);
            } else if (i < 9) {
                row2.addComponents(button);
                hasSecondRow = true;
            }
        }

        const cancelButtonLabel = await LanguageManager.getTranslation(guildId, 'commands.search.button_cancel');
        const cancelButton = new ButtonBuilder()
            .setCustomId('search_cancel')
            .setLabel(cancelButtonLabel || 'Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        row1.addComponents(cancelButton);

        components.push(
            {
                type: 1,
                components: row1.components.map(btn => ({
                    type: 2,
                    style: btn.data.style,
                    custom_id: btn.data.custom_id,
                    label: btn.data.label,
                    emoji: btn.data.emoji
                }))
            }
        );

        if (hasSecondRow && row2.components.length > 0) {
            components.push({
                type: 1,
                components: row2.components.map(btn => ({
                    type: 2,
                    style: btn.data.style,
                    custom_id: btn.data.custom_id,
                    label: btn.data.label
                }))
            });
        }

        if (!global.searchResults) global.searchResults = new Map();
        global.searchResults.set(interaction.user.id, {
            query: query,
            results: results,
            timestamp: Date.now()
        });

        setTimeout(() => {
            global.searchResults.delete(interaction.user.id);
        }, 5 * 60 * 1000);

        await interaction.editReply({
            flags: COMPONENTS_V2_FLAG,
            components: components
        });
    },

    formatDuration(seconds, unknownLabel = 'Unknown') {
        if (!seconds || seconds === 0) return unknownLabel;

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    },

    hexToInt(hex) {
        return parseInt(hex.replace('#', ''), 16);
    }
};
