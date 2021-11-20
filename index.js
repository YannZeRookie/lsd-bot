// The Bot of Les Scorpions du Desert
// License: MIT
// https://www.scorpions-du-desert.com/

// Load general configuration settings
var config = require('./config.json');

// Load the LSD Bot
const LSDBot = require('./lsd-bot.js');
const bot = new LSDBot(config);

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
    console.log('Connected to MySQL database');
} else {
    console.log('Running in no database mode');
}

// TeamSpeak
var teamspeak = require('./teamspeak');

// Load the LSD tools (users, roles, and sections management)
var lsd_tools = require('./lsd-tools');
const { Message } = require('discord.js');

// Cron jobs, see https://www.npmjs.com/package/node-cron
// Format:
// Seconds(0-59) Minutes(0-59) Hours(0-23) Day_of_Month(1-31) Months(0-11 for Jan-Dec) Day_of_Week(0-6 for Sun-Sat)
if (!config.noCron) {
    const cron = require("node-cron");
    cron.schedule('0 45 17 * * *', async () => {
        try {
            // TODO: TEST !!!
            var guild = await bot.client.guilds.fetch(config.guild_id);
            lsd_tools.reviewInvites(db, bot.token, guild);
        }
        catch (e) {
            console.error('Error in reviewInvites cron: ' + e);
        }
    });
    cron.schedule('0 */5 * * * *', async () => {    // Review TeamSpeak Server Groups Roles every 5 minutes
        try {
            await teamspeak.reviewRoles(db);
        } catch (e) {
            console.error('Error in reviewRoles cron: ' + e);
        }
    });
}

/**
 * This is a basic test / demo
 */
bot.hears('hello', async (bot, msg) => {
    processCommand('hello', bot, msg);
});

/**
 * General listening entry point of commands
 */
bot.hears('^' + config.prefix + '.*', async (bot, msg) => {
    const words = msg.content.substring(1).split(' ');
    if (words.length) {
        processCommand(words[0], bot, msg);
    }
});

/**
 * Mentioning the Bot will make him react :-)
 */
bot.hears('.*', async (bot, msg) => {
    if (msg.mentions.has(bot.client.user)) {
        const member = await getMessageMember(msg);
        bot_reply(bot, msg, member.lsdName + " parle de moi, c'est sympa ! Pour avoir de l'aide, tape `" + config.prefix + "aide`");
    }
});

/**
 * It's OK to avoid the prefix when talking directly to the Bot
 */
bot.hears('.*', async (bot, msg) => {
    if (msg.channel.type === 'DM' && msg.content.charAt(0) != config.prefix) {
        const words = msg.content.split(' ');
        if (words.length) {
            processCommand(words[0], bot, msg);
        }
    }
});


/**
 * Welcome of new members: we send a private message
 */
bot.client.on('guildMemberAdd', (member) => {
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
});

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
/**
 * General command processing dispatcher
 * @param {string} command Command, without the prefix
 * @param {LSDBot} bot 
 * @param {Message} msg The original message
 */
