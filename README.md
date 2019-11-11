LSD-Bot : le Bot des Scorpions du Désert
========================================

Libraries
---------

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

Après avoir cloné la repo et être entré dans le directory `lsd-bot` :

    $ npm install

pour installer les packages dont l'app a besoin.

Renommer les fichiers `*.sample.config` en enlevant le `.sample` et y remplir les valeurs. Il faudra un Bot de test dans le serveur Discord des LSD - c'est mieux que d'utiliser celui de production.

Le fichier `config.json` contient votre url locale du site de gestion de compte. Par exemple http://localhost:8080/login

Lancement
---------

    $ ./start.sh

Le robot devrait apparaître connecté. Tapez `!connexion` dans Discord pour tester.

Développement
-------------

MS Visual Studio Code est pratique pour débugger l'app.

Production
----------

Le server est lancé via [nodemon](https://github.com/remy/nodemon). Cela permet un redémarrage automatique dès qu'il détecte qu'un fichier JS a changé. La sortie est envoyée dans `/var/log/syslog`.

    $ ./server.sh

