const BotkitDiscord = require('botkit-discord');
var util = require('util');

// Load general configuration settings
var config = require('./config.json');

// Load Discord connection token
var discordConfig = require('./auth.json');
var discordBot = BotkitDiscord(discordConfig);

// MySQL
/*
 * Note: good article about the asynchronous nature of SQL requests in NodeJS: 
 * https://codeburst.io/node-js-mysql-and-async-await-6fb25b01b628
 * And a good one about pools and the right way to do it:
 * https://evertpot.com/executing-a-mysql-query-in-nodejs/
*/
var mysqlConfig = require('./db.json');
var mysql = null;
var db = null;
if (mysqlConfig.host) {
    const mysql = require('mysql2/promise');
    db = mysql.createPool(mysqlConfig);
} else {
    console.log('Running in no database mode');
}

// Load the LSD tools (users, roles, and sections management)
var lsd_tools = require('./lsd-tools');

// Cron jobs, see https://www.npmjs.com/package/node-cron
// Format:
// Seconds(0-59) Minutes(0-59) Hours(0-23) Day_of_Month(1-31) Months(0-11 for Jan-Dec) Day_of_Week(0-6 for Sun-Sat)
if (!config.noCron) {
    const cron = require("node-cron");
    cron.schedule('0 45 17 * * *', () => {
        var guild = discordBot.config.client.guilds.get(config.guild_id);
        lsd_tools.reviewInvites(db, guild);
    });
}

/**
 * General listening entry point
 */
discordBot.hears('^' + config.prefix + '.*', 'ambient', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var words = msg.message.content.substring(1).split(' ');
    if (words.length) {
        processCommand(words[0], 'ambient', bot, msg);
    }
});

discordBot.hears('hello', 'ambient', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    processCommand('hello', 'ambient', bot, msg);
});

/**
 * Direct Message = private message sent to the Bot
 */
discordBot.hears('.*', 'direct_message', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    // Remove the prefix, if any (we assume that all input are commands)
    var message = (msg.message.content[0] == config.prefix) ? msg.message.content.substring(1) : msg.message.content;
    var words = message.split(' ');
    if (words.length) {
        processCommand(words[0], 'direct_message', bot, msg);
    }
});

/**
 * Direct mention = mentioning the Bot during a private message to the Bot
 */
discordBot.hears('.*', 'direct_mention', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    //bot.reply(msg.message, 'Received a direct_mention from ' + msg.message.author.username);
    bot.reply(msg, "Salut " + msg.message.author.username + ", si tu as besoin d'aide, tape `" + config.prefix + "aide`");
    /*
    bot.send({
    	text: "You're talking to me?",
    	to: msg.message.author.id
    });
    */
    //console.log('Was direct_mention by ' + msg.message.author.username);
    //console.log("\n");
});

/**
 * Mention = mentioning the Bot in a general channel
 */
discordBot.hears('.*', 'mention', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg, msg.message.author.username + " parle de moi, c'est sympa ! Pour avoir de l'aide, tape `" + config.prefix + "aide`");
    //console.log('Was mentioned by ' + msg.message.author.username);
    //console.log("\n");
});

discordBot.on('ready', (bot, event) => {
    bot.log('Ready!');
});

discordBot.on('disconnect', (bot, event) => {
    if (db) {
        db.end();
    }
    bot.log('Good-bye!');
});

/**
 * Welcome of new members: we send a private message
 */
discordBot.on('guildMemberAdd', (bot, members) => {
    if (members.length) {
        var member = members[0];
        member.send(`Salut ${member}, et bienvenue chez les Scorpions du Désert !` + "\n\n" +
            "La guilde Les Scorpions du Désert [LSD] est une guilde multi-jeux organisée en association \
loi 1901 dont le but est de soutenir ses joueurs autour d'un style de jeu unique : le jeu en groupe. \
Active depuis 2002, Les Scorpions du Désert est l'une des guildes les plus réputées \
et les plus actives du monde francophone." + "\n\n" +
            "En tant que simple Visiteur, tu ne verras pas grand-chose sur notre serveur Discord, à part le Bar. \
Cela te permettra quand même de faire connaissance avec les membres et de leur parler. Un Scorpion peut alors t'inviter \
ce qui te permettra d'accéder temporairement à tous les canaux des jeux et de jouer avec nous.\n\n" +
            "Si cette expérience te convainc et que tu as envie de devenir un ou une vrai(e) LSD, la procédure d'inscription \
est très simple et se fait à l'aide de notre Bot. Il te suffit de taper `"+ config.prefix + "inscription` dans un canal, et notre \
Bot t'enverra un lien de connexion qui t'emmènera sur notre site de gestion de comptes, où tu pourras poser ta \
candidature. Pour en savoir plus sur notre Bot, tape `"+ config.prefix + "aide`\n\
À bientôt !"
        );
    }
});

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------

