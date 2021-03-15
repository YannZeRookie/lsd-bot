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

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}


/**
 * 
 * @param {Database} db 
 * @param {GuildMember} target 
 * @returns String link
 */
async function getConnectionLink(db, target) {
    var result = '';
    try {
        await ts_lib.TeamSpeak.connect(ts_config).then(async teamspeak => {
            console.log("TeamSpeak: LSD-Bot connected to TeamSpeak server");
            const roles = target.roles.cache;
            try {
                // TODO: if would be safer to rely on the roles in the database rather than on the Discord roles
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
                //-- Create token key
                // Store Discord id (and user id if any) in the key "custom set". This will allow to relate the use to Discord and the LSD database
                // Custom set have this format: ident=ident1 value=value1|ident=ident2 value=value2|ident=ident3 value=value3
                var customSet = 'ident=discord_id value=' + target.id;
                const db_user = await db.query("SELECT id FROM lsd_users WHERE discord_id=? ", [target.id]);
                if (db_user[0].length) {
                    customSet += '|ident=user_id value=' + db_user[0][0].id;
                }
                // Now we can create the key
                const key = await teamspeak.privilegeKeyAdd(0, sgid, undefined, 'Clé pour ' + target.lsdName, customSet);
                token = key.token;
                console.log('TeamSpeak: Generated token ' + token + ' for ' + target.lsdName);
                if (token) {
                    result = 'ts3server://' + ts_config.host + '?port=' + ts_config.serverport + '&token=' + token + '&password=iaMNY5JiDU23duku' + '&nickname=' + encodeURIComponent(target.lsdName) + '&addbookmark=LSD';
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

/**
 * Review TeamSpeak Server Groups and update (if needed) from LSD database roles
 * @param {Database} db 
 */
async function reviewRoles(db) {
    try {
        await ts_lib.TeamSpeak.connect(ts_config).then(async teamspeak => {
            console.log("TeamSpeak: reviewRoles: connected");
            /*
            teamspeak.on("flooding", (ev) => {
                console.log("Flooding!");
                console.log(ev);
            });

            teamspeak.on("debug", ev => {
                console.log("Debug!");
                console.log(ev);
            });
            */

            try {
                const clients = await teamspeak.clientList();
                console.log("TeamSpeak: reviewRoles: clients connected: " + clients.length);

                for (let index = 0; index < clients.length; index++) {
                    const client = clients[index];
                    try {
                        const infos = await client.customInfo();
                        /*
                        (2) [{…}, {…}]
                        0: {cldbid: '51875828', ident: 'discord_id', value: '407273313484931073'}
                        1: {cldbid: '51875828', ident: 'user_id', value: '14'}
                        length: 2
                        */
                        var discord_id = "";
                        var user_id = "";
                        infos.forEach(info => {
                            if (info.ident == "discord_id") {
                                discord_id = info.value;
                            }
                            if (info.ident == "user_id") {
                                user_id = info.value;
                            }
                        });
                        await verifyServerGroups(db, client, discord_id, user_id);
                        await sleep(1000);  // Let the server rest for a while to avoid flooding
                    } catch (error) {
                    }
                }

                //-- Done
                await teamspeak.logout();
                console.log("TeamSpeak: reviewRoles: disconnected");
            } catch (error) {
                console.error("TeamSpeak: reviewRoles: error: " + error);
                teamspeak.logout();
                console.log("TeamSpeak: reviewRoles: disconnected2");
            }
        }).catch(e => {
            console.error("TeamSpeak: reviewRoles: connection error: " + e);
        });
    } catch (ee) {
        console.error("TeamSpeak: reviewRoles: init error: " + ee);
    }
}

/**
 * Verify and update (if nedded) the Server Groups for this TS client
 * 
 * TODO: this code assigns only a SINGLE Server Group to a user (the "best one").
 * This is not really the philosophy of the LSD database nor of Discord.
 * We should use a mapping instead.
 * 
 * @param {Database} db 
 * @param {TeamSpeakClient} client 
 * @param {string} discord_id 
 * @param {string} user_id 
 */
async function verifyServerGroups(db, client, discord_id, user_id) {
    if (user_id == '') {
        //-- Get the User ID using his Discord ID
        const db_user_res = await db.query("SELECT id FROM lsd_users WHERE discord_id=? ", [discord_id]);
        if (db_user_res[0].length) {
            user_id = db_user_res[0][0].id;
        }
    }

    var bestLSDRole = '';
    if (user_id) {
        const db_user_res = await db.query("SELECT * FROM lsd_roles WHERE user_id=? ", [user_id]);
        bestLSDRole = findBestLSDRole(db_user_res[0]);
    } else if (discord_id) {
        //-- So maybe the user is an Invité? Look in the lsd_invitations table
        const db_invitation_res = await db.query("SELECT * FROM lsd_invitations WHERE discord_id=? ", [discord_id]);
        bestLSDRole = (db_invitation_res[0].length) ? 'invite' : 'visiteur';
    }

    if (bestLSDRole && bestLSDRole != 'admin') {    // Too dangerous to manage admin automatically
        const sgid = LSDRoleToTSGroup(bestLSDRole);
        if (sgid && !client.servergroups.some(el => el == sgid)) {
            try {
                console.log("TeamSpeak: verifyServerGroups: updating Server Groups for " + client.nickname);
                await client.delGroups(client.servergroups);
                await client.addGroups(sgid);
            } catch (error) {
                console.error("TeamSpeak: error: verifyServerGroups: " + error);
            }
        }
    }
}

/**
 * Find the most appropriate role
 * @param {*} lsd_roles 
 * @returns The most appropriate role
 */
function findBestLSDRole(lsd_roles) {
    //-- Admin ?
    if (lsd_roles.some(role => role.role == 'admin')) {
        return 'admin';
    }
    //-- Conseiller ?
    if (lsd_roles.some(role => role.role == 'conseiller')) {
        return 'conseiller';
    }
    //-- Officier ?
    if (lsd_roles.some(role => role.role == 'officier')) {
        return 'officier';
    }
    //-- Scorpion ?
    if (lsd_roles.some(role => role.role == 'scorpion')) {
        return 'scorpion';
    }
    //-- Invité ?
    if (lsd_roles.some(role => role.role == 'invite')) {
        return 'invite';
    }
    //-- Nothing interesting found
    return '';
}

/**
 * Convert a LSD database role into the corresponding TS Server Group ID
 * @param {string} lsd_role 
 * @returns 
 */
function LSDRoleToTSGroup(lsd_role) {
    switch (lsd_role) {
        case 'admin': return '4363723';
        case 'conseiller': return '4365577';
        case 'officier': return '4365576';
        case 'scorpion': return '4363724';
        case 'invite': return '4366078';
    }
    return '4363725';   // Visiteur is the default
}

/**
 * 
 * @param {Database} db 
 * @param {GuildMember} target 
 * @returns String message
 */
async function TSDebug(db, target) {
    var result = 'TSDebug: ';
    try {
        await ts_lib.TeamSpeak.connect(ts_config).then(async teamspeak => {
            console.log("TeamSpeak: TSDebug: connected");

            teamspeak.on("flooding", (ev) => {
                console.log("Flooding!");
                console.log(ev);
            });

            teamspeak.on("debug", ev => {
                console.log("Debug!");
                console.log(ev);
            });

            try {
                const clients = await teamspeak.clientList();
                console.log("Clients connected: " + clients.length);

                for (let index = 0; index < clients.length; index++) {
                    const client = clients[index];
                    try {

                        // DO IT


                        await sleep(1000);  // Let the server rest for a while to avoid flooding
                    } catch (error) {
                    }
                }

                //-- Done
                await teamspeak.logout();
                console.log("TeamSpeak: TSDebug: disconnected");
            } catch (error) {
                console.error("TeamSpeak: TSDebug: error: " + error);
                teamspeak.logout();
                console.log("TeamSpeak: TSDebug: disconnected2");
            }
        }).catch(e => {
            console.error("TeamSpeak: TSDebug: connection error: " + e);
        });
    } catch (ee) {
        console.error("TeamSpeak: TSDebug: init error: " + ee);
    }
    return result;
}


//-- Snipets dumpfill -----------------------------------------------------------------------------------------

/* MAKE  A CUSTOM SEARCH
//const ident = 'discord_id';
//const id = '407273313484931073';
//const ident = 'user_id';
//const id = '14';
const ident = 'discord_id';
const id = target.id;
await teamspeak.customSearch(ident, id).then(res => {
    result += res.value;
    console.log('TeamSpeak: TSDebug: ' + result);
}).catch(ee => {
    console.log("TeamSpeak: TSDebug: nothing found: " + ee);
    result += 'Nothing found';
});
*/


/* GET ALL DATABASE CLIENTS */
/*
const dbclients = await teamspeak.clientDbList();
console.log("Nb clients=" + dbclients.length);
 
for (let index = 0; index < dbclients.length; index++) {
    const cldbid = dbclients[index].cldbid;
    const cl = await teamspeak.getClientByDbid(cldbid);
    console.log(cldbid + ": " + (cl != undefined ? cl.cid : "undefined"));
    //await sleep(750);
}
 
*/
/* array of:
    cldbid
    clientCreated
    clientDescription
    clientLastconnected
    clientLastip
    clientLoginName
    clientNickname
    clientTotalconnections
    clientUniqueIdentifier
    count
 
    count: 11,
    cldbid: "51829115",
    clientUniqueIdentifier: "1oUGkvMHr8cJv2VfrWQl3vCHpTk=",
    clientNickname: "[LSD] YannZeRookie",
    clientCreated: 1614704810,
    clientLastconnected: 1615297899,
    clientTotalconnections: 28,
    clientDescription: undefined,
    clientLastip: "86.246.159.252",
 
    count: 11,
    cldbid: "51868170",
    clientUniqueIdentifier: "7fMPEM30ti7SDbxdkYBJG3jbgYo=",
    clientNickname: "Golgho",
    clientCreated: 1615148301,
    clientLastconnected: 1615310175,
    clientTotalconnections: 2,
    clientDescription: undefined,
    clientLastip: "91.168.156.97",
 
    count: 11,
    cldbid: "51859932",
    clientUniqueIdentifier: "oFDpuVOYOcysCIHtgSc2GHeNpCg=",
    clientNickname: "=LSD= Incal",
    clientCreated: 1615058290,
    clientLastconnected: 1615317753,
    clientTotalconnections: 3,
    clientDescription: undefined,
    clientLastip: "109.10.129.235",
 
    count: 11,
    cldbid: "51875828",
    clientUniqueIdentifier: "4zwEatnVuRX1DPfU8vs1HF4NOiU=",
    clientNickname: "YannZeScorpion",
    clientCreated: 1615298266,
    clientLastconnected: 1615298266,
    clientTotalconnections: 1,
    clientDescription: undefined,
    clientLastip: "86.246.159.252",
*/

exports.getConnectionLink = getConnectionLink;
exports.reviewRoles = reviewRoles;
exports.TSDebug = TSDebug;
