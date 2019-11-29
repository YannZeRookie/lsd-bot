const BotkitDiscord = require('botkit-discord');
var util = require('util');
var crypto = require("crypto");

// Load general configuration settings
var config = require('./config.json');

// Load Discord connection token
var discordConfig = require('./auth.json');
var discordBot = BotkitDiscord(discordConfig);

// MySQL
var mysqlConfig = require('./db.json');
var mysql = null;
var db = null;
if (mysqlConfig.host) {
    mysql = require('mysql');
    db = mysql.createConnection(mysqlConfig);

    // MySQL connexion
    db.connect(function(err) {
        if (err) {
            console.log('Could not connect to database');
            throw err;
        }
    });
} else {
    console.log('Running in no database mode');
}


/**
 * General listening entry point
 */
discordBot.hears('^' + config.prefix + '.*','ambient',(bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var words = msg.message.content.substring(1).split(' ');
    if (words.length) {
        processCommand(words[0], 'ambient', bot, msg);
    }
});

discordBot.hears('hello','ambient',(bot, msg) => {
	//console.log(util.inspect(bot));
    //console.log(util.inspect(msg));
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
 * Direct mention = mentionning the Bot during a private message to the Bot
 */
discordBot.hears('.*', 'direct_mention', (bot, msg) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    //bot.reply(msg.message, 'Received a direct_mention from ' + msg.message.author.username);
    bot.reply(msg, "Salut " + msg.message.author.username + ", si tu as besoin d'aide, tape `"+config.prefix+"aide`");
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
    bot.reply(msg, msg.message.author.username + " parle de moi, c'est sympa ! Pour avoir de l'aide, tape `"+config.prefix+"aide`");
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
est très simple et se fait à l'aide de notre Bot. Il te suffit de taper `"+config.prefix+"inscription` dans un canal, et notre \
Bot t'enverra un lien de connexion qui t'emmènera sur notre site de gestion de comptes, où tu pourras poser ta \
candidature. Pour en savoir plus sur notre Bot, tape `"+config.prefix+"aide`\n\
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
function processCommand(command, context, bot, msg)
{
    switch(command) {
        case 'connexion':
        case 'connection':
        case 'connect':
        case 'login':
            var key = buildConnectionKey(msg.message.author);
            msg.message.author.send("Voici ton lien de connexion : " + buidLoginUrl(key));
            console.log('Connection request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
            if (context == 'ambient') {
                msg.message.delete(4000);   // Remove the message to avoid poluting the channel
            }
            break;
        case 'inscription':
        case 'signup':
            var key = buildConnectionKey(msg.message.author);
            msg.message.author.send("Voici ton lien pour t'inscrire : " + buidLoginUrl(key));
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
        case 'help':
        case 'aide':
        case 'sos':
            bot.reply(msg, helpMessage());
            break;
        default:
            bot.reply(msg, "Commande inconnue, tape `"+config.prefix+"aide` pour la liste des commandes disponibles");

    }
}

function buildConnectionKey(user)
{
    if (!db) {
        return '';
    }
    key = crypto.randomBytes(20).toString('hex');
    //-- Insert the key in the database for later retrieval from the website
    //   including its username, discriminator and avatar
    db.query("INSERT INTO lsd_login SET login_key=?, created_on=unix_timestamp(), discord_id=?, discord_username=?, discord_discriminator=?, discord_avatar=?", 
            [key, user.id, user.username, user.discriminator, user.avatar], 
            function(err, results, fields) {
        if (err) throw err;
        console.log('Created key=' + key + ' for user_id=' + user.id);
    });
    //-- Done
    return key;
}

function buidLoginUrl(key)
{
    return config.connection_url + '/' + key;
}

/**
 * Return help message
 */
function helpMessage()
{
    return "Bonjour, je suis le Bot des Scorpions du Désert. Les commandes commencent par `"+config.prefix+"`\nVoici la liste : \n\
      ```\n\
"+config.prefix+"inscription          Poste ta candidature pour devenir un ou une LSD !\n\
"+config.prefix+"connexion            Connecte-toi sur le site de gestion de ton compte LSD\n\
"+config.prefix+"aide, "+config.prefix+"help, "+config.prefix+"sos    Obtenir cette aide\n\
"+config.prefix+"lance nombre         Lance un dé entre 1 et 'nombre'. Par exemple pour un dé à 6 faces : "+config.prefix+"lance 6\n\
      ```";
}

/**
 * Random dice generator
 * @param {*} bot 
 * @param {*} msg 
 */
function lance(bot, msg)
{
    var r = msg.message.content.match(/lance\s+(\d+)/);
    if (r && r[1] && r[1]>1) {
        if (r[1]<=100000000) {
            var result = 1 + Math.floor(Math.random() * Math.floor(r[1]));
            bot.reply(msg.message, 'OK, je lance un dé à ' + r[1] + ' faces ! Résultat : ' + result);
        }
        else {
            bot.reply(msg.message, "Désolé, je suis limité à 100000000");
        }
    } else if (msg.message.content.match(/lance\s+.*Totor0/i)) {
        bot.reply(msg.message, "Désolé, je ne pratique pas le lancer de nains !");
    } else {
        bot.reply(msg.message, "Désolé, je n'ai pas compris. Il me faut un nombre ≥ 2 après la commande");
    }
}
