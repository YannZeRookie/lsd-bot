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
