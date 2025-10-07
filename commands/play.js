const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const MusicPlayer = require('../src/MusicPlayer');
const LanguageManager = require('../src/LanguageManager');

const COMPONENTS_V2_FLAG = 1 << 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays music - Supports YouTube, Spotify, SoundCloud or direct links')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name, artist, YouTube/Spotify/SoundCloud URL or direct link')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }

            const query = interaction.options.getString('query');
            const member = interaction.member;
            const guild = interaction.guild;
            const channel = interaction.channel;

            const validationResult = await this.validateRequest(interaction, member, guild);
            if (!validationResult.success) {
                return await interaction.editReply({
                    content: validationResult.message
                });
            }

            let player = client.players.get(guild.id);
            if (!player) {
                player = new MusicPlayer(guild, channel, member.voice.channel, client.lavalink);
                client.players.set(guild.id, player);
            }

            player.voiceChannel = member.voice.channel;
            player.textChannel = channel;

            await interaction.editReply({ 
                content: `🔍 Searching for: **${query}**...` 
            });

            const result = await player.play(query, interaction.user);

            if (!result.success) {
                return await interaction.editReply({
                    content: `❌ ${result.message}`
                });
            }

            if (result.type === 'playlist') {
                const components = [
                    {
                        type: 15,
                        color: 0x5865F2,
                        components: [
                            {
                                type: 10,
                                content: `✅ **Playlist Added**`
                            },
                            {
                                type: 10,
                                content: `📋 **${result.playlistName}**`
                            },
                            {
                                type: 10,
                                content: `🎵 Added **${result.trackCount}** tracks to the queue`
                            }
                        ]
                    }
                ];

                await interaction.editReply({
                    content: '',
                    flags: COMPONENTS_V2_FLAG,
                    components: components
                });
            } else {
                const track = result.track;
                const components = [
                    {
                        type: 15,
                        color: 0x5865F2,
                        components: [
                            {
                                type: 10,
                                content: `✅ **Added to Queue**`
                            },
                            {
                                type: 10,
                                content: `🎵 **${track.info.title}**`
                            },
                            {
                                type: 10,
                                content: `👤 ${track.info.author}`
                            },
                            {
                                type: 10,
                                content: `⏱️ Duration: ${this.formatTime(track.info.duration)}`
                            }
                        ]
                    }
                ];

                await interaction.editReply({
                    content: '',
                    flags: COMPONENTS_V2_FLAG,
                    components: components
                });
            }

            if (client.musicEmbedManager) {
                await client.musicEmbedManager.updateNowPlayingEmbed(player);
            }

        } catch (error) {
            console.error('Error in play command:', error);
            
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ 
                        content: '❌ An error occurred while playing the track!' 
                    });
                } else if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ An error occurred while playing the track!', 
                        ephemeral: true 
                    });
                }
            } catch (responseError) {
                console.error('Error sending error response:', responseError);
            }
        }
    },

    async validateRequest(interaction, member, guild) {
        if (!member.voice.channel) {
            return { success: false, message: '❌ You need to be in a voice channel to play music!' };
        }

        const permissions = member.voice.channel.permissionsFor(guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return { success: false, message: '❌ I don\'t have permission to join or speak in your voice channel!' };
        }

        const botVoiceChannel = guild.members.me.voice.channel;
        if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
            return { success: false, message: '❌ You need to be in the same voice channel as me!' };
        }

        return { success: true };
    },

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
};
