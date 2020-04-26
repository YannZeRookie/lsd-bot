/**
 * Toolbox of goodies for the LSD-Bot
 * 
 * 
 */

var crypto = require("crypto");

function buildConnectionKey(db, user) {
    if (!db) {
        return '';
    }
    key = crypto.randomBytes(20).toString('hex');
    //-- Insert the key in the database for later retrieval from the website
    //   including its username, discriminator and avatar
    db.query("INSERT INTO lsd_login SET login_key=?, created_on=unix_timestamp(), discord_id=?, discord_username=?, discord_discriminator=?, discord_avatar=?",
        [key, user.id, user.username, user.discriminator, user.avatar]).then(result => {
            console.log('Created key=' + key + ' for user_id=' + user.id);
        });
    //-- Done
    return key;
}


/**
 * Get the list of all Sections
 * @param {Database} db Database link
 * 
 * Example:
 
    lsd_tools.getSections(db).then(sections => {
        sections.forEach(function (row, i) {
            console.log('tag=' + row.tag + ' name=' + row.name);
        });
    });

 */
async function getSections(db) {
    const result = await db.query("SELECT * FROM lsd_section ORDER BY archived,`order`");
    return result[0];
}

/**
 * Invite a user
 * 
 * @param {Database} db 
 * @param {Guild} guild 
 * @param {GuildMember} target the user to invite
 * @param {GuildMember} cur_user the current user
 * @param {integer} expiration 7 days by default
 * 
 * test message for YannZeGrunt : 
 *  §inviter <@!404722937183076354>
 *  §inviter <@!404722937183076354> 42
 */
async function invite(db, guild, target, cur_user, expiration) {
    // Get the Roles of the current user. If not Scorpion -> fail
    if (!cur_user.roles.some(role => role.name === 'Scorpion')) {
        throw "Erreur : Il faut être Scorpion pour pouvoir inviter quelqu'un";
    }
    // Get the Roles of the target user. If other than @everyone -> fail
    if (target.highestRole.name != '@everyone') {
        throw "Erreur : cet utilisateur est déjà au moins de niveau Invité";
    }
    // Check for any inconsistencies with the database if the target user is already in there
    const db_check = await db.query("SELECT u.id FROM lsd_users as u \
        INNER JOIN lsd_roles as r ON r.user_id=u.id AND r.role='scorpion' \
        WHERE u.discord_id=? ", [target.id]);
    if (db_check[0].length) {
        throw "Erreur : il semble y avoir une incohérence dans la base de données car cet utilisateur y est indiqué comme Scorpion. Signalez ce problème à un Officier ou un Admin. Merci !";
    }

    // Force expiration to 7 days if current user Role is not at least Officier
    if (!cur_user.roles.some(role => {
        return role.name == 'Officier' || role.name == 'Conseiller' || role.name == 'Admin';
    })) {
        expiration = 7;
    }

    // Set target user's role to Invite
    const invite_role = guild.roles.find(role => role.name === 'Invité');
    if (!invite_role) {
        throw "Erreur : impossible de trouver le rôle Invité. Contactez un Admin.";
    }
    await target.addRole(invite_role);

    // If he's already in the database, set his role there too
    var target_user_id = null;
    const db_user_res = await db.query("SELECT u.id, r.id as role_id FROM lsd_users as u \
        LEFT JOIN lsd_roles as r ON r.user_id=u.id AND r.role in ('visiteur', 'invite') \
        WHERE u.discord_id=? ", [target.id]);
    if (db_user_res[0].length) {
        target_user_id = db_user_res[0][0].id;
        if (db_user_res[0][0].role_id) {
            await db.query("UPDATE lsd_roles SET role='invite' WHERE id=? ", [db_user_res[0][0].role_id]);
        } else {
            await db.query("INSERT INTO lsd_roles SET user_id=?, role='invite' ", [target_user_id]);
        }
    }

    // Delete any previous invitations, if any. Should not be the case, but you never know...
    await db.query("DELETE FROM lsd_invitations WHERE discord_id = ? ", [target.id]);

    // Insert a new invitation in the database
    await db.query("INSERT INTO lsd_invitations SET created_on=unix_timestamp(), ?",
        {
            expiration: expiration,
            user_id: target_user_id,
            discord_id: target.id,
            discord_username: (target.nickname ? target.nickname : target.displayName),
            by_discord_id: cur_user.id,
            by_discord_username: (cur_user.nickname ? cur_user.nickname : cur_user.displayName)
        }
    );

    // All done - at last
    return expiration;
}


exports.buildConnectionKey = buildConnectionKey;
exports.getSections = getSections;
exports.invite = invite;