async function processCommand(command, bot, msg) {
    switch (command.toLowerCase()) {
        case 'connexion':
        case 'connection':
        case 'connect':
        case 'login':
        case 'c':
            try {
                console.log('Connection request from ' + msg.author.username + ' (' + msg.author.id + ')');
                const key = lsd_tools.buildConnectionKey(db, msg.author);
                newMessage = await msg.author.send("Voici ton lien de connexion : " + buidLoginUrl(key));
                setTimeout(() => { // Delete the message after one hour because the key will be expired by then
                    newMessage.delete();
                }, 3600 * 1000);
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'inscription':
        case 'signup':
        case 'go':
            try {
                console.log('Inscription request from ' + msg.author.username + ' (' + msg.author.id + ')');
                const key = lsd_tools.buildConnectionKey(db, msg.author);
                newMessage = await msg.author.send("Voici ton lien pour t'inscrire : " + buidLoginUrl(key));
                setTimeout(() => { // Delete the message after one hour because the key will be expired by then
                    newMessage.delete();
                }, 3600 * 1000);
                if (msg.channel.type != 'DM') { // Deleting messages is not allowed in DM channels
                    setTimeout(() => { // Remove the message to avoid poluting the channel
                        msg.delete();
                    }, 4000);
                }
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
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
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'event':
        case 'events':
        case 'e':
            try {
                event_msg(bot, msg);
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'hello':
            // Here is the correct way of finding the right name of a message's author:
            bot_reply(bot, msg, 'Salut à toi ' + (msg.member.displayName ?? msg.author.username) + ' ! Pour avoir de l\'aide, tape `' + config.prefix + 'aide`');
            break;
        case 'kill_list':
        case 'k':
            try {
                kill_list_msg(bot, msg);
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
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
            /* test message for YannZeGrunt : 
            *  §i <@!404722937183076354>
            */
            try {
                const cur_member = await getMessageMember(msg);
                if (!cur_member) {
                    throw "Erreur : vous êtes inconnu du serveur";
                }
                var expiration = 7;     // Default delay is 7 days
                var r = msg.content.match(/\s+(\d+)\s*$/);
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
                        bot_reply(bot, msg, "Invitation réussie de " + (target_member.nickname ? target_member.nickname : target_member.displayName) + ` pour ${exp} jours`);
                        // Send a private message to the invited user, with explanations
                        target_member.send("Félicitations, tu as désormais le statut d'Invité sur le serveur des Scorpions du Désert ! \
        Ceci te permet de circuler et de communiquer sur tous les canaux ouverts aux invités de notre serveur Discord.\n\
        Attention, tu redeviendras automatiquement simple visiteur au bout de " + exp + " jours, après quoi \
        il faudra qu'un Scorpion t'invite de nouveau.\n\
        Nous espérons que ton passage chez nous te plaîra et, qui saît ?, te décidera à nous rejoindre.\n\
        Bon séjour parmi nous ! - Les Scorpions du Désert");
                    } catch (e) {
                        bot_reply(bot, msg, e.message ?? e);
                    }
                });
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
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
                            by_discord_id: msg.author.id,
                            by_discord_username: (cur_member.nickname ?? cur_member.displayName)
                        }, true);
                    }
                    catch (e) {
                        bot_reply(bot, msg, e.message ?? e);
                    }
                });
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'ts':  // TeamSpeak connection
            try {
                const cur_member = await getMessageMember(msg);
                if (cur_member) {
                    var is_invite = cur_member.roles.cache.some(role => { return role.name == 'Invité'; });
                    var is_scorpion = cur_member.roles.cache.some(role => { return role.name == 'Scorpion'; });
                    if (is_invite || is_scorpion) {
                        const tsLink = await teamspeak.getConnectionLink(db, cur_member);
                        newMessage = await msg.author.send("Lien vers TeamSpeak : " + tsLink);
                        setTimeout(() => { // Delete the message after one hour because the key will be expired by then
                            newMessage.delete();
                        }, 3600 * 1000);
                    } else {
                        await msg.author.send("Désolé, il faut être au moins de niveau Invité pour rejoindre notre serveur TeamSpeak.");
                    }
                    if (msg.channel.type != 'DM') { // Deleting messages is not allowed in DM channels
                        setTimeout(() => { // Remove the message to avoid poluting the channel
                            msg.delete();
                        }, 4000);
                    }
                }
            } catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'tsd': // TeamSpeak debug
            try {
                //const cur_member = await getMessageMember(msg);
                //const res = await teamspeak.TSDebug(db, cur_member);
                await teamspeak.reviewRoles(db);
                msg.author.send('reviewRoles: done');
            } catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;

        case 'review':
            // Review and purge invites (manual version of the cron-job, useful for debugging)
            try {
                if (!msg.guild) throw "Error: please run this command from a server channel";
                await lsd_tools.reviewInvites(db, bot.token, msg.guild);
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'test':
            // Test area - play here !
            try {
                if (!msg.guild) throw "Error: please un this command from a server channel";
                const guild = msg.guild;
                const role = await guild.roles.fetch('404693131573985280'); // Invité
                const members = role.members;
            }
            catch (e) {
                bot_reply(bot, msg, e.message ?? e);
            }
            break;
        case 'aide':
        case 'help':
        case 'sos':
        case 'a':
        case 'h':
            bot_reply(bot, msg, helpMessage());
            break;
        case 'raccourcis':
        case 'shortcuts':
        case 'short':
        case 'synomynmes':
        case 'r':
            bot_reply(bot, msg, sortcutsMessage());
            break;
        default:
            bot_reply(bot, msg, "Commande inconnue, tape `" + config.prefix + "aide` pour la liste des commandes disponibles");

    }
} //processCommand

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------

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
 * @param {LSDBot} bot 
 * @param {Message} msg original message
 */
function lance(bot, msg) {
    var r = msg.content.match(/lance\s+(\d+)/);
    if (r && r[1] && r[1] > 1) {
        if (r[1] <= 100000000) {
            var result = 1 + Math.floor(Math.random() * Math.floor(r[1]));
            bot_reply(bot, msg, 'OK, je lance un dé à ' + r[1] + ' faces ! Résultat : ' + result);
        }
        else {
            bot_reply(bot, msg, "Désolé, je suis limité à 100000000");
        }
    } else {
        bot_reply(bot, msg, "Désolé, je n'ai pas compris. Il me faut un nombre ≥ 2 après la commande");
    }
}