/**
 * General command processing dispatcher
 * @param {string} command 
 * @param {string} context 
 * @param {*} bot 
 * @param {*} msg 
 */
function processCommand(command, context, bot, msg) {
    switch (command.toLowerCase()) {
        case 'connexion':
        case 'connection':
        case 'connect':
        case 'login':
        case 'c':
            var key = lsd_tools.buildConnectionKey(db, msg.message.author);
            msg.message.author.send("Voici ton lien de connexion : " + buidLoginUrl(key)).then(
                (newMessage) => {
                    newMessage.delete(3600 * 1000); // Delete the message after one hour because the key will be expired by then
                }
            );
            console.log('Connection request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
            if (context == 'ambient') {
                msg.message.delete(4000);   // Remove the message to avoid poluting the channel
            }
            break;
        case 'restart':
            const guild = discordBot.config.client.guilds.get(config.guild_id);
            if (guild) {
                const member = guild.members.get(msg.message.author.id);
                if (member && member.roles.some(role => { return role.name == 'Admin'; })) {
                    msg.message.author.send("Redémarrage du Bot").then(() => {
                        process.exit(1);
                    });
                }
            }
            break;
        case 'inscription':
        case 'signup':
        case 'go':
            var key = lsd_tools.buildConnectionKey(db, msg.message.author);
            msg.message.author.send("Voici ton lien pour t'inscrire : " + buidLoginUrl(key)).then(
                (newMessage) => {
                    newMessage.delete(3600 * 1000); // Delete the message after one hour because the key will be expired by then
                }
            );
            console.log('Inscription request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
            if (context == 'ambient') {
                msg.message.delete(4000);   // Remove the message to avoid poluting the channel
            }
            break;
        case 'hello':
            bot.reply(msg, 'Salut à toi ' + msg.message.author.username + ' ! Pour avoir de l\'aide, tape `' + config.prefix + 'aide`');
            break;
        case 'lance':
            lance(bot, msg);
            break;
        case 'inviter':
        case 'invite':
        case 'invit':
        case 'invitation':
        case 'i':
            try {
                msg.guild.fetchMember(msg.user, false)
                    .then(cur_member => {
                        var expiration = 7;     // Default delay is 7 days
                        var r = msg.message.content.match(/\s+(\d+)\s*$/);
                        if (r && r[1] && r[1] > 7 && r[1] < 365) {
                            expiration = r[1]
                        }
                        if (!msg.mentions.users || !msg.mentions.users.size) {
                            bot.reply(msg, "Erreur : vous devez mentionner au moins une personne à inviter");
                        }
                        for (var target_user of msg.mentions.users) {
                            /* msg.mentions.users.forEach(target => { */
                            msg.guild.fetchMember(target_user[1], false)
                                .then(target_member => {
                                    lsd_tools.invite(db, msg.guild, target_member, cur_member, expiration)
                                        .then(exp => {
                                            bot.reply(msg, "Invitation réussie de " + (target_member.nickname ? target_member.nickname : target_member.displayName));
                                            // Send a private message to the invited user, with explanations
                                            target_member.send("Félicitations, tu as désormais le statut d'Invité sur le serveur des Scorpions du Désert ! \
Ceci te permet de circuler et de communiquer sur tous les canaux ouverts aux invités de notre serveur Discord.\n\
Attention, tu redeviendras automatiquement simple visiteur au bout de " + exp + " jours, après quoi \
il faudra qu'un Scorpion t'invite de nouveau.\n\
Nous espérons que ton passage chez nous te plaîra et, qui saît ?, te décidera à nous rejoindre.\n\
Bon séjour parmi nous ! - Les Scorpions du Désert");
                                        })
                                        .catch(err => {
                                            bot.reply(msg, err);
                                        });
                                })
                                .catch(err => {
                                    bot.reply(msg, err);
                                });
                        }; //for
                    })
                    .catch(err => {
                        bot.reply(msg, err);
                    });
            }
            catch (e) {
                console.error(e);
            }
            break;
        case 'uninvite':
        case 'ui':
            /* test message for YannZeGrunt : 
            *  §uninvite <@!404722937183076354>
            */

            if (!msg.mentions.users || !msg.mentions.users.size) {
                bot.reply(msg, "Erreur : vous devez mentionner au moins une personne à dé-inviter");
            }
            const invite_role = msg.guild.roles.find(role => role.name === 'Invité');
            for (var target_user of msg.mentions.users) {
                msg.guild.fetchMember(target_user[1], false)
                    .then(target_member => {
                        lsd_tools.degrade_invite(db, msg.guild, {
                            discord_id: target_member.id,
                            discord_username: target_member.displayName,
                            by_discord_id: msg.user.id
                        }, invite_role);
                    })
                    .catch(err => {
                        bot.reply(msg, err);
                    });
            }//for
            break;
        case 'aide':
        case 'help':
        case 'sos':
        case 'a':
            bot.reply(msg, helpMessage());
            break;
        case 'raccourcis':
        case 'shortcuts':
        case 'short':
        case 'synomynmes':
        case 'r':
            bot.reply(msg, sortcutsMessage());
            break;
        default:
            bot.reply(msg, "Commande inconnue, tape `" + config.prefix + "aide` pour la liste des commandes disponibles");

    }
}



function buidLoginUrl(key) {
    return config.connection_url + '/' + key;
}

/**
 * Return help message
 */
function helpMessage() {
    var msg = "Bonjour, je suis le Bot des Scorpions du Désert. Les commandes commencent par `!`\nVoici la liste : \n\
      ```\n\
!inscription        Poste ta candidature pour devenir un ou une LSD !\n\
!connexion          Connecte-toi sur le site de gestion de ton compte LSD\n\
!inviter @Toto      Inviter un Visiteur pour 7 jours (Scorpions uniquement)\n\
!inviter @Toto 42   Inviter un Visiteur pour un nombre de jours précis (Officiers ou + uniquement)\n\
!aide               Obtenir cette aide\n\
!lance nombre       Lance un dé entre 1 et 'nombre'. Ex : dé à 6 faces : !lance 6\n\
!raccourcis         Alternatives courtes des commandes\n\
      ```";
      return msg.replace(/!/g, config.prefix);
    }

/**
 * Return shortcut messages;
 */
function sortcutsMessage() {
    var msg = "Raccourcis et synonymes des commandes :\n" +
        "`!connexion`:  `!connection`, `!connect`, `!login`, `!c`\n" +
        "`!inscription`:  `!signup`, `!go` \n" +
        "`!inviter`:  `!invite`, `!invit`, `!invitation`, `!i`\n" +
        "`!aide`:  `!help`, `!sos`, `!a`\n" +
        "`!raccourcis`:  `!shortcuts`, `!short`, `!synomynmes`, `!r`\n" +
        ""
        ;
    return msg.replace(/!/g, config.prefix);
}

/**
 * Random dice generator
 * @param {*} bot 
 * @param {*} msg 
 */
function lance(bot, msg) {
    var r = msg.message.content.match(/lance\s+(\d+)/);
    if (r && r[1] && r[1] > 1) {
        if (r[1] <= 100000000) {
            var result = 1 + Math.floor(Math.random() * Math.floor(r[1]));
            bot.reply(msg.message, 'OK, je lance un dé à ' + r[1] + ' faces ! Résultat : ' + result);
        }
        else {
            bot.reply(msg.message, "Désolé, je suis limité à 100000000");
        }
    } else {
        bot.reply(msg.message, "Désolé, je n'ai pas compris. Il me faut un nombre ≥ 2 après la commande");
    }
}
