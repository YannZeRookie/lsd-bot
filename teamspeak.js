/**
 * TeamSpeak Tools
 * 
 * Package: https://www.npmjs.com/package/ts3-nodejs-library
 * Documentation: https://multivit4min.github.io/TS3-NodeJS-Library/
 */

const ts_lib = require('ts3-nodejs-library');

// Load TS configuration settings
const ts_config = require('./teamspeak.json');

/*
const me = await teamspeak.whoami();
console.log(me);
*/

/*
console.log('TeamSpeak: channels:');
const channels = await teamspeak.channelList();
channels.forEach(channel => {
    console.log(channel);
});
*/

/*
console.log('TeamSpeak: server groups:');
const groups = await teamspeak.serverGroupList();
groups.forEach(group => {
    console.log(group);
});
*/

/*
await teamspeak.sendTextMessage("14132392", 2, "LSD-Bot connecté");
*/

//-- Client sent text message
/*
teamspeak.on("textmessage", async (event) => {
    try {
        console.log(`TeamSpeak: ${event.invoker.nickname} just send the message "${event.msg}"`)
    } catch (error) {
        console.error("TeamSpeak: textmessage Error: " + error);
    }
});
*/

/*
ts_lib.TeamSpeak.connect(ts_config).then(async teamspeak => {
  const clients = await teamspeak.clientList({ clientType: 0 })
  clients.forEach(client => {
      console.log("Client: ", client.nickname)
  })
}).catch(e => {
  console.error(e)
})
*/

async function getConnectionLink(roles, target) {
    var result = '';
    try {
        await ts_lib.TeamSpeak.connect(ts_config).then(async teamspeak => {
            console.log("TeamSpeak: LSD-Bot connected to TeamSpeak server");
            try {
                var sgid = '4363725';   // Visiteur server group id is the default one
                if (roles.some(role => role.name === 'Conseiller')) {
                    sgid = '4365577';
                } else if (roles.some(role => role.name === 'Officier')) {
                    sgid = '4365576';
                } else if (roles.some(role => role.name === 'Scorpion')) {
                    sgid = '4363724';
                } else if (roles.some(role => role.name === 'Invité')) {
                    sgid = '4366078';
                }
                const key = await teamspeak.privilegeKeyAdd(0, sgid, undefined, 'Clé pour ' + target, '');
                token = key.token;
                console.log('TeamSpeak: Generated token ' + token + ' for ' + target);
                if (token) {
                    result = 'ts3server://' + ts_config.host + '?port=' + ts_config.serverport + '&token=' + token + '&password=iaMNY5JiDU23duku' + '&nickname=' + encodeURIComponent(target);
                }
                await teamspeak.logout();
                console.log("TeamSpeak: LSD-Bot disconnected from TeamSpeak server");
            } catch (error) {
                console.error("TeamSpeak: getConnectionLink: " + error);
            }
        }).catch(e => {
            console.error("TeamSpeak: connection error: " + e);
        });
    } catch (ee) {
        console.error("TeamSpeak: init error: " + ee);
    }
    return result;
}


exports.getConnectionLink = getConnectionLink;
