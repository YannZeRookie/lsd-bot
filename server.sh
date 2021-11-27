#!/bin/bash
cd "$(dirname "$0")"
pm2 start ecosystem.config.js
