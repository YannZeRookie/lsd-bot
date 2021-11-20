/**
 * REST calls to the Discord API to go around the limitations of the Discord JS lib
 * with large guilds.
 * 
 * Note: the Bot must have been set with the special "SERVER MEMBERS INTENT" permission.
 * This is accomplished in https://discord.com/developers/applications
*/

const axios = require('axios');
const discord_api = 'https://discordapp.com/api';

/**
 * Get the list of all members of a guild that have a specific role
 * @param {*} auth 
 * @param {*} guild 
 */
async function getAllMembers(auth, guild, role_id) {
    var result = [];
    try {
        var keep_going = true;
        var last_user_id = '0';
        while (keep_going) {
            const response = await axios.get(discord_api + '/guilds/' + guild.id + '/members',
                {
                    params: {
                        limit: 200,
                        after: last_user_id
                    },
                    headers: {
                        'Authorization': 'Bot ' + auth.token,
                        'Accept': 'application/json'
                    }
                });
            response.data.forEach(u => {
                if (u.roles.some(r => r == role_id)) {
                    result.push(u);
                }
                last_user_id = u.user.id;
            });
            keep_going = (response.data.length > 0);
        };
    }
    catch (e) {
        console.error(e);
    }
    return result;
}

exports.getAllMembers = getAllMembers;
