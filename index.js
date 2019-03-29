const BotkitDiscord = require('botkit-discord');
var util = require('util');
var crypto = require("crypto");

// Load general configuration settings
var config = require('./config.json');

// Load Discord connection token
var discordConfig = require('./auth.json');
var discordBot = BotkitDiscord(discordConfig);

// MySQL
var mysql      = require('mysql');
var mysqlConfig = require('./db.json');
var db = mysql.createConnection(mysqlConfig);
db.connect(function(err) {
    if (err) {
        console.log('Could not connect to database');
        throw err;
    }
});

function buildConnectionKey(user)
{
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

db.query("SELECT * FROM lsd_section ORDER BY archived,`order`", function(err, results, fields) {
    if (err) throw err;
    results.forEach(row => {
        console.log('tag=' + row.tag + ' name=' + row.name);
    });
});

discordBot.hears('!connexion','ambient',(bot, message) => {
    var key = buildConnectionKey(message.author);
    bot.send({
        text: "Voici votre lien de connexion : " + buidLoginUrl(key),
    	to: message.author.id
    });
    bot.reply(message, 'Je vous ai transmis un lien de connexion par message privé dans Discord');
    console.log('Connection request from ' + message.author.username + ' (' + message.author.id + ')');
});
 

discordBot.hears('hello','ambient',(bot, message) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(message));
    bot.reply(message, 'Received a `h e l l o` ambient from ' + message.author.username);
    console.log('Replied to hello from ' + message.author.username+ ' msg: ' + message.text);
    console.log("\n");
});
 
discordBot.hears('.*', 'direct_message', (bot, message) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(message));
    bot.reply(message, 'Received a direct_message from ' + message.author.username);
    console.log('Received a direct_message by ' + message.author.username);
    console.log("\n");
});

discordBot.hears('.*', 'direct_mention', (bot, message) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(message));
    bot.reply(message, 'Received a direct_mention from ' + message.author.username);
    /*
    bot.send({
    	text: "You're talking to me?",
    	to: message.author.id
    });
    */
    console.log('Was direct_mention by ' + message.author.username);
    console.log("\n");
});

discordBot.hears('.*', 'mention', (bot, message) => {
	//console.log(util.inspect(bot));
	//console.log(util.inspect(message));
    bot.reply(message, 'Received a mention from ' + message.author.username);
    console.log('Was mentioned by ' + message.author.username);
    console.log("\n");
});

discordBot.hears('!lance .+', 'ambient', (bot, message) => {
    //console.log(util.inspect(bot));
    //console.log(util.inspect(message));
    var r = message.message.match(/lance\s+(\d+)/);
    if (r && r[1] && r[1]>1) {
        if (r[1]<=100000000) {
            var result = 1 + Math.floor(Math.random() * Math.floor(r[1]));
            bot.reply(message, 'OK, je lance un dé à ' + r[1] + ' faces ! Résultat : ' + result);
            console.log(message.author.username + ' threw a dice! faces=' + r[1] + ' result=' + result);
        }
        else {
            bot.reply(message, "Désolé, je suis limité à 100000000");
        }
    } else if (message.message.match(/lance\s+.*Totor0/i)) {
        bot.reply(message, "Désolé, je ne pratique pas le lancer de nains !");
    } else {
        bot.reply(message, "Désolé, je n'ai pas compris. Il me faut un nombre ≥ 2 après la commande");
    }
});


discordBot.on('ready', (bot, event) => {
    bot.log('Ready!');
});

discordBot.on('disconnect', (bot, event) => {
    db.end()
    bot.log('Good-bye!');
});
