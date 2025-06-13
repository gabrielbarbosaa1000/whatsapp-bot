#!/bin/bash

# Inicia o bot apenas se não estiver rodando
if pgrep -f "node chatbot.js" > /dev/null; then
  echo "⚠️ Bot já está rodando. Abortando segundo processo."
  exit 0
fi

echo "✅ Iniciando chatbot..."
node chatbot.js
