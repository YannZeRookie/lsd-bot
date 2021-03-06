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

// TeamSpeak
var teamspeak = require('./teamspeak');

// Load the LSD tools (users, roles, and sections management)
var lsd_tools = require('./lsd-tools');

// Cron jobs, see https://www.npmjs.com/package/node-cron
// Format:
// Seconds(0-59) Minutes(0-59) Hours(0-23) Day_of_Month(1-31) Months(0-11 for Jan-Dec) Day_of_Week(0-6 for Sun-Sat)
if (!config.noCron) {
    const cron = require("node-cron");
    cron.schedule('0 45 17 * * *', async () => {
        try {
            var guild = await discordBot.config.client.guilds.cache.get(config.guild_id);
            lsd_tools.reviewInvites(db, discordConfig, guild);
        }
        catch (e) {
            console.error('Error in cron: ' + e);
        }
    });
}

/**
 * General listening entry point
 */
discordBot.hears('^' + config.prefix + '.*', 'ambient', async (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var words = msg.message.content.substring(1).split(' ');
    if (words.length) {
        await processCommand(words[0], 'ambient', bot, msg);
    }
});

discordBot.hears('hello', 'ambient', async (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    await processCommand('hello', 'ambient', bot, msg);
});

/**
 * Direct Message = private message sent to the Bot
 */
discordBot.hears('.*', 'direct_message', async (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    // Remove the prefix, if any (we assume that all input are commands)
    var message = (msg.message.content[0] == config.prefix) ? msg.message.content.substring(1) : msg.message.content;
    var words = message.split(' ');
    if (words.length) {
        await processCommand(words[0], 'direct_message', bot, msg);
    }
});

/**
 * Direct mention = mentioning the Bot during a private message to the Bot
 */
discordBot.hears('.*', 'direct_mention', async (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    //bot.reply(msg.message, 'Received a direct_mention from ' + msg.message.author.username);
    await bot.reply(msg, "Salut " + msg.message.author.username + ", si tu as besoin d'aide, tape `" + config.prefix + "aide`");
});

/**
 * Mention = mentioning the Bot in a general channel
 */
discordBot.hears('.*', 'mention', async (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    await bot.reply(msg, msg.message.author.username + " parle de moi, c'est sympa ! Pour avoir de l'aide, tape `" + config.prefix + "aide`");
});

