#!/bin/bash
nodemon index.js 2>&1 | logger -i -t lsd-bot
