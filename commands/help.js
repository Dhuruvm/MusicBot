const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all bot commands and features'),

    async execute(interaction, client) {
        try {
            const guildId = interaction.guild.id;

            const t = {
                title: await LanguageManager.getTranslation(guildId, 'commands.help.title'),
                description: await LanguageManager.getTranslation(guildId, 'commands.help.main_description'),
                commandsTitle: await LanguageManager.getTranslation(guildId, 'commands.help.commands_title'),
                commandsList: await LanguageManager.getTranslation(guildId, 'commands.help.commands_list'),
                buttonControlsTitle: await LanguageManager.getTranslation(guildId, 'commands.help.button_controls_title'),
                buttonControlsList: await LanguageManager.getTranslation(guildId, 'commands.help.button_controls_list'),
                platformsTitle: await LanguageManager.getTranslation(guildId, 'commands.help.platforms_title'),
                platformsList: await LanguageManager.getTranslation(guildId, 'commands.help.platforms_list'),
                featuresTitle: await LanguageManager.getTranslation(guildId, 'commands.help.features_title'),
                featuresList: await LanguageManager.getTranslation(guildId, 'commands.help.features_list'),
                howtoTitle: await LanguageManager.getTranslation(guildId, 'commands.help.howto_title'),
                howtoList: await LanguageManager.getTranslation(guildId, 'commands.help.howto_list'),
                statisticsTitle: await LanguageManager.getTranslation(guildId, 'commands.help.statistics_title'),
                linksTitle: await LanguageManager.getTranslation(guildId, 'commands.help.links_title'),
                footerText: await LanguageManager.getTranslation(guildId, 'commands.help.footer_text'),
                buttonWebsite: await LanguageManager.getTranslation(guildId, 'commands.help.button_website'),
                buttonSupport: await LanguageManager.getTranslation(guildId, 'commands.help.button_support'),
                buttonRefresh: await LanguageManager.getTranslation(guildId, 'commands.help.button_refresh')
            };

            let guilds, users, activeServers;

            if (client.shard) {
                try {
                    const guildCounts = await client.shard.fetchClientValues('guilds.cache.size');
                    guilds = guildCounts.reduce((acc, count) => acc + count, 0);

                    const memberCounts = await client.shard.broadcastEval(c => 
                        c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
                    );
                    users = memberCounts.reduce((acc, count) => acc + count, 0);

                    const activePlayers = await client.shard.broadcastEval(c => c.players.size);
                    activeServers = activePlayers.reduce((acc, count) => acc + count, 0);
                } catch (error) {
                    console.error('Error fetching shard statistics:', error);
                    guilds = client.guilds.cache.size;
                    users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                    activeServers = client.players.size;
                }
            } else {
                guilds = client.guilds.cache.size;
                users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                activeServers = client.players.size;
            }

            const statsServers = await LanguageManager.getTranslation(guildId, 'commands.help.stats_servers', { count: guilds });
            const statsUsers = await LanguageManager.getTranslation(guildId, 'commands.help.stats_users', { count: users.toLocaleString() });
            const statsActive = await LanguageManager.getTranslation(guildId, 'commands.help.stats_active', { count: activeServers });
            const statsUptime = await LanguageManager.getTranslation(guildId, 'commands.help.stats_uptime', { time: this.formatUptime(process.uptime()) });

            const containerComponents = [
                {
                    type: 10,
                    content: `**${t.title || '🎵 Music Bot Help'}**`
                },
                {
                    type: 14,
                    spacing_size: 1
                },
                {
                    type: 10,
                    content: t.description || 'Advanced Discord Music Bot with multi-platform support'
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.commandsTitle || '📝 Commands'}**`
                },
                {
                    type: 10,
                    content: Array.isArray(t.commandsList) ? t.commandsList.join('\n') : t.commandsList
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.buttonControlsTitle || '🎮 Button Controls'}**`
                },
                {
                    type: 10,
                    content: Array.isArray(t.buttonControlsList) ? t.buttonControlsList.join('\n') : t.buttonControlsList
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.platformsTitle || '🌐 Supported Platforms'}**`
                },
                {
                    type: 10,
                    content: Array.isArray(t.platformsList) ? t.platformsList.join('\n') : t.platformsList
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.featuresTitle || '✨ Features'}**`
                },
                {
                    type: 10,
                    content: Array.isArray(t.featuresList) ? t.featuresList.join('\n') : t.featuresList
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.howtoTitle || '📖 How to Use'}**`
                },
                {
                    type: 10,
                    content: Array.isArray(t.howtoList) ? t.howtoList.join('\n') : t.howtoList
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.statisticsTitle || '📊 Statistics'}**`
                },
                {
                    type: 10,
                    content: [
                        statsServers || `📁 Servers: ${guilds}`,
                        statsUsers || `👥 Users: ${users.toLocaleString()}`,
                        statsActive || `🎵 Active Servers: ${activeServers}`,
                        statsUptime || `⏱️ Uptime: ${this.formatUptime(process.uptime())}`
                    ].join('\n')
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `**${t.linksTitle || '🔗 Links'}**`
                },
                {
                    type: 10,
                    content: [
                        `[🌐 Website](${config.bot.website})`,
                        `[💬 Support Server](${config.bot.supportServer})`,
                        `[📄 Invite Bot](${config.bot.invite})`
                    ].join('\n')
                },
                {
                    type: 14,
                    spacing_size: 2
                },
                {
                    type: 10,
                    content: `_${client.user.username} • ${t.footerText || 'Made with ❤️'}_`
                }
            ];

            if (client.user.displayAvatarURL()) {
                containerComponents.splice(2, 0, {
                    type: 11,
                    url: client.user.displayAvatarURL()
                });
            }

            const components = [
                {
                    type: 17,
                    color: this.hexToInt(config.bot.embedColor),
                    components: containerComponents
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: ButtonStyle.Link,
                            label: t.buttonWebsite || 'Website',
                            url: config.bot.website
                        },
                        {
                            type: 2,
                            style: ButtonStyle.Link,
                            label: t.buttonSupport || 'Support',
                            url: config.bot.supportServer
                        },
                        {
                            type: 2,
                            style: ButtonStyle.Secondary,
                            custom_id: 'help_refresh',
                            label: t.buttonRefresh || 'Refresh',
                            emoji: { name: '🔄' }
                        }
                    ]
                }
            ];

            await interaction.reply({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

        } catch (error) {
            console.error('Error in help command:', error);

            const guildId = interaction.guild.id;
            const errorTitle = await LanguageManager.getTranslation(guildId, 'commands.help.error_title');
            const errorDescription = await LanguageManager.getTranslation(guildId, 'commands.help.error_description');

            const components = [
                {
                    type: 17,
                    color: 0xFF0000,
                    components: [
                        {
                            type: 10,
                            content: `**${errorTitle || '❌ Error'}**`
                        },
                        {
                            type: 10,
                            content: errorDescription || 'An error occurred while loading the help menu!'
                        }
                    ]
                }
            ];

            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ flags: COMPONENTS_V2_FLAG, components: components });
                } else if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });
                }
            } catch (responseError) {
                console.error('❌ Error sending help error response:', responseError);
            }
        }
    },

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    },

    hexToInt(hex) {
        return parseInt(hex.replace('#', ''), 16);
    }
};
