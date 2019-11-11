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
 * Return help message
 */
function helpMessage()
{
    return "Bonjour, je suis le Bot des Scorpions du Désert. Les commandes commencent par `!`\nVoici la liste : \n\
      ```\n\
!inscription          Poste ta candidature pour devenir un ou une LSD !\n\
!connexion            Connecte-toi sur le site de gestion de ton compte LSD\n\
!aide, !help, !sos    Obtenir cette aide\n\
!lance nombre         Lance un dé entre 1 et 'nombre'. Par exemple pour un dé à 6 faces : !lance 6\n\
      ```";
}

discordBot.hears('^!connexion','ambient',(bot, msg) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var key = buildConnectionKey(msg.message.author);
    msg.message.author.send("Voici ton lien de connexion : " + buidLoginUrl(key));
    //bot.reply(msg, 'Je vous ai transmis un lien de connexion par message privé dans Discord');
    console.log('Connection request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
});

discordBot.hears('^!inscription','ambient',(bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var key = buildConnectionKey(msg.message.author);
    msg.message.author.send("Voici ton lien pour t'inscrire : " + buidLoginUrl(key));
    console.log('Inscription request from ' + msg.message.author.username + ' (' + msg.message.author.id + ')');
});

discordBot.hears('hello','ambient',(bot, msg) => {
	//console.log(util.inspect(bot));
    //console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg, 'Salut à toi ' + msg.message.author.username + ' ! Pour avoir de l\'aide, tape `!aide`');
    //console.log('Replied to hello from ' + msg.message.author.username+ ' msg: ' + msg.message.content);
    //console.log("\n");
});

discordBot.hears('.*', 'direct_message', (bot, msg) => {
	//console.log(util.inspect(bot));
    //console.log(util.inspect(message));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg.message, helpMessage());
    //console.log('Received a direct_message from ' + msg.message.author.username);
    //console.log("\n");    
});

discordBot.hears('.*', 'direct_mention', (bot, msg) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    //bot.reply(msg.message, 'Received a direct_mention from ' + msg.message.author.username);
    bot.reply(msg, "Salut " + msg.message.author.username + ", si tu as besoin d'aide, tape `!aide`");
    /*
    bot.send({
    	text: "You're talking to me?",
    	to: msg.message.author.id
    });
    */
    //console.log('Was direct_mention by ' + msg.message.author.username);
    //console.log("\n");
});

discordBot.hears('.*', 'mention', (bot, msg) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    //bot.reply(msg.message, 'Received a mention from ' + msg.message.author.username);
    bot.reply(msg, msg.message.author.username + " parle de moi, c'est sympa ! Pour avoir de l'aide, tape `!aide`");
    //console.log('Was mentioned by ' + msg.message.author.username);
    //console.log("\n");
});

discordBot.hears('^!aide', 'ambient', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg, helpMessage());
});

discordBot.hears('^!sos', 'ambient', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg, helpMessage());
});

discordBot.hears('^!help', 'ambient', (bot, msg) => {
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    bot.reply(msg, helpMessage());
});


discordBot.hears('^!lance .+', 'ambient', (bot, msg) => {
    //console.log(util.inspect(bot));
    //console.log(util.inspect(msg));
    if (msg.message.author.id == discordConfig.client.user.id) return; // Don't answer to ourselves
    var r = msg.message.content.match(/lance\s+(\d+)/);
    if (r && r[1] && r[1]>1) {
        if (r[1]<=100000000) {
            var result = 1 + Math.floor(Math.random() * Math.floor(r[1]));
            bot.reply(msg.message, 'OK, je lance un dé à ' + r[1] + ' faces ! Résultat : ' + result);
            //console.log(msg.message.author.username + ' threw a dice! faces=' + r[1] + ' result=' + result);
        }
        else {
            bot.reply(msg.message, "Désolé, je suis limité à 100000000");
        }
    } else if (msg.message.content.match(/lance\s+.*Totor0/i)) {
        bot.reply(msg.message, "Désolé, je ne pratique pas le lancer de nains !");
    } else {
        bot.reply(msg.message, "Désolé, je n'ai pas compris. Il me faut un nombre ≥ 2 après la commande");
    }
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