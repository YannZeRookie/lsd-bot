/**
 * Toolbox of goodies for the LSD-Bot
 * 
 * 
 */

var crypto = require("crypto");
var lsd_rest = require('./lsd-rest');

const invite_role_id = '404693131573985280';

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
 * @param {GuildMember} target_member the user to invite
 * @param {GuildMember} cur_user the current user
 * @param {integer} expiration 7 days by default
 * 
 * test message for YannZeGrunt : 
 *  §inviter <@!404722937183076354>
 *  §inviter <@!404722937183076354> 42
 */
async function invite(db, guild, target_member, cur_user, expiration) {
    try {
        // Get the Roles of the current user. If not Scorpion -> fail
        if (!cur_user.roles.cache.some(role => role.name === 'Scorpion')) {
            throw "Erreur : Il faut être Scorpion pour pouvoir inviter quelqu'un";
        }
        if (!target_member) {
            throw "Erreur : cet utilisateur n'est pas connu du serveur";
        }
        // Get the Roles of the target user. If other than @everyone -> fail
        if (target_member.roles.highest.name != '@everyone') {
            throw "Erreur : cet utilisateur est déjà au moins de niveau Invité";
        }
        // Check for any inconsistencies with the database if the target user is already in there
        const db_check = await db.query("SELECT u.id FROM lsd_users as u \
            INNER JOIN lsd_roles as r ON r.user_id=u.id AND r.role='scorpion' \
            WHERE u.discord_id=? ", [target_member.id]);
        if (db_check[0].length) {
            throw "Erreur : il semble y avoir une incohérence dans la base de données car cet utilisateur y est indiqué comme Scorpion. Signalez ce problème à un Officier ou un Admin. Merci !";
        }

        // Force expiration to 7 days if current user Role is not at least Officier
        if (!cur_user.roles.cache.some(role => {
            return role.name == 'Officier' || role.name == 'Conseiller' || role.name == 'Admin';
        })) {
            expiration = 7;
        }

        // If he's already in the database, set his role there too
        var target_user_id = null;
        const db_user_res = await db.query("SELECT u.id, r.id as role_id FROM lsd_users as u \
            LEFT JOIN lsd_roles as r ON r.user_id=u.id AND r.role in ('visiteur', 'invite') \
            WHERE u.discord_id=? ", [target_member.id]);
        if (db_user_res[0].length) {
            target_user_id = db_user_res[0][0].id;
            if (db_user_res[0][0].role_id) {
                await db.query("UPDATE lsd_roles SET role='invite' WHERE id=? ", [db_user_res[0][0].role_id]);
            } else {
                await db.query("INSERT INTO lsd_roles SET user_id=?, role='invite' ", [target_user_id]);
            }
        }

        // Delete any previous invitations, if any. Should not be the case, but you never know...
        await db.query("DELETE FROM lsd_invitations WHERE discord_id = ? ", [target_member.id]);

        // Insert a new invitation in the database
        await db.query("INSERT INTO lsd_invitations SET created_on=unix_timestamp(), ?",
            {
                expiration: expiration,
                user_id: target_user_id,
                discord_id: target_member.id,
                discord_username: (target_member.nickname ?? target_member.displayName),
                by_discord_id: cur_user.id,
                by_discord_username: (cur_user.nickname ?? cur_user.displayName)
            }
        );

        // Set target user's role to Invité (role id=404693131573985280)
        await target_member.roles.add(invite_role_id);
    }
    catch (e) {
        console.error(e);
        throw e;
    }

    // All done - at last
    return expiration;
}

/**
 * Un-invite a user
 * 
 * @param {*} db Database
 * @param {*} guild Guild
 * @param {*} invitation from the lsd_invitations table
 * @param {boolean} send_messages   true if messages should be sent to targets
 */
async function degrade_invite(db, guild, invitation, send_messages) {
    try {
        if (guild == null) return;
        try {
            const target_member = await guild.members.fetch(invitation.discord_id);
            if (!target_member) {
                throw "User " + invitation.discord_id + " is not a member anymore";
            }
            var is_invite = target_member.roles.cache.some(role => { return role.name == 'Invité'; });
            if (is_invite) {
                // Change Role
                await target_member.roles.remove(invite_role_id); // Role ID = '404693131573985280'
                if (send_messages) {
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
                    await target_member.send(message);
                    // PM to the user who created the invitations
                    if (invitation.by_discord_id) {
                        var by_member = await guild.members.fetch(invitation.by_discord_id);
                        if (by_member) {
                            await by_member.send(`Ton invité(e) **${invitation.discord_username}** a été rétrogradé en simple Visiteur.` + "\n" +
                                "Un message lui a été envoyé pour lui expliquer quoi faire pour se faire ré-inviter ou pour s'inscrire pour de bon."
                            );
                        }
                    }
                }
            }
        }
        catch (e) {
            // It's OK, we'll simply purge the database
            //console.log(`Invitation roll-back: did not find member ${invitation.discord_username} (${invitation.discord_id})`);
            console.error(e);
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
        } else {
            // Delete any lurking invitations, if any
            await db.query("DELETE FROM lsd_invitations WHERE discord_id = ? ", [invitation.discord_id]);
        }

        // Done
        console.log(`Invitation automatic roll-back of ${invitation.discord_username} (${invitation.discord_id})`);
    }
    catch (e) {
        console.error(`Error with Invitation roll-back of ${invitation.discord_username} (${invitation.discord_id}):`);
        console.error(e);
    }
}