/**
 * Get the member of a message, even if the message was sent as a PM
 * @param {Message} msg
 * @returns {GuildMember}
 */
async function getMessageMember(msg) {
    let member = null;
    try {
        if (msg.member) {
            member = msg.member;
        } else {
            // Find it in the Guild
            const guild = await bot.client.guilds.fetch(config.guild_id);
            member = await guild.members.fetch(msg.author);
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
 * @param {LSDBot} bot 
 * @param {Message} msg 
 */
async function event_msg(bot, msg) {
    const msglines = msg.content.split('\n');
    const arguments = msglines[0].trim().split(/ +/g);
    const member = await getMessageMember(msg);
    const authorID = (msg.channel.type === 'DM') ? msg.author.tag : '';

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
                        bot_reply(bot, msg, 'Erreur : paramètres invalides ou description de l\'event manquante.\n\
Pour créer un event, indiquez sur la première ligne \'!event create\', suivit d\'une section(JDM, DU, etc...), d\'une date (AAAA/MM/JJ), d\'une heure (HH:MM)\
, d\'un titre, et finalement ajoutez le reste des informations concernant l\'event dans les lignes suivantes');
                    }
                    else {
                        let eventdate = new Date(arguments[3] + ' ' + arguments[4]);
                        if (eventdate.toDateString() === "Invalid Date") {
                            bot_reply('Erreur : date/heure incompréhensible : ' + arguments[3] + ' ' + arguments[3] + '. Le format attendu est : AAAA/MM/JJ HH:MM');
                        }
                        else {
                            msglines.splice(0, 1);
                            let description = msglines.join('\n');
                            let title = arguments.slice(5).join(' ');
                            //event create function arguments: (database, section, datetime, author.discord_id, author.discord_tag, description-de-levent, title)
                            const dbanswer = await lsd_tools.event_create(db, arguments[2], eventdate, msg.author.id, msg.author.tag, description, title);
                            bot_reply(bot, msg, dbanswer);
                        }
                    }
                    break;
                //if the first argument is 'delete', it will delete an existing event that must be given in the second argument
                case 'delete':
                case 'd':
                    if (!arguments[2]) { bot_reply(bot, msg, 'Erreur : Veuillez indiquer un numéro d\'identifiant d\'event.'); }
                    else {
                        const danswer = await lsd_tools.event_delete(db, arguments[2], highest_rank, msg.author.tag);   // deletion of the event
                        bot_reply(bot, msg, danswer);
                    }
                    break;
                //if the first argument is 'info', it will display information about the event given in second argument
                case 'info':
                case 'i':
                    if (!arguments[2]) {
                        bot_reply(bot, msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event.');
                    }
                    else {
                        const ianswer = await lsd_tools.event_info(db, arguments[2]);
                        bot_reply(bot, msg, ianswer);
                    }
                    break;
                // if the first argument is 'modify', il will check for an event id, and modify the description of the 
                case 'modify':
                case 'modifier':
                case 'modif':
                case 'm':
                    if (!arguments[2]) { bot_reply(bot, msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event.'); }
                    else {
                        msglines.splice(0, 1);
                        let description = msglines.join('\n');
                        //event modify : changer la description d'un event
                        const ianswer = await lsd_tools.event_modify(db, arguments[2], msg.author.tag, description);
                        bot_reply(bot, msg, ianswer);
                    }
                    break;
                //if the first argument is 'signup', it will add a Discord member to the participants list. The event must be given in second argument
                case 'signin':
                case 's':
                case '+1':
                    if (!arguments[2]) { bot_reply(bot, msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event pour vous y inscrire.'); }
                    else {
                        const sanswer = await lsd_tools.event_sign_in(db, arguments[2], msg.author.tag);
                        bot_reply(bot, msg, sanswer);
                    }
                    break;

                //if the first argument is 'signout', it will remove a discord member to the participants list. The event must be given in second argument
                case 'signout':
                case 'so':
                case '-1':
                    if (!arguments[2]) { bot_reply(bot, msg, 'Erreur : veuillez indiquer un numéro d\'identifiant d\'event pour vous y désinscrire.'); }
                    else {
                        const sanswer = await lsd_tools.event_sign_out(db, arguments[2], msg.author.tag);
                        bot_reply(bot, msg, sanswer);
                    }
                    break;

                //if the first argument is 'list', it will display a list a future events
                case 'list':
                case 'l':
                    const lanswer = await lsd_tools.event_list(db, 'future-only', authorID);
                    bot_reply(bot, msg, lanswer);
                    break;

                //if the first argument is 'listall', it will display a list a future and past events
                case 'listall':
                case 'la':
                case 'all':
                    const laanswer = await lsd_tools.event_list(db, 'all', authorID);
                    bot_reply(bot, msg, laanswer);
                    break;

                //if the first argument is 'list', it will display a list a future events
                case 'list15days':
                case 'l15':
                    const lcanswer = await lsd_tools.event_list(db, '15-days', authorID);
                    bot_reply(bot, msg, lcanswer);
                    break;

                default:
                    // first argument cannot be recognized
                    event_msg_help(bot, msg, "option non reconnue");
            }
        }
    }
    else {
        bot_reply(bot, msg, "Erreur : Vous devez être Scorpion pour utiliser cette commande.");
    }
}

function event_msg_help(bot, msg, explanation) {
    bot_reply(bot, msg, "Erreur : " + explanation + ". Quelques exemples de gestion d'events :\n\
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
 * @param {LSDBot} bot 
 * @param {Message} msg 
 */
async function kill_list_msg(bot, msg) {
    const msglines = msg.content.split('\n');
    const arguments = msglines[0].trim().split(/ +/g);
    const member = await getMessageMember(msg);
    if (member && member.roles.cache.some(role => role.name === 'Scorpion')) {  // Only Scorpions can uses the kill list feature
        const highest_rank = member.roles.highest.name;
        if (!arguments[1]) { // if no argument was given, give help to the user to explain how things work
            kill_list_help(bot, msg, "commande incomplète");
        } else {
            if (!arguments[2]) {
                const kanswer = await lsd_tools.kill_list_view(db, arguments[1]);   // display the kill list
                bot_reply(bot, msg, kanswer);
            } else {
                switch (arguments[2].toLowerCase()) {
                    case 'add':
                    case 'a':
                        if (highest_rank === "Officier" || highest_rank === "Conseiller" || highest_rank === "Admin") {  // Only Officers can add/remove names
                            if (!arguments[3] || msglines.length < 2) {
                                bot_reply(bot, msg, "Erreur : Nom ou description manquante.");
                            } else {
                                msglines.splice(0, 1);
                                let description = msglines.join('\n');
                                const aanswer = await lsd_tools.kill_list_add(db, arguments[1], arguments[3], description);   // add a name to the list
                                bot_reply(bot, msg, aanswer);
                            }
                        } else { bot_reply(bot, msg, "Erreur : Vous devez être Officier pour modifier la kill_list."); }
                        break;
                    case 'remove':
                    case 'r':
                        if (highest_rank === "Officier" || highest_rank === "Conseiller" || highest_rank === "Admin") {  // Only Officers can add/remove names
                            const ranswer = await lsd_tools.kill_list_remove(db, arguments[1], arguments[3]);   // remove a name from the list
                            bot_reply(bot, msg, ranswer);
                        } else { bot_reply(bot, msg, "Erreur : Vous devez être Officier modifier la kill_list."); }
                        break;

                    default:
                        // first argument cannot be recognized
                        kill_list_help(bot, msg, "option non reconnue");
                }
            }
        }
    }
    else {
        bot_reply(bot, msg, "Erreur : Vous devez être Scorpion pour utiliser cette commande.");
    }
}

function kill_list_help(bot, msg, explanation) {
    bot_reply(bot, msg, "Erreur : " + explanation + ". Quelques exemples :\n\
    **Visualiser la kill list de la section SC** : `!kill_list SC`\n\
    **(officiers) ajouter le joueur psykokilla à la kill list de la section DU** : `!kill_list DU add psykokilla` (puis ajoutez dans les lignes suivantes de votre message une description de la personne, son orga, pourquoi elle se retrouve dans cette liste, etc...)\n\
    **(officiers) retirer le joueur psykokilla de la kill list de la section DU** : `!kill_list DU remove psykokilla`\n\
    Raccourcis : 'kill_list'='k', 'add'='a' , 'remove'='r'" );
}


/**
 * makes sure the string given for a bot reply is not to long for discord (2000 characters limatation).
 * if it is, the string is splitted and sent into multiple replies. Splitting occurs only at newlines.
 * @param {LSDBot} bot
 * @param {object} msg 
 * @param {string} reply_string 
 */
function bot_reply(bot, msg, reply_string) {
    var lines = reply_string.split(/\r?\n/);
    var replies = [''];
    var i = 0
    lines.forEach(function (elem) {
        if (elem.length + replies[i].length < 2000) { replies[i] += elem + '\n'; }
        else {
            replies.push('(...)\n');
            i += 1;
            replies[i] += elem + '\n';
        }
    });
    //send the replies
    replies.forEach(function (elem) { bot.reply(msg, elem); });
}
