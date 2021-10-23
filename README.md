LSD-Bot : le Bot des Scorpions du Désert
========================================

Libraries
---------

* Creating a Bot: https://discordpy.readthedocs.io/en/latest/discord.html
* Discord JS lib: 
  * https://discord.js.org/
  * Tutorial: https://gist.github.com/y21/a599ef74c8746341dbcbd32093a69eb8
  * Doc: https://discord.js.org/#/docs/main/stable/general/welcome
  * Doc for v11: https://discord.js.org/#/docs/main/v11/general/welcome
  * Great Q&A of basic actions: 
    * https://discordjs.guide/popular-topics/common-questions.html
    * https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/frequently-asked-questions.md
  * GitHub: https://github.com/discordjs/discord.js
  * Basics about SQL queries using async/wait: https://evertpot.com/executing-a-mysql-query-in-nodejs/
  * Discord.js: understanding async/await: https://discordjs.guide/additional-info/async-await.html
  * Good article about async/await in discord.js: https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/other-guides/async-await.md
  * Good article about async/await in JS: https://yashints.dev/blog/2019/08/17/js-async-await
* Looking at NPM packages: https://www.npmjs.com/
* Axios package to perform HTTP queries easily: https://www.npmjs.com/package/axios

* Discord Botkit adaptation: https://github.com/brh55/botkit-discord
* Botkit:
  * Website: https://botkit.ai/
  * Doc: https://botkit.ai/getstarted.html
  * NPM: https://www.npmjs.com/package/botkit
  * GitHub: https://github.com/howdyai/botkit
* Mysql JS lib: https://github.com/mysqljs/mysql

Database
--------

Il faut installer en local la base de données et le site PHP de gestion de comptes des LSD : https://github.com/YannZeRookie/lsd-account

Cependant, il est possible de faire tourner le Bot sans aucune base de données, mais dans ce cas certaines fonctions seront désactivées (comme obtenir une url de connexion par exemple).
Pour désactiver la connexion à une base de données, laisser le champ `host` à `""` dans le fichier `db.json`.

Installation
------------

Installation de nodejs sur `Ubuntu` :

    $ npm install
    $ cd ~
    $ curl -sL https://deb.nodesource.com/setup_current.x -o nodesource_setup.sh
    $ sudo bash nodesource_setup.sh
    $ sudo apt-get install -y nodejs gcc g++ make
    $ curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor | sudo tee /usr/share/keyrings/yarnkey.gpg >/dev/null
    $ echo "deb https://dl.yarnpkg.com/debian stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    $ sudo apt-get update && sudo apt-get install -y yarn

Clonage du dépôt :

    $ cd ~
    $ git clone https://github.com/mbozio/lsd-bot.git

Après avoir cloné la repo et être entré dans le directory `lsd-bot` :

    $ npm install

pour installer les packages dont l'app a besoin.

### Correction de l'installation de skills-validator-1.0.0.tgz :

Supprimer temporairement la ligne 12 du fichier package.json avant l'éxecution de `nmp install`.

Après cette première installation, remette la lign 12 comme suite :

    "skills-validator": "./node_modules/botbuilder/skills-validator/skills-validator-1.0.0.tgz",

Enfin relancer `npm install`.

Renommer les fichiers `*.sample.config` en enlevant le `.sample` et y remplir les valeurs. Il faudra un Bot de test dans le serveur Discord des LSD - c'est mieux que d'utiliser celui de production.

Le fichier `config.json` contient votre url locale du site de gestion de compte. Par exemple http://localhost:8080/login

Lancement
---------

    $ ./start.sh

Le robot devrait apparaître connecté. Tapez `!connexion` dans Discord pour tester.

Développement
-------------

MS Visual Studio Code est pratique pour débugger l'app.

IL est conseillé d'avoir un Bot différent de celui en production. Afin d'éviter que les deux Bots répondent
en même temps aux commandes, mettre un préfixe différent dans le fichier `config.json` du Bot en développement.

Production
----------

Le server est lancé via [PM2 Plus](https://doc.pm2.io/en/plus/overview/). Cela permet un redémarrage automatique dès qu'il détecte qu'un fichier JS a changé.

    $ ./server.sh

### Installation d'une version qui a des nouveaux packages, cold restart :

- Stopper le bot :
```
    # pm2 stop LSD-bot
```
- Se connecter avec l'utilisateur `deploy` puis aller dans le directory :
```
    # su deploy
    $ cd /var/www/lsd/bot
```
- Mettre à jour :
```
    $ git checkout package-lock.json
    $ git pull
    $ npm install
    $ exit
```
- Lancer le bot :
```
    # pm2 start LSD-bot
    # pm2 ps
```

Notes
-----

Si lors de l'exécution d'un Promise en utilisant `await` le code sort brusquement de la fonction, c'est signe
qu'il y a une erreur d'exécution dans le traitement de l'appel `await`. Mettre un try/catch pour enquêter :

    try {
      const bla = away monPromise(toto, titi);
    }
    catch(e) {
      console.error(e);
    }

En effet il est possible que l'exception ne soit pas correctement interceptée par l'appelant et vous la ratiez.

La méthode invite() est un bon cocktail d'appels async à DiscordJS et à SQL.