/**
 * Review the invites and turn some of them back to visiteurs
 * @param {*} db Database
 * @param {*} discordConfig Discord Bot token
 * @param {*} guild Guild (aka LSD Server)
 */
async function reviewInvites(db, discordConfig, guild) {
    try {
        if (guild) {
            //-- Shoot down the invites who do not have any invitations in the database
            const invites = await lsd_rest.getAllMembers(discordConfig, guild, invite_role_id);
            for (const i of invites) {
                const res = await db.query("SELECT id FROM lsd_invitations WHERE discord_id=?", [i.user.id]);
                if (res[0].length == 0) {
                    await degrade_invite(db, guild, {
                        discord_id: i.user.id,
                        discord_username: (i.nick ?? i.user.username)
                    }, false);
                }
            }

            //-- Find timed-out invitations from Database
            const found_res = await db.query("SELECT * FROM lsd_invitations WHERE created_on + expiration*24*3600 < unix_timestamp()");
            for (const invitation of found_res[0]) {
                await degrade_invite(db, guild, invitation, true);
            }

        }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Attempts the creation of an event in the database
 * @param {*} db Database
 * @param {*} section section_tag string
 * @param {*} eventdate datetime
 * @param {*} author_id discord id of the person creating the event
 * @param {*} author_tag discord tag (name and unique discriminator) of the person creating the event
 * @param {*} description text describing the event
 * @param {*} title title given to the event
 */
async function event_create(db, section, eventdate, author_id, author_tag, description, title) {
    try {
        let nowdate = Date.now();
        if (nowdate > eventdate) { return "Erreur : vous ne pouvez pas créer un event pour une date passée."; }
        //getting list of acceptable sections and roles
        let section_tags = [];
        const sections_data = await db.query("SELECT * FROM lsd_section WHERE archived=0");
        sections_data[0].forEach(elem => section_tags.push(elem.tag));
        //if sections and roles are acceptable, create the event
        if (section_tags.includes(section)) {
            result = await db.query('INSERT INTO lsd_events SET event_id=?,section_tag=?,date_time=?,author_discord_id=?,author_discord_tag=?,description=?,title=? ',
                [0, section, eventdate, author_id, author_tag, description, title], function (err) {
                    if (err) { throw err; }
                });
            return ':white_check_mark: **Event créé avec succès :** __'+ title +'__ \n Tapez \' !event info ' + result[0].insertId + ' \' pour les informations sur cet event.';
        }
        // otherwise reply with an error
        else {
            let errorstring = "Erreur : "
            if (!section_tags.includes(section)) {
                errorstring += "section inconnue. Les tags de section sont : ";
                errorstring += section_tags.join(', ');
            }
            return errorstring;
        }
    }
    catch (e) {
        console.error(e);
    }
}


/**
 * Looks for event ID in events table, returns the event data.
 * @param {*} db Database
 * @param {*} id number id of the event
 */
async function event_info(db, id) {
    try {
        const resu = await db.query("SELECT * FROM lsd_events WHERE event_id=? ", id, function (err, result) {
            if (err) { throw err; }
        });
        if (resu[0].length === 0) { return "Erreur : impossible de trouver l'event #" + id; }
        const edate = resu[0][0].date_time
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
        const eventdate = edate.toLocaleDateString('fr-FR', options);
        let inscrits = resu[0][0].participants ?? "";
        let author_tag = resu[0][0].author_discord_tag;
        let count = (inscrits.match(/¸/g) || []).length;
        let title = resu[0][0].title;
        let resultstring = "**Event #" + id + " : ** __"+ title +"__\nSection " + resu[0][0].section_tag + "\n:calendar_spiral: " + eventdate + "\nCréé par " + author_tag + "\n---------------------\n";
        resultstring += resu[0][0].description + "\n---------------------\n :scorpion: " + count + " inscrits : " + inscrits;
        resultstring += "\nRépondez \' !e s " + id + " \' pour vous inscrire.";
        return resultstring;
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Looks for event ID in events table, if found check the author correponds to the one given and modify the event desciption.
 * @param {*} db Database
 * @param {*} id number id of the event
 * @param {*} author_tag discord tag (name and unique discriminator) of the person creating the event
 * @param {*} description text describing the event
 */
async function event_modify(db, id, author_tag, description) {
    try {
        const resu = await db.query("SELECT * FROM lsd_events WHERE event_id=? ", id, function (err, result) {
            if (err) { throw err; }
        });
        if (resu[0].length === 0) { return "Erreur : impossible de trouver l'event #" + id; }
        let event_author_tag = resu[0][0].author_discord_tag;
        let title = resu[0][0].title;
        if (event_author_tag !== author_tag) { return "Erreur : seul " + event_author_tag + " peut modifier l'event #" + id; }
        const resu2 = await db.query("UPDATE lsd_events SET description=? WHERE event_id = ?", [description, id], function (err) {
            if (err) { throw err; }
        });
        return ":white_check_mark: l'event #" + id + " __"+ title+"__ a été modifié.";
    }
    catch (e) {
        console.error(e);
    }
}



/**
 * Looks for event ID in events table, sign in the user to the event. (updates the database)
 * @param {*} db Database
 * @param {*} id number id of the event
 * @param {*} author_tag discord tag (name and unique discriminator) of the person signing in the event
 */
async function event_sign_in(db, id, author_tag) {
    try {
        const resu = await db.query("SELECT * FROM lsd_events WHERE event_id=? ", id, function (err, result) {
            if (err) { throw err; }
        });
        if (resu[0].length === 0) { return "Erreur : impossible de trouver l'event #" + id; }
        let nowdate = Date.now();
        if (nowdate > resu[0][0].date_time) { return "Erreur : L'event #" + id + " est passé, vous ne pouvez plus vous inscrire."; }
        let inscrits = resu[0][0].participants ?? "";
        let title = resu[0][0].title;
        if (inscrits.includes(author_tag)) { return author_tag + " est déjà inscrit(e) à l'event #" + id + ". __"+ title +"__"; }
        else {
            inscrits += author_tag + " ¸ ";
            const resu = await db.query("UPDATE lsd_events SET participants=? WHERE event_id = ?", [inscrits, id], function (err) {
                if (err) { throw err; }
            });
            return ":white_check_mark: " + author_tag + " est maintenant inscrit(e) à l'event #" + id + ". __"+ title +"__";
        }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Looks for event ID in events table, sign out the user to the event. (updates the database)
 * @param {*} db Database
 * @param {*} id number id of the event
 * @param {*} author_tag discord tag (name and unique discriminator) of the person signing out of the event
 */
async function event_sign_out(db, id, author_tag) {
    try {
        const resu = await db.query("SELECT * FROM lsd_events WHERE event_id=? ", id, function (err, result) {
            if (err) { throw err; }
        });
        if (resu[0].length === 0) { return "Erreur : impossible de trouver l'event #" + id; }
        let nowdate = Date.now();
        if (nowdate > resu[0][0].date_time) { return "Erreur : L'event #" + id + " est passé, vous ne pouvez plus vous désinscrire."; }
        let inscrits = resu[0][0].participants ?? "";
        let title = resu[0][0].title;
        if (inscrits.includes(author_tag)) {
            inscrits = inscrits.replace(author_tag + " ¸ ", "");
            const resu = await db.query("UPDATE lsd_events SET participants=? WHERE event_id = ?", [inscrits, id], function (err, result) {
                if (err) { throw err; }
            });
            return ":red_circle: " + author_tag + " n'est plus inscrit(e) à l'event #" + id + ". __"+ title +"__";
        }
        else {
            return author_tag + " n'est pas inscrit(e) à l'event #" + id + ". __"+ title +"__";
        }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Looks for event ID in events table, deletes the event row from database.
 * @param {*} db Database
 * @param {*} id number id of the event
 * @param {*} highest_rank highest_rank of the message author
 * @param {*} author_tag tag of the message author
 */
async function event_delete(db, id, highest_rank, author_tag) {
    try {
        const resu = await db.query("SELECT * FROM lsd_events WHERE event_id=? ", id, function (err, result) {
            if (err) { throw err; }
        });
        let event_author_tag = resu[0][0].author_discord_tag;
        let title = resu[0][0].title;
        if (highest_rank === "Officier" || highest_rank === "Conseiller" || highest_rank === "Admin" || event_author_tag === author_tag) {
            const resu = await db.query("DELETE FROM lsd_events WHERE event_id=?; ", id, function (err, result) {
                if (err) { throw err; }
            });
            return "L'event #" + id + "  __"+ title +"__ , a été supprimé.";
        }
        else { return 'Erreur : Il faut être Officier, ou être le créateur de l\'event pour le supprimer.'; }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Looks for events in the database, abd returns a summary.
 * @param {*} db Database
 * @param {*} option string that should be either 'all', or 'future', indicating if all events or only future events should be returned.
 */
async function event_list(db, option) {
    try {
        const filter = (option === 'all') ? "1" : "date_time > NOW()";
        const events_data = await db.query("SELECT * FROM lsd_events WHERE " + filter + " ORDER BY date_time");
        var resultstring = 'Voici la liste de tous les events :\n';
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
        events_data[0].forEach(function (elem) {
            var edate = elem.date_time.toLocaleDateString('fr-FR', options);
            resultstring += "**Event #" + elem.event_id + " :** __"+ elem.title +"__, section " + elem.section_tag + ", " + edate + ", créé par " + elem.author_discord_tag + "\n";
        });
        return resultstring;
    }
    catch (e) {
        console.error(e);
    }
}


/**
 * Looks in the database for the kill_list, filter the names with the section requested, and returns the list.
 * @param {*} db Database
 * @param {*} section string containing a section tag
 */
async function kill_list_view(db, section) {
    try {
        //getting list of acceptable sections and roles
        let section_tags = [];
        const sections_data = await db.query("SELECT * FROM lsd_section WHERE archived=0");
        sections_data[0].forEach(elem => section_tags.push(elem.tag));
        //if sections and roles are acceptable, create the entry
        if (section_tags.includes(section)) {
            const events_data = await db.query("SELECT * FROM lsd_kill_list WHERE section_tag=? ORDER BY enemy_name",[section], function (err) { if (err) { throw err; } });
            var resultstring = ':skull: Kill list pour la section __'+section+'__ :\n';
            events_data[0].forEach(function (elem) { resultstring += "**" + elem.enemy_name + "** : "+ elem.enemy_description + "\n"; });
            return resultstring;
            } else {
                let errorstring = "Erreur : "
                if (!section_tags.includes(section)) {
                    errorstring += "section inconnue. Les tags de section sont : ";
                    errorstring += section_tags.join(', ');
                }
                return errorstring;
            }
        }
    catch (e) {
        console.error(e);
    }
}


/**
 * Adds an entry in the database for the kill_list.
 * @param {*} db Database
 * @param {*} section string containing a section tag
 * @param {*} enemy_name string containing a section tag
 * @param {*} description string containing a section tag
 */
async function kill_list_add(db, section, enemy_name, description) {
    try {
        //getting list of acceptable sections and roles
        let section_tags = [];
        const sections_data = await db.query("SELECT * FROM lsd_section WHERE archived=0");
        sections_data[0].forEach(elem => section_tags.push(elem.tag));
        //if sections and roles are acceptable, create the entry
        if (section_tags.includes(section)) {
            result = await db.query('INSERT INTO lsd_kill_list SET id=?,section_tag=?,enemy_name=?,enemy_description=? ',
                [0, section, enemy_name, description], function (err) { if (err) { throw err; }  });
            return ':white_check_mark: **Id ajouté à la kill list :** ('+ section +') ' + enemy_name;
        }
        // otherwise reply with an error
        else {
            let errorstring = "Erreur : "
            if (!section_tags.includes(section)) {
                errorstring += "section inconnue. Les tags de section sont : ";
                errorstring += section_tags.join(', ');
            }
            return errorstring;
        }
    }
    catch (e) {
        console.error(e);
    }
}


/**
 * Removes an entry in the database for the kill_list.
 * @param {*} db Database
 * @param {*} section string containing a section tag
 * @param {*} enemy_name string containing a section tag
 */
async function kill_list_remove(db, section, enemy_name) {
    try {
        //getting list of acceptable sections and roles
        let section_tags = [];
        const sections_data = await db.query("SELECT * FROM lsd_section WHERE archived=0");
        sections_data[0].forEach(elem => section_tags.push(elem.tag));
        //if sections and roles are acceptable, create the entry
        if (section_tags.includes(section)) {
            const resu = await db.query("DELETE FROM lsd_kill_list WHERE section_tag=? AND enemy_name=?; ", [section, enemy_name], function (err, result) {
                if (err) { throw err; }
                });
            return '**Id retiré de la kill list :** ('+ section +') ' + enemy_name;
        }
        // otherwise reply with an error
        else {
            let errorstring = "Erreur : "
            if (!section_tags.includes(section)) {
                errorstring += "section inconnue. Les tags de section sont : ";
                errorstring += section_tags.join(', ');
            }
            return errorstring;
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
exports.degrade_invite = degrade_invite;
exports.event_create = event_create;
exports.event_info = event_info;
exports.event_delete = event_delete;
exports.event_list = event_list;
exports.event_sign_in = event_sign_in;
exports.event_sign_out = event_sign_out;
exports.event_modify = event_modify;
exports.kill_list_view = kill_list_view;
exports.kill_list_add = kill_list_add;
exports.kill_list_remove = kill_list_remove;
