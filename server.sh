#!/bin/bash
cd "$(dirname "$0")"
pm2 ecosystem.config.js
