const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { JsonDB, Config } = require('node-json-db');
const fs = require('fs');
const path = require('path');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;
const db = new JsonDB(new Config('database/languages', true, true, '/'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Changes server language')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                const noPermissionTitle = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.errortitle');
                const noPermissionDesc = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.permission_required');
                
                const components = [
                    {
                        type: 17,
                        color: 0xFF0000,
                        components: [
                            {
                                type: 10,
                                content: `**${noPermissionTitle || '❌ Error'}**`
                            },
                            {
                                type: 10,
                                content: noPermissionDesc || 'You need Manage Server permission to use this command!'
                            }
                        ]
                    }
                ];
                
                return await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });
            }

            const guildId = interaction.guild.id;

            let currentLang = 'en';
            try {
                currentLang = await db.getData(`/servers/${guildId}/language`);
            } catch (error) {
                // Language not set, use default
            }

            const languagesPath = path.join(__dirname, '..', 'languages');
            const languageFiles = fs.readdirSync(languagesPath).filter(file => file.endsWith('.json'));

            const languages = [];
            for (const file of languageFiles) {
                const langData = JSON.parse(fs.readFileSync(path.join(languagesPath, file), 'utf8'));
                languages.push({
                    code: langData.language.code,
                    name: langData.language.name,
                    flag: langData.language.flag
                });
            }

            const currentLangData = languages.find(lang => lang.code === currentLang);
            const currentLangFile = JSON.parse(fs.readFileSync(path.join(languagesPath, `${currentLang}.json`), 'utf8'));

            const containerComponents = [
                {
                    type: 10,
                    content: `**${currentLangFile.commands.language.title || '🌐 Language Settings'}**`
                },
                {
                    type: 14,
                    spacing_size: 1
                },
                {
                    type: 10,
                    content: currentLangFile.commands.language.select || 'Select a language for this server:'
                },
                {
                    type: 14,
                    spacing_size: 1
                },
                {
                    type: 10,
                    content: `**${currentLangFile.commands.language.current || 'Current Language'}:** ${currentLangData.flag} ${currentLangData.name}`
                }
            ];

            const components = [
                {
                    type: 17,
                    color: 0x0099FF,
                    components: containerComponents
                }
            ];

            const buttons = [];
            const rows = [];

            for (let i = 0; i < languages.length; i++) {
                const lang = languages[i];
                const button = new ButtonBuilder()
                    .setCustomId(`language_${lang.code}`)
                    .setLabel(lang.name)
                    .setEmoji(lang.flag)
                    .setStyle(lang.code === currentLang ? ButtonStyle.Primary : ButtonStyle.Secondary);

                buttons.push(button);

                if (buttons.length === 5 || i === languages.length - 1) {
                    const row = new ActionRowBuilder().addComponents(...buttons);
                    rows.push(row);
                    buttons.length = 0;
                }
            }

            for (const row of rows) {
                components.push({
                    type: 1,
                    components: row.components.map(btn => ({
                        type: 2,
                        style: btn.data.style,
                        custom_id: btn.data.custom_id,
                        label: btn.data.label,
                        emoji: btn.data.emoji
                    }))
                });
            }

            await interaction.reply({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

        } catch (error) {
            console.error('Error in language command:', error);

            let errorDes = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.error2');
            let errorTitle = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.errortitle');

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
                            content: errorDes || 'An error occurred while loading language settings!'
                        }
                    ]
                }
            ];

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ flags: COMPONENTS_V2_FLAG, components: components });
            } else {
                await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });
            }
        }
    },

    async handleLanguageButton(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                const noPermissionTitle = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.errortitle');
                const noPermissionDesc = '❌ You need Manage Server permission to use this button!';
                
                const components = [
                    {
                        type: 17,
                        color: 0xFF0000,
                        components: [
                            {
                                type: 10,
                                content: `**${noPermissionTitle || '❌ Error'}**`
                            },
                            {
                                type: 10,
                                content: noPermissionDesc
                            }
                        ]
                    }
                ];
                
                return await interaction.reply({ flags: COMPONENTS_V2_FLAG | (1 << 6), components: components });
            }

            const guildId = interaction.guild.id;
            const selectedLang = interaction.customId.replace('language_', '');

            const success = await LanguageManager.setServerLanguage(guildId, selectedLang);

            if (!success) {
                throw new Error('Failed to save language preference');
            }

            const selectedLangData = await LanguageManager.getLanguageData(selectedLang);

            if (!selectedLangData) {
                throw new Error('Invalid language selected');
            }

            const successTitle = await LanguageManager.getTranslation(guildId, 'commands.language.changed');
            const successDescription = await LanguageManager.getTranslation(guildId, 'commands.language.changed_desc', {
                language: `${selectedLangData.language.flag} ${selectedLangData.language.name}`
            });

            const components = [
                {
                    type: 17,
                    color: 0x00FF00,
                    components: [
                        {
                            type: 10,
                            content: `**${successTitle || '✅ Language Changed'}**`
                        },
                        {
                            type: 10,
                            content: successDescription || `Language has been changed to ${selectedLangData.language.flag} ${selectedLangData.language.name}`
                        }
                    ]
                }
            ];

            await interaction.update({
                flags: COMPONENTS_V2_FLAG,
                components: components
            });

        } catch (error) {
            console.error('Error handling language button:', error);

            let errorDes = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.error');
            let errorTitle = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.errortitle');
            
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
                            content: errorDes || 'An error occurred while changing the language!'
                        }
                    ]
                }
            ];

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ flags: COMPONENTS_V2_FLAG, components: components });
            } else {
                await interaction.update({ flags: COMPONENTS_V2_FLAG, components: components });
            }
        }
    }
};
