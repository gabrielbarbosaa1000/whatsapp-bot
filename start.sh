#!/usr/bin/env bash
# Inicia o bot no Render com puppeteer headless compatível
PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser) node chatbot.js
