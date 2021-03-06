/**
 * TeamSpeak Tools
 * 
 * Package: https://www.npmjs.com/package/ts3-nodejs-library
 * Documentation: https://multivit4min.github.io/TS3-NodeJS-Library/
 */

const ts_lib = require('ts3-nodejs-library');
var isConnected = false;


// Load TS configuration settings
const ts_config = require('./teamspeak.json');

// Connect
const teamspeak = new ts_lib.TeamSpeak(ts_config);

teamspeak.on("ready", async () => {
    try {
        //-- Connection
        console.log("TeamSpeak: LSD-Bot Connected to TeamSpeak server");
        //-- One-time initialization

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
        isConnected = true;
    } catch (error) {
        console.error("TeamSpeak: ready Error: " + error);
    }
});

//-- Disconnected: try to reconnect
teamspeak.on("close", async () => {
    try {
        isConnected = false;
        console.log("TeamSpeak: LSD-Bot disconnected")
        //await teamspeak.reconnect(-1, 1000);
        //console.log("TeamSpeak: LSD-Bot reconnected!")
    } catch (error) {
        console.error("TeamSpeak: close Error: " + error);
    }
});

//-- Teamspeak had an error
teamspeak.on("error", async (e) => {
    try {
        console.error("TeamSpeak: Error: " + e);
    } catch (error) {
        console.error("TeamSpeak: Error: " + error);
    }
});

//-- Client connected
teamspeak.on("clientconnect", async (event) => {
    try {
        const client = event.client;
        console.log("TeamSpeak: Client connected: " + event);
    } catch (error) {
        console.error("TeamSpeak: clientconnect Error: " + error);
    }
});

//-- Client sent text message
teamspeak.on("textmessage", async (event) => {
    try {
        /*
        console.log(`TeamSpeak: ${event.invoker.nickname} just send the message "${event.msg}"`)
        */
    } catch (error) {
        console.error("TeamSpeak: textmessage Error: " + error);
    }
});


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
    try {
        if (!isConnected) {
            await teamspeak.reconnect(1, 1000);
        }
    } catch (error) {
        console.error(error);
    }
    var token = '';
    try {
        var sgid = '4363725';   // Invité server group id is default
        if (roles.some(role => role.name === 'Conseiller')) {
            sgid = '4365577';
        } else if (roles.some(role => role.name === 'Officier')) {
            sgid = '4365576';
        } else if (roles.some(role => role.name === 'Scorpion')) {
            sgid = '4363724';
        }

        const key = await teamspeak.privilegeKeyAdd(0, sgid, undefined, 'Clé pour ' + target, '');
        token = key.token;
        console.log('Generated token ' + token + ' for ' + target);
    } catch (error) {
        console.error(error);
    }
    if (token) {
        return 'ts3server://' + ts_config.host + '?port=' + ts_config.serverport + '&token=' + token;
    }
    else {
        return 'ts3server://' + ts_config.host + '?port=' + ts_config.serverport;
    }
}


exports.getConnectionLink = getConnectionLink;
