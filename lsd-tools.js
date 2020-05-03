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

/**
 * 
 * @param {*} db Database
 * @param {*} guild Guild
 * @param {*} invitation from the lsd_invitations table
 */
async function degrade_invite(db, guild, invitation, invite_role) {
    if (guild == null) return;
    var target_member = guild.members.get(invitation.discord_id);
    if (target_member == undefined) return;
    var is_invite = target_member.roles.some(role => { return role.name == 'Invité'; });
    if (is_invite) {
        // Change Role
        await target_member.removeRole(invite_role);
        // Send PM to target
        var message = "Bonjour, c'est le Bot du serveur Discord des Scorpions du Désert !\n" +
        "Je t'ai automatiquement repassé(e) en simple Visiteur. J'espère que ton passage sur notre serveur s'est bien passé.\n" +
        "Si tu souhaites de nouveau jouer avec nous, deux solutions :\n" +
        "- Soit tu te fais ré-inviter";
        if (invitation.by_discord_id) {
            message += " (c'était **" + invitation.by_discord_username + "** qui s'était occupé de toi la dernière fois)"
        }
        message += "\n- Soit tu décides de nous rejoindre pour de bon ! Il te suffit de taper ici la commande `!inscription` et je te guiderai vers notre site web\n" +
        "À bientôt j'espère ! - Les LSD";
        target_member.send(message);
        // PM to the user who created the invitations
        if (invitation.by_discord_id) {
            var by_member = guild.members.get(invitation.by_discord_id);
            if (by_member) {
                by_member.send(`Ton invité(e) **${invitation.discord_username}** a été rétrogradé en simple Visiteur.` + "\n" +
                "Un message lui a été envoyé pour lui expliquer quoi faire pour se faire ré-inviter ou pour s'inscrire pour de bon."
                );
            }
        }
    }
    // If present in database, change role there too
    await db.query("UPDATE lsd_roles as r \
        INNER JOIN lsd_users as u ON u.discord_id=? \
        SET r.role='visiteur' \
        WHERE r.user_id=u.id AND r.role='invite' ", [invitation.discord_id]);
    // TODO: add a log entry

    // Remove invitation from database
    if (invitation.id) {
        await db.query("DELETE FROM lsd_invitations WHERE id=? ", [invitation.id]);
    }

    // Done
    console.log(`Invitation automatic roll-back of ${invitation.discord_username} (${invitation.discord_id})`);
}


/**
 * Review the invites and turn some of them back to visiteurs
 * @param {*} db Database
 * @param {*} guild Guild (aka LSD Server)
 */
async function reviewInvites(db, guild) {
    try {
        const invite_role = guild ? guild.roles.find(role => role.name === 'Invité') : null;
        //-- Find timed-out invitations
        const found_res = await db.query("SELECT * FROM lsd_invitations WHERE created_on + expiration*24*3600 < unix_timestamp()");
        for (const invitation of found_res[0]) {
            await degrade_invite(db, guild, invitation, invite_role);
        }

        //-- Shoot down a few invites who do not have any invitations
        //   Note: the following is an example of iterating thru a Collection in sync mode
        var loners = [];
        for(const m of invite_role.members) {
            const member = m[1];
            if (loners.length <= 20) {
                const res = await db.query("SELECT id FROM lsd_invitations WHERE discord_id=?", [member.id]);
                //if ((res[0].length == 0) && (member.id == "404722937183076354")) {
                if (res[0].length == 0) {
                    loners.push(member);
                }
            }
        };
        for (const member of loners) {
            await degrade_invite(db, guild, {
                discord_id: member.id,
                discord_username: member.displayName
            }, invite_role);
        }
    }
    catch (e) {
        console.error(e);
    }
}

exports.buildConnectionKey = buildConnectionKey;
exports.getSections = getSections;
exports.invite = invite;
exports.reviewInvites = reviewInvites;
