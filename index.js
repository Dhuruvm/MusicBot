const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const MusicPlayer = require('./src/MusicPlayer');
const chalk = require('chalk');

require("./src/commandLoader");

setTimeout(() => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ]
    });

    client.commands = new Collection();
    client.players = new Collection();

    client.lavalink = new LavalinkManager({
        nodes: [
            {
                authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
                host: process.env.LAVALINK_HOST || "localhost",
                port: parseInt(process.env.LAVALINK_PORT) || 2333,
                id: "main-node",
                secure: process.env.LAVALINK_SECURE === "true"
            }
        ],
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) return guild.shard.send(payload);
        },
        client: {
            id: config.discord.clientId,
            username: "MusicBot",
        },
        autoSkip: false,
        playerOptions: {
            clientBasedPositionUpdateInterval: 100,
            defaultSearchPlatform: "ytmsearch",
            volumeDecrementer: 1,
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false
            },
            onEmptyQueue: {
                destroyAfterMs: 30_000,
                autoPlayFunction: async (player, track) => {
                    const guildPlayer = client.players.get(player.guildId);
                    if (guildPlayer && guildPlayer.autoplay) {
                        await guildPlayer.handleAutoplay();
                    }
                }
            },
            useUnresolvedData: true
        },
        queueOptions: {
            maxPreviousTracks: 25,
            queueStore: new Map(),
            queueChangesWatcher: null
        },
        linksAllowed: true,
        advancedOptions: {
            maxFilterFixDuration: 600000,
            debugOptions: {
                noAudio: false,
                playerDestroy: {
                    dontThrowError: false,
                    debugLog: false
                }
            }
        }
    });

    const MusicEmbedManager = require('./src/MusicEmbedManager');
    client.musicEmbedManager = new MusicEmbedManager(client);

    if (!global.clients) global.clients = {};
    global.clients.musicEmbedManager = client.musicEmbedManager;

    const loadCommands = () => {
        const commandsPath = path.join(__dirname, 'commands');

        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
        }

        try {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(chalk.green(`✓ Loaded command: ${command.data.name}`));
                } else {
                    console.log(chalk.yellow(`⚠ Warning: ${file} is missing required "data" or "execute" property.`));
                }
            }
        } catch (error) {
            console.log(chalk.yellow('⚠ No commands directory found, skipping command loading.'));
        }
    };

    const loadEvents = () => {
        const eventsPath = path.join(__dirname, 'events');

        if (!fs.existsSync(eventsPath)) {
            fs.mkdirSync(eventsPath, { recursive: true });
        }

        try {
            const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

            for (const file of eventFiles) {
                const filePath = path.join(eventsPath, file);
                delete require.cache[require.resolve(filePath)];
                const event = require(filePath);

                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                console.log(chalk.green(`✓ Loaded event: ${event.name}`));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠ No events directory found, using default events.'));
        }
    };

    client.once(Events.ClientReady, async () => {
        console.log(chalk.green(`✅ [SHARD ${client.shard?.ids[0] ?? 0}] ${client.user.tag} is online and ready!`));
        console.log(chalk.cyan(`🎵 [SHARD ${client.shard?.ids[0] ?? 0}] Music bot serving ${client.guilds.cache.size} servers on this shard!`));
        
        await client.lavalink.init({ 
            id: client.user.id, 
            username: client.user.username 
        });
        
        console.log(chalk.magenta('🎸 LavaLink initialized and connected!'));

        if (client.shard) {
            setTimeout(() => {
                client.shard.fetchClientValues('guilds.cache.size')
                    .then(results => {
                        const totalGuilds = results.reduce((acc, guildCount) => acc + guildCount, 0);
                        console.log(chalk.magenta(`🌐 [SHARD ${client.shard.ids[0]}] Total servers across all shards: ${totalGuilds}`));
                    })
                    .catch(err => {
                        if (!err.message.includes('still being spawned')) {
                            console.error(chalk.red('Error fetching total guild count:'), err);
                        }
                    });
            }, 10000);
        }

        setInterval(() => client.user.setActivity({ name: `${config.bot.status}`, type: ActivityType.Listening }), 10000);
    });

    client.on('raw', (d) => {
        client.lavalink.sendRawData(d);
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(chalk.red(`❌ No command matching ${interaction.commandName} was found.`));
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(chalk.red(`❌ Error executing ${interaction.commandName}:`), error);

            const errorMessage = '❌ An error occurred while executing this command!';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    });

    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        const mentionRegex = new RegExp(`^<@!?${client.user.id}>`);
        if (!mentionRegex.test(message.content)) return;

        const args = message.content.replace(mentionRegex, '').trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) {
            return message.reply('👋 Hey! Use `@bot p <song>` to play music or `@bot help` for all commands!');
        }

        try {
            const MusicPlayer = require('./src/MusicPlayer');
            const COMPONENTS_V2_FLAG = 1 << 15;

            switch (commandName) {
                case 'p':
                case 'play':
                    if (args.length === 0) {
                        return message.reply('❌ Please provide a song name or URL! Example: `@bot p Gata Only`');
                    }

                    if (!message.member.voice.channel) {
                        return message.reply('❌ You need to be in a voice channel to play music!');
                    }

                    const query = args.join(' ');
                    let player = client.players.get(message.guild.id);
                    
                    if (!player) {
                        player = new MusicPlayer(message.guild, message.channel, message.member.voice.channel, client.lavalink);
                        client.players.set(message.guild.id, player);
                    }

                    player.voiceChannel = message.member.voice.channel;
                    player.textChannel = message.channel;

                    await message.reply(`🔍 Searching for: **${query}**...`);

                    const result = await player.play(query, message.author);

                    if (!result.success) {
                        return message.channel.send(`❌ ${result.message}`);
                    }

                    if (result.type === 'playlist') {
                        const components = [{
                            type: 17,
                            color: 0x5865F2,
                            components: [
                                { type: 10, content: `✅ **Playlist Added**` },
                                { type: 10, content: `📋 **${result.playlistName}**` },
                                { type: 10, content: `🎵 Added **${result.trackCount}** tracks to the queue` }
                            ]
                        }];
                        await message.channel.send({ flags: COMPONENTS_V2_FLAG, components });
                    } else {
                        const track = result.track;
                        const components = [{
                            type: 17,
                            color: 0x5865F2,
                            components: [
                                { type: 10, content: `✅ **Added to Queue**` },
                                { type: 10, content: `🎵 **${track.info.title}**` },
                                { type: 10, content: `👤 ${track.info.author}` }
                            ]
                        }];
                        await message.channel.send({ flags: COMPONENTS_V2_FLAG, components });
                    }

                    if (client.musicEmbedManager) {
                        await client.musicEmbedManager.updateNowPlayingEmbed(player);
                    }
                    break;

                case 'np':
                case 'nowplaying':
                    const npPlayer = client.players.get(message.guild.id);
                    if (!npPlayer || !npPlayer.currentTrack) {
                        return message.reply('❌ No music is currently playing!');
                    }

                    const track = npPlayer.currentTrack;
                    const currentTime = npPlayer.getCurrentTime();
                    const progressBar = npPlayer.getProgressBar ? npPlayer.getProgressBar(currentTime, track.info.duration) : '▬▬▬▬▬▬▬▬▬▬';
                    
                    const components = [{
                        type: 17,
                        color: 0x5865F2,
                        components: [
                            { type: 10, content: `🎵 **Now Playing**` },
                            { type: 14, spacing_size: 1 },
                            { type: 10, content: `**${track.info.title}**` },
                            { type: 10, content: `👤 ${track.info.author}` },
                            { type: 14, spacing_size: 1 },
                            { type: 10, content: progressBar },
                            { type: 10, content: `⏱️ ${npPlayer.formatTime ? npPlayer.formatTime(currentTime) : '0:00'} / ${npPlayer.formatTime ? npPlayer.formatTime(track.info.duration) : '0:00'}` }
                        ]
                    }];

                    await message.reply({ flags: COMPONENTS_V2_FLAG, components });
                    break;

                case 'skip':
                    const skipPlayer = client.players.get(message.guild.id);
                    if (!skipPlayer) {
                        return message.reply('❌ No music is currently playing!');
                    }

                    if (!message.member.voice.channel || skipPlayer.voiceChannel.id !== message.member.voice.channel.id) {
                        return message.reply('❌ You need to be in the same voice channel!');
                    }

                    if (skipPlayer.queue.length === 0) {
                        return message.reply('❌ No tracks in queue to skip to!');
                    }

                    const skippedTrack = skipPlayer.currentTrack;
                    await skipPlayer.skip();
                    await message.reply(`⏭️ Skipped **${skippedTrack?.info?.title || 'track'}**!`);
                    break;

                case 'stop':
                    const stopPlayer = client.players.get(message.guild.id);
                    if (!stopPlayer) {
                        return message.reply('❌ No music is currently playing!');
                    }

                    if (!message.member.voice.channel || stopPlayer.voiceChannel.id !== message.member.voice.channel.id) {
                        return message.reply('❌ You need to be in the same voice channel!');
                    }

                    await stopPlayer.stop();
                    client.players.delete(message.guild.id);
                    await message.reply('⏹️ Stopped playback and cleared the queue!');
                    break;

                case 'pause':
                    const pausePlayer = client.players.get(message.guild.id);
                    if (!pausePlayer) {
                        return message.reply('❌ No music is currently playing!');
                    }

                    if (!message.member.voice.channel || pausePlayer.voiceChannel.id !== message.member.voice.channel.id) {
                        return message.reply('❌ You need to be in the same voice channel!');
                    }

                    if (pausePlayer.paused) {
                        pausePlayer.resume();
                        await message.reply('▶️ Resumed playback!');
                    } else {
                        pausePlayer.pause();
                        await message.reply('⏸️ Paused playback!');
                    }

                    if (client.musicEmbedManager) {
                        await client.musicEmbedManager.updateNowPlayingEmbed(pausePlayer);
                    }
                    break;

                case 'queue':
                case 'q':
                    const queuePlayer = client.players.get(message.guild.id);
                    if (!queuePlayer) {
                        return message.reply('❌ No music is currently playing!');
                    }

                    const queueComponents = client.musicEmbedManager.createQueueDisplay(queuePlayer, 0);
                    await message.reply({ flags: COMPONENTS_V2_FLAG, components: queueComponents });
                    break;

                case 'help':
                case 'h':
                    const helpComponents = [{
                        type: 17,
                        color: 0x5865F2,
                        components: [
                            { type: 10, content: `🎵 **Music Bot Commands**` },
                            { type: 14, spacing_size: 2 },
                            { type: 10, content: `**Playing Music:**` },
                            { type: 10, content: `\`@bot p <song>\` - Play a song` },
                            { type: 10, content: `\`@bot np\` - Show now playing` },
                            { type: 10, content: `\`@bot queue\` - Show queue` },
                            { type: 14, spacing_size: 1 },
                            { type: 10, content: `**Controls:**` },
                            { type: 10, content: `\`@bot pause\` - Pause/Resume` },
                            { type: 10, content: `\`@bot skip\` - Skip current song` },
                            { type: 10, content: `\`@bot stop\` - Stop and clear queue` },
                            { type: 14, spacing_size: 1 },
                            { type: 10, content: `**Platforms:** YouTube, Spotify, SoundCloud` },
                            { type: 10, content: `_You can also use slash commands like /play_` }
                        ]
                    }];
                    await message.reply({ flags: COMPONENTS_V2_FLAG, components: helpComponents });
                    break;

                default:
                    await message.reply(`❌ Unknown command: \`${commandName}\`\nUse \`@bot help\` to see available commands!`);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error executing message command:'), error);
            await message.reply('❌ An error occurred while executing that command!');
        }
    });

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const guild = oldState.guild;
        const player = client.players.get(guild.id);
        if (!player) return;

        const botMember = guild.members.me;
        const botId = botMember?.id ?? client.user.id;
        const involvesBot = oldState.id === botId || newState.id === botId;

        if (involvesBot) {
            const oldChannelId = oldState.channelId;
            const newChannelId = newState.channelId;

            if (oldChannelId && !newChannelId) {
                try {
                    const embedManager = client.musicEmbedManager;
                    if (embedManager) {
                        await embedManager.handlePlaybackEnd(player);
                    }
                } catch (error) {
                    console.error('❌ Failed to update playback UI after forced disconnect:', error);
                } finally {
                    player.cleanup();
                    client.players.delete(guild.id);
                }
                return;
            }

            if (newChannelId && oldChannelId !== newChannelId) {
                if (newState.channel) {
                    await player.moveToChannel(newState.channel);
                    player.clearInactivityTimer(false);
                    if (client.musicEmbedManager) {
                        await client.musicEmbedManager.updateNowPlayingEmbed(player);
                    }
                }
            }

            const wasMuted = oldState.serverMute || oldState.serverDeaf || oldState.suppress;
            const isMuted = newState.serverMute || newState.serverDeaf || newState.suppress;

            if (!wasMuted && isMuted) {
                const paused = player.pauseFor('mute');
                if (paused && client.musicEmbedManager) {
                    await client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            } else if (wasMuted && !isMuted) {
                const resumed = player.resumeFor('mute');
                if (client.musicEmbedManager && (resumed || !player.pauseReasons.has('mute'))) {
                    await client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            }
        }

        const voiceChannelId = player.voiceChannel?.id;
        if (!voiceChannelId) return;

        if (oldState.channelId === voiceChannelId || newState.channelId === voiceChannelId) {
            const channel = guild.channels.cache.get(voiceChannelId);

            if (!channel) {
                player.cleanup();
                client.players.delete(guild.id);
                return;
            }

            const listeners = channel.members.filter(member => !member.user.bot).size;

            if (listeners === 0) {
                player.startInactivityTimer();
                if (client.musicEmbedManager && player.currentTrack) {
                    await client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            } else {
                player.clearInactivityTimer(true);
                if (client.musicEmbedManager && player.currentTrack) {
                    await client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            }
        }
    });

    process.on('SIGINT', () => {
        client.players.forEach((player) => {
            player.stop();
        });

        client.destroy();
        process.exit(0);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);

        if (reason && reason.code) {
            switch (reason.code) {
                case 10062:
                case 40060:
                    console.log(chalk.yellow('ℹ️ Interaction error, safely ignoring...'));
                    return;
                case 50013:
                    console.error(chalk.red('❌ Missing permissions for Discord action'));
                    return;
            }
        }
    });

    process.on('uncaughtException', (error) => {
        console.error(chalk.red('❌ Uncaught Exception:'), error);

        if (error.code === 10062 || error.code === 40060) {
            console.log(chalk.yellow('ℹ️ Discord interaction error handled, continuing...'));
            return;
        }

        if (error.message && (error.message.includes('terminated') || 
            error.message.includes('ECONNRESET') || 
            error.message.includes('ETIMEDOUT'))) {
            console.log(chalk.yellow('⚠️ Network error occurred, but bot continues running...'));
            return;
        }

        console.log(chalk.red('🛑 Critical error occurred, shutting down...'));

        if (client && client.players) {
            client.players.forEach(player => {
                if (player && player.cleanup) {
                    player.cleanup();
                }
            });
            client.players.clear();
        }

        process.exit(1);
    });

    const init = async () => {
        try {
            console.log(chalk.blue('🤖 Starting Discord Music Bot with LavaLink...'));

            loadCommands();
            loadEvents();

            const gracefulShutdown = async (signal) => {
                console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down gracefully...`));
                
                client.players.forEach(player => {
                    if (player && player.cleanup) {
                        player.cleanup();
                    }
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                process.exit(0);
            };

            process.on('SIGINT', () => gracefulShutdown('SIGINT'));
            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            
            if (process.platform === 'win32') {
                const readline = require('readline');
                if (process.stdin.isTTY) {
                    readline.createInterface({
                        input: process.stdin,
                        output: process.stdout
                    }).on('SIGINT', () => gracefulShutdown('SIGINT'));
                }
            }

            await client.login(config.discord.token);

        } catch (error) {
            console.error(chalk.red('❌ Failed to start bot:'), error);
            process.exit(1);
        }
    };

    init();

    module.exports = client;
}, 5000);
