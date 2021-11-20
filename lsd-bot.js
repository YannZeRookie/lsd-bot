/**
 * The LSD Bot
 * 
 * This class is a litlle wrapper to make the glue between the first version of the code,
 * which was based on Botkit and Botkit-discord.
 * 
 * It also implement the hear() meathod, whih is a nice way to register message handlers
 */

const Discord = require('discord.js');
const { token } = require('./auth.json');

console.log(`Discord JS version: ${Discord.version}`);

class LSDBot {
    constructor(config) {
        this.config = config;
        this.token = token;
        this.client = new Discord.Client({
            intents: [
                Discord.Intents.FLAGS.GUILDS,
                Discord.Intents.FLAGS.GUILD_MESSAGES,
                Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Discord.Intents.FLAGS.DIRECT_MESSAGES,
                Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
            ],
            partials: ["CHANNEL"]
        });
        this.handlers = [];     // List of message handlers that are declared using hear()

        // When the client is ready, run this code (only once)
        this.client.once('ready', async () => {
            try {
                console.log(`Connected to Discord as ${this.client.user.username} - ${this.client.user.id}`);
                /* test code:
                const guild = await this.client.guilds.fetch(this.config.guild_id);
                const member = await guild.members.fetch('239334592241205248');
                const member2 = member;
                */
            } catch (e) {
                console.error(e);
            }
        });

        this.client.on('messageCreate', async message => {
            // Bot should not reply to itself with the same message
            if (
                message.author.id === this.client.user.id) {
                return;
            }
            try {
                // Handle the message by going through all the handlers and see when there is a match
                for (const handler of this.handlers) {
                    if (handler.regexp.test(message.content)) {
                        handler.handler(this, message);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });

        /**
         * TODO: implement this if needed. See https://discordjs.guide/interactions/registering-slash-commands.html
         */
        this.client.on('interactionCreate', async interaction => {
            console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction.`);
        });

        // Login to Discord with your client's token
        this.client.login(token);
    }

    /**
     * Register a message handler
     * 
     * @param {string} pattern RegExp string 
     * @param {messageHandler} handler the message handler
     */
    hears(pattern, handler) {
        this.handlers.push({
            pattern: pattern,
            handler: handler,
            regexp: new RegExp(pattern)
        });
    }

    /**
     * Glue method to reply to a message in the same channel
     * Use message.reply() if you want an "inline reply"
     * @param {Message} message 
     * @param {string} reply_string 
     */
    reply(message, reply_string) {
        message.channel.send(reply_string);
    }
}

/**
 * @callback messageHandler
 * @param {object} LSDBot
 * @param {string} pattern
 */



module.exports = LSDBot;
