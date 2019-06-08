#!/bin/bash
cd "$(dirname "$0")"
nodemon index.js 2>&1 | logger -i -t lsd-bot
