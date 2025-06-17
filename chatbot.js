const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 10000;

// Inicializa o cliente WhatsApp
console.log('🟢 Iniciando cliente WhatsApp...');
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  }
});

// Rota raiz
app.get('/', (req, res) => res.send('🤖 Bot rodando!'));

// Rota pra exibir QR Code (se precisar abrir no navegador)
app.get('/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.send('QR Code ainda não gerado...');
  }
});

// Quando gerar QR Code
client.on('qr', async qr => {
  console.log('📲 QR Code gerado!');
  try {
    await qrcode.toFile('qr.png', qr);
    console.log('✅ QR Code salvo como qr.png');
  } catch (err) {
    console.error('❌ Erro ao salvar QR:', err);
  }
});

// Quando conectar
client.on('ready', () => console.log('✅ WhatsApp conectado!'));

// Funções auxiliares
const delay = ms => new Promise(res => setTimeout(res, ms));
const userPdfChoices = {};
const lastInteraction = {};
const iniciado = {};
const notificado = {};
const TEMPO_AVISO = 3 * 60 * 1000;
const TEMPO_ENCERRAMENTO = 6 * 60 * 1000;

function saudacaoPersonalizada() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

async function enviarComDigitando(chat, msg, tempo = 1500) {
  await chat.sendStateTyping();
  await delay(tempo);
  await client.sendMessage(chat.id._serialized, msg);
}

async function enviarMenu(msg, nome) {
  const chat = await msg.getChat();
  const saud = saudacaoPersonalizada();
  const menu = `
${saud}, *${nome}*! 👋

Escolha:
1️⃣ Falar com vendedor  
2️⃣ Financeiro  
3️⃣ Trabalhe conosco  
4️⃣ Ofertas  
5️⃣ Localização  
6️⃣ Catálogos

Digite o número ou MENU para voltar.
`;
  await enviarComDigitando(chat, menu);
}

// Recebendo mensagens
client.on('message', async msg => {
  const chat = await msg.getChat();
  const cmd = msg.body.trim().toLowerCase();
  const contact = await msg.getContact();
  const nome = contact.pushname || 'cliente';
  const nomeFmt = nome.split(' ')[0];
  const pdfDir = path.join(__dirname, 'arquivos', 'PDFs');

  if (msg.type !== 'chat') return;

  if (!msg.fromMe) {
    lastInteraction[msg.from] = Date.now();
    notificado[msg.from] = false;
    if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(cmd))
      iniciado[msg.from] = true;
  }

  if (cmd === 'sair' || cmd === 'parar') {
    await enviarComDigitando(chat, 'Deseja encerrar atendimento? SIM para confirmar ou MENU para continuar.');
    lastInteraction[msg.from] = Date.now();
    iniciado[msg.from] = true;
    return;
  }

  if (cmd === 'sim') {
    delete userPdfChoices[msg.from];
    delete lastInteraction[msg.from];
    delete iniciado[msg.from];
    delete notificado[msg.from];
    await enviarComDigitando(chat, '✅ Atendimento encerrado. Digite MENU a qualquer momento.');
    return;
  }

  if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(cmd)) {
    await enviarMenu(msg, nomeFmt);
    return;
  }

  if (!iniciado[msg.from] && /^[1-6]$/.test(cmd)) {
    await enviarComDigitando(chat, 'Digite MENU ou uma saudação para iniciar atendimento.');
    return;
  }

  if (userPdfChoices[msg.from]) {
    const escolhas = userPdfChoices[msg.from];
    if (cmd === '0') {
      await enviarComDigitando(chat, 'Enviando todos os catálogos...');
      for (const file of escolhas) {
        const media = MessageMedia.fromFilePath(path.join(pdfDir, file));
        await client.sendMessage(msg.from, media, { caption: file });
        await delay(1500);
      }
      fs.appendFileSync(path.join(__dirname, 'logs', 'catalogo_logs.csv'),
        `"${msg.from}","${nome}","TODOS","${new Date().toLocaleString()}"\n`
      );
      delete userPdfChoices[msg.from];
      await enviarMenu(msg, nomeFmt);
      return;
    }
    const idx = parseInt(cmd);
    if (!isNaN(idx) && idx >= 1 && idx <= escolhas.length) {
      const sel = escolhas[idx - 1];
      const media = MessageMedia.fromFilePath(path.join(pdfDir, sel));
      await client.sendMessage(msg.from, media, { caption: sel });
      fs.appendFileSync(path.join(__dirname, 'logs', 'catalogo_logs.csv'),
        `"${msg.from}","${nome}","${sel}","${new Date().toLocaleString()}"\n`
      );
      delete userPdfChoices[msg.from];
      await enviarMenu(msg, nomeFmt);
    } else {
      await enviarComDigitando(chat, 'Opção inválida. Digite só o número do catálogo.');
    }
    return;
  }

  switch (cmd) {
    case '1': await enviarComDigitando(chat, '📞 Em breve um vendedor entra em contato!'); break;
    case '2': await enviarComDigitando(chat, '💰 Envie NOME/CPF/CNPJ para financeiro.'); break;
    case '3': await enviarComDigitando(chat, '🚀 Envie currículo + vaga + contato.'); break;
    case '4': await enviarComDigitando(chat, '🔔 Você receberá nossas ofertas!'); break;
    case '5': await enviarComDigitando(chat, '📍 Localização:\nhttps://maps.app.goo.gl/mLi...'); break;
    case '6':
      if (!fs.existsSync(pdfDir)) {
        await enviarComDigitando(chat, 'Nenhum PDF encontrado.');
        break;
      }
      const all = fs.readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
      if (all.length === 0) {
        await enviarComDigitando(chat, 'Nenhum catálogo disponível.');
        break;
      }
      userPdfChoices[msg.from] = all;
      let resp = '📚 Catálogos:\n0️⃣ - Todos\n';
      all.forEach((f, i) => resp += `${i + 1} - ${f}\n`);
      resp += 'Digite o número.';
      await enviarComDigitando(chat, resp);
      break;
    default:
      if (/^\d+$/.test(cmd))
        await enviarComDigitando(chat, 'Opção inválida. MENU para voltar.');
      break;
  }
});

// Inatividade
setInterval(() => {
  const agora = Date.now();
  for (let contato in lastInteraction) {
    const diff = agora - lastInteraction[contato];
    if (iniciado[contato]) {
      if (diff >= TEMPO_ENCERRAMENTO) {
        client.sendMessage(contato, '🚫 Atendimento encerrado por inatividade. MENU para reiniciar.');
        delete lastInteraction[contato];
        delete iniciado[contato];
        delete userPdfChoices[contato];
      } else if (diff >= TEMPO_AVISO && !notificado[contato]) {
        client.sendMessage(contato, '👋 Precisa de ajuda? Digite MENU.');
        notificado[contato] = true;
      }
    }
  }
}, 60 * 1000);

// Start
app.listen(PORT, () => console.log(`🌐 Web server rodando na porta ${PORT}`));
client.initialize();