discordBot.on('shardDisconnect', (bot, event) => {
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
async function processCommand(command, context, bot, msg) {
    switch (command.toLowerCase()) {
        case 'connexion':
        case 'connection':
        case 'connect':
        case 'login':
        case 'c':
            try {
                console.log('Connection request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
                var key = lsd_tools.buildConnectionKey(db, msg.message.author);
                newMessage = await msg.message.author.send("Voici ton lien de connexion : " + buidLoginUrl(key));
                newMessage.delete({ timeout: 3600 * 1000 }); // Delete the message after one hour because the key will be expired by then. Note: we do NOT wait for completion here, to avoid waiting for one hour!
                if (context == 'ambient') {
                    msg.message.delete({ timeout: 4000 });   // Remove the message to avoid poluting the channel. Here again, no await
                }
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'restart':
            try {
                const member = await getMessageMember(msg);
                if (member && member.roles.cache.some(role => { return role.name == 'Admin'; })) {
                    member.send("Redémarrage du Bot").then(() => {
                        process.exit(1);
                    });
                }
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'event':
        case 'events':
        case 'e':
            try {
                event_msg(bot, msg);
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'inscription':
        case 'signup':
        case 'go':
            try {
                console.log('Inscription request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
                var key = lsd_tools.buildConnectionKey(db, msg.message.author);
                newMessage = await msg.message.author.send("Voici ton lien pour t'inscrire : " + buidLoginUrl(key));
                newMessage.delete({ timeout: 3600 * 1000 }); // Delete the message after one hour because the key will be expired by then. Note: we do NOT wait for completion here, to avoid waiting for one hour!
                if (context == 'ambient') {
                    msg.message.delete({ timeout: 4000 });   // Remove the message to avoid poluting the channel. Here again, no await
                }
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'hello':
            bot.reply(msg, 'Salut à toi ' + msg.message.author.username + ' ! Pour avoir de l\'aide, tape `' + config.prefix + 'aide`');
            break;
        case 'kill_list':
        case 'k':
            try {
                kill_list_msg(bot, msg);
            }
            catch (e) {
                bot.reply(msg, e);
            }
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
                const cur_member = await getMessageMember(msg);
                if (!cur_member) {
                    throw "Erreur : vous êtes inconnu du serveur";
                }
                var expiration = 7;     // Default delay is 7 days
                var r = msg.message.content.match(/\s+(\d+)\s*$/);
                if (r && r[1] && r[1] > 7 && r[1] < 365) {
                    expiration = r[1]
                }
                if (!msg.mentions.users || !msg.mentions.users.size) {
                    throw "Erreur : personne n'a été mentionné";
                }
                if (!msg.mentions.members || !msg.mentions.members.size) {
                    throw "Erreur : les personnes mentionnées sont inconnues du serveur";
                }
                msg.mentions.members.forEach(async target_member => {
                    try {
                        const exp = await lsd_tools.invite(db, msg.guild, target_member, cur_member, expiration);
                        bot.reply(msg, "Invitation réussie de " + (target_member.nickname ? target_member.nickname : target_member.displayName) + ` pour ${exp} jours`);
                        // Send a private message to the invited user, with explanations
                        target_member.send("Félicitations, tu as désormais le statut d'Invité sur le serveur des Scorpions du Désert ! \
Ceci te permet de circuler et de communiquer sur tous les canaux ouverts aux invités de notre serveur Discord.\n\
Attention, tu redeviendras automatiquement simple visiteur au bout de " + exp + " jours, après quoi \
il faudra qu'un Scorpion t'invite de nouveau.\n\
Nous espérons que ton passage chez nous te plaîra et, qui saît ?, te décidera à nous rejoindre.\n\
Bon séjour parmi nous ! - Les Scorpions du Désert");
                    } catch (e) {
                        bot.reply(msg, e);
                    }
                });
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'uninvite':
        case 'ui':
            /* test message for YannZeGrunt : 
            *  §uninvite <@!404722937183076354>
            */
            try {
                const cur_member = await getMessageMember(msg);
                if (!msg.mentions.users || !msg.mentions.users.size) {
                    throw "Erreur : personne n'a été mentionné";
                }
                if (!msg.mentions.members || !msg.mentions.members.size) {
                    throw "Erreur : les personnes mentionnées sont inconnues du serveur";
                }
                msg.mentions.members.forEach(async target_member => {
                    try {

                        lsd_tools.degrade_invite(db, msg.guild, {
                            discord_id: target_member.id,
                            discord_username: (target_member.nickname ?? target_member.displayName),
                            by_discord_id: msg.user.id,
                            by_discord_username: (cur_member.nickname ?? cur_member.displayName)
                        }, true);
                    }
                    catch (e) {
                        bot.reply(msg, e);
                    }
                });
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'ts':  // TeamSpeak connection
            try {
                const cur_member = await getMessageMember(msg);
                if (cur_member) {
                    const tsLink = await teamspeak.getConnectionLink(cur_member.roles.cache, cur_member.lsdName);
                    newMessage = await msg.message.author.send("Lien vers TeamSpeak : " + tsLink);
                    newMessage.delete({ timeout: 3600 * 1000 }); // Delete the message after one hour because the key will be expired by then. Note: we do NOT wait for completion here, to avoid waiting for one hour!
                    if (context == 'ambient') {
                        msg.message.delete({ timeout: 4000 });   // Remove the message to avoid poluting the channel. Here again, no await
                    }    
                }
            } catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'review':
            // Review and purge invites (manual version of the cron-job, useful for debugging)
            try {
                if (!msg.guild) throw "Error: please un this command from a server channel";
                await lsd_tools.reviewInvites(db, discordConfig, msg.guild);
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'test':
            // Test area
            try {
                if (!msg.guild) throw "Error: please un this command from a server channel";
                const guild = msg.guild;
                const role = await guild.roles.fetch('404693131573985280');
                const members = role.members;
            }
            catch (e) {
                bot.reply(msg, e);
            }
            break;
        case 'aide':
        case 'help':
        case 'sos':
        case 'a':
        case 'h':
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
!event              Gestion des événements\n\
!kill_list          Affichage des listes de joueurs ennemis ou griefers\n\
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
        "`!connexion  ` :  `!connection`, `!connect`, `!login`, `!c`\n" +
        "`!inscription` :  `!signup`, `!go` \n" +
        "`!inviter    ` :  `!invite`, `!invit`, `!invitation`, `!i`\n" +
        "`!event      ` :  `!e`\n" +
        "`!kill_list  ` :  `!k`\n" +
        "`!aide       ` :  `!help`, `!sos`, `!h`, `!a`\n" +
        "`!raccourcis ` :  `!shortcuts`, `!short`, `!synomynmes`, `!r`\n" +
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


/**
 * Get the member of a message, even if the message was sent as a PM
 * @param {Message} msg
 * @returns {GuildMember}
 */
async function getMessageMember(msg) {
    var member = null;
    try {
        if (msg.member) {
            member = msg.member;
        } else {
            // Find it in the Guild
            const guild = await discordBot.config.client.guilds.cache.get(config.guild_id);
            member = await guild.members.fetch(msg.user);
        }
        if (member) {
            member.lsdName = member.nickname ? member.nickname : member.displayName;
        }
    }
    catch (e) {
        console.error(e);
    }
    return member;
}



/**
 * Event manager through the bot and a mysql table
 * @param {*} bot 
 * @param {*} msg 
 */
async function event_msg(bot, msg) {
    const msglines = msg.message.content.split('\n');
    const arguments = msglines[0].trim().split(/ +/g);
    const member = await getMessageMember(msg);
    if (member && member.roles.cache.some(role => role.name === 'Scorpion')) {  // Only Scorpions can uses the events feature
        const highest_rank = member.roles.highest.name;
        if (!arguments[1]) {
            // if no argument was given, give help to the user to explain how things work
            event_msg_help(bot, msg, "commande incomplète");
        } else {
            switch (arguments[1].toLowerCase()) {
                //if the first argument is 'create', it will create a new event, according to the other arguments given
                case 'create':
                case 'c':
                    if (!arguments[2] || !arguments[3] || !arguments[4] || !arguments[5] || msglines.length < 2) {
                        bot.reply(msg, 'Erreur : paramètres invalides ou description de l\'event manquante.\n\
Pour créer un event, indiquez sur la première ligne \'!event create\', suivit d\'une section(JDM, DU, etc...), d\'une date (AAAA/MM/JJ), d\'une heure (HH:MM)\
, d\'un titre, et finalement ajoutez le reste des informations concernant l\'event dans les lignes suivantes');
                    }
                    else {
                        let eventdate = new Date(arguments[3] + ' ' + arguments[4]);
                        if (eventdate.toDateString() === "Invalid Date") {
                            bot.reply('Erreur : date/heure incompréhensible : ' + arguments[3] + ' ' + arguments[3] + '. Le format attendu est : AAAA/MM/JJ HH:MM');
                        }
                        else {
                            msglines.splice(0, 1);
                            let description = msglines.join('\n');
                            let title = arguments.slice(5).join(' ');
                            //event create function arguments: (database, section, datetime, author.discord_id, author.discord_tag, description-de-levent, title)
                            const dbanswer = await lsd_tools.event_create(db, arguments[2], eventdate, msg.message.author.id, msg.message.author.tag, description, title);
                            bot.reply(msg, dbanswer);
                        }
                    }
                    break;
                //if the first argument is 'delete', it will delete an existing event that must be given in the second argument
                case 'delete':
                case 'd':
                    if (!arguments[2]) { bot.reply(msg, 'Erreur : Veuillez indiquer un numéro d\'identifiant d\'event.'); }
                    else {
                        const danswer = await lsd_tools.event_delete(db, arguments[2], highest_rank, msg.message.author.tag);   // deletion of the event
                        bot.reply(msg, danswer);
                    }
                    break;
                //if the first argument is 'info', it will display information about the event given in second argument
                case 'info':
                case 'i':
                    if (!arguments[2]) {
                        bot.reply(msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event.');
                    }
                    else {
                        const ianswer = await lsd_tools.event_info(db, arguments[2]);
                        bot.reply(msg, ianswer);
                    }
                    break;
                // if the first argument is 'modify', il will check for an event id, and modify the description of the 
                case 'modify':
                case 'modifier':
                case 'modif':
                case 'm':
                    if (!arguments[2]) { bot.reply(msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event.'); }
                    else {
                        msglines.splice(0, 1);
                        let description = msglines.join('\n');
                        //event modify : changer la description d'un event
                        const ianswer = await lsd_tools.event_modify(db, arguments[2], msg.message.author.tag, description);
                        bot.reply(msg, ianswer);
                    }
                    break;
                //if the first argument is 'signup', it will add a Discord member to the participants list. The event must be given in second argument
                case 'signin':
                case 's':
                case '+1':
                    if (!arguments[2]) {
                        bot.reply(msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event pour vous y inscrire.');
                    }
                    else {
                        const sanswer = await lsd_tools.event_sign_in(db, arguments[2], msg.message.author.tag);
                        bot.reply(msg, sanswer);
                    }
                    break;

                //if the first argument is 'signout', it will remove a discord member to the participants list. The event must be given in second argument
                case 'signout':
                case 'so':
                case '-1':
                    if (!arguments[2]) {
                        bot.reply(msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event pour vous y désinscrire.');
                    }
                    else {
                        const sanswer = await lsd_tools.event_sign_out(db, arguments[2], msg.message.author.tag);
                        bot.reply(msg, sanswer);
                    }
                    break;

                //if the first argument is 'listall', it will display a list a future and past events
                case 'listall':
                case 'la':
                case 'all':
                    //  TBD : do something here
                    const laanswer = await lsd_tools.event_list(db, 'all');
                    bot.reply(msg, laanswer);
                    break;

                //if the first argument is 'list', it will display a list a future events
                case 'list':
                case 'l':
                    const lanswer = await lsd_tools.event_list(db, 'future-only');
                    bot.reply(msg, lanswer);
                    break;

                default:
                    // first argument cannot be recognized
                    event_msg_help(bot, msg, "option non reconnue");
            }
        }
    }
    else {
        bot.reply(msg, "Erreur : Vous devez être Scorpion pour utiliser cette commande.");
    }
}

function event_msg_help(bot, msg, explanation) {
    bot.reply(msg, "Erreur : " + explanation + ". Quelques exemples de gestion d'events :\n\
    **Créer un event pour la section JDM ** : `!event create JDM 2021/03/24 20:45 Titre` (puis ajoutez dans les lignes suivantes de votre message les détails de l'event)\n\
    **Modifier la description de l'event #15 ** : `!event modify 15` (puis ajoutez dans les lignes suivantes de votre message les détails de l'event)\n\
    **Voir une liste des events à venir** : `!event list`\n\
    **Voir une liste de tous les events** : `!event listall`\n\
    **Visualiser l'event #15** : `!event info 15`\n\
    **S'inscrire à l'event #15** : `!event signin 15`\n\
    **Se désinscrire de l'event #15** : `!event signout 15`\n\
    **Supprimer l'event #15 (vous devez être officier)** : `!event delete 15`\n\
    Raccourcis : 'create'='c', 'list'='l' , 'listall'='la', 'info'='i', 'signin'='s'='+1', 'signout'='so'='-1', 'delete'='d'");
}

/**
 * kill_list manager through the bot and a mysql table
 * each section can memorized a list of identified griefers or enemies.
 * @param {*} bot 
 * @param {*} msg 
 */
async function kill_list_msg(bot, msg) {
    const msglines = msg.message.content.split('\n');
    const arguments = msglines[0].trim().split(/ +/g);
    const member = await getMessageMember(msg);
    if (member && member.roles.cache.some(role => role.name === 'Scorpion')) {  // Only Scorpions can uses the kill list feature
        const highest_rank = member.roles.highest.name;
        if (!arguments[1]) { // if no argument was given, give help to the user to explain how things work
            kill_list_help(bot, msg, "commande incomplète");
        } else {
            if (!arguments[2]) {
                const kanswer = await lsd_tools.kill_list_view(db, arguments[1]);   // display the kill list
                bot.reply(msg, kanswer);
            } else {
                switch (arguments[2].toLowerCase()) {
                    case 'add':
                    case 'a':
                        if (highest_rank === "Officier" || highest_rank === "Conseiller" || highest_rank === "Admin") {  // Only Officers can add/remove names
                            if (!arguments[3] || msglines.length < 2) {
                                bot.reply(msg, "Erreur : Nom ou description manquante.");
                            } else {
                                msglines.splice(0, 1);
                                let description = msglines.join('\n');
                                const aanswer = await lsd_tools.kill_list_add(db, arguments[1], arguments[3], description);   // add a name to the list
                                bot.reply(msg, aanswer);
                            }
                        } else { bot.reply(msg, "Erreur : Vous devez être Officier pour modifier la kill_list."); }
                        break;
                    case 'remove':
                    case 'r':
                        if (highest_rank === "Officier" || highest_rank === "Conseiller" || highest_rank === "Admin") {  // Only Officers can add/remove names
                            const ranswer = await lsd_tools.kill_list_remove(db, arguments[1], arguments[3]);   // remove a name from the list
                            bot.reply(msg, ranswer);
                        } else { bot.reply(msg, "Erreur : Vous devez être Officier modifier la kill_list."); }
                        break;

                    default:
                        // first argument cannot be recognized
                        kill_list_help(bot, msg, "option non reconnue");
                }
            }
        }
    }
    else {
        bot.reply(msg, "Erreur : Vous devez être Scorpion pour utiliser cette commande.");
    }
}

function kill_list_help(bot, msg, explanation) {
    bot.reply(msg, "Erreur : " + explanation + ". Quelques exemples :\n\
    **Visualiser la kill list de la section SC** : `!kill_list SC`\n\
    **(officiers) ajouter le joueur psykokilla à la kill list de la section DU** : `!kill_list DU add psykokilla` (puis ajoutez dans les lignes suivantes de votre message une description de la personne, son orga, pourquoi elle se retrouve dans cette liste, etc...)\n\
    **(officiers) retirer le joueur psykokilla de la kill list de la section DU** : `!kill_list DU remove psykokilla`\n\
    Raccourcis : 'kill_list'='k', 'add'='a' , 'remove'='r'" );
}
