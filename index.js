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
