const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use('/qr.png', express.static(path.join(__dirname, 'qr.png')));

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
        ],
    },
    authStrategy: new LocalAuth()
});

const delay = ms => new Promise(res => setTimeout(res, ms));

const userPdfChoices = {};
const ultimasInteracoes = {};
const iniciadasPeloCliente = {};
const inatividadeNotificada = {};

const TEMPO_AVISO = 3 * 60 * 1000;
const TEMPO_ENCERRAMENTO = 10 * 60 * 1000;

client.on('qr', async (qr) => {
    console.warn('⚠️ QR Code gerado. Criando imagem...');

    try {
        await qrcode.toFile(path.join(__dirname, 'qr.png'), qr, {
            type: 'png',
            margin: 1,
            width: 300,
        });

        console.log('✅ QR Code salvo como imagem: qr.png');
    } catch (err) {
        console.error('Erro ao salvar QR code:', err);
    }
});

client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
});

client.initialize();

function saudacaoPersonalizada() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
}

async function enviarComDigitando(chat, mensagem, tempo = 1500) {
    await chat.sendStateTyping();
    await delay(tempo);
    await client.sendMessage(chat.id._serialized, mensagem);
}

async function enviarMenu(msg, nome) {
    const chat = await msg.getChat();
    const saudacao = saudacaoPersonalizada();

    const menuMensagem = `
${saudacao}, *${nome}*! 👋, tudo bem?

Escolha uma das opções abaixo:

🛍️  *[1]* Falar com um Vendedor;  
💰  *[2]* Financeiro (Boletos, Pagamentos);  
💼  *[3]* Trabalhe Conosco;  
🔔  *[4]* Ofertas e Novidades;  
📍  *[5]* Localização da Loja;  
📑  *[6]* Catálogos de Produtos.

✳️ _Digite o número da opção desejada._  
❗ _A qualquer momento, envie *MENU* para voltar ao início._  
`;

    await enviarComDigitando(chat, menuMensagem);
}

client.on('message', async (msg) => {
    console.log('📩 Mensagem recebida:', msg.body);
    const chat = await msg.getChat();
    const comando = msg.body.trim().toLowerCase();
    const contact = await msg.getContact();
    const nome = contact.pushname || 'cliente';
    const nomeFormatado = nome.split(" ")[0];
    const pdfDir = path.join(__dirname, 'arquivos', 'PDFs');

    if (msg.type !== 'chat') return;

    if (!msg.fromMe) {
        ultimasInteracoes[msg.from] = Date.now();
        inatividadeNotificada[msg.from] = false;

        if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(comando)) {
            iniciadasPeloCliente[msg.from] = true;
        }
    }

    if (comando === 'sair' || comando === 'parar') {
        await enviarComDigitando(chat, '⚠️ *Confirmação:* Você realmente deseja encerrar o atendimento?\n\nDigite *SIM* para confirmar ou *MENU* para continuar.');
        return;
    }

    if (comando === 'sim') {
        delete userPdfChoices[msg.from];
        delete ultimasInteracoes[msg.from];
        delete iniciadasPeloCliente[msg.from];
        delete inatividadeNotificada[msg.from];

        await enviarComDigitando(chat, '✅ Atendimento *encerrado com sucesso.*\n\nQuando quiser, é só digitar *MENU* para começar de novo.');
        return;
    }

    if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(comando)) {
        await enviarMenu(msg, nomeFormatado);
        return;
    }

    if (!iniciadasPeloCliente[msg.from]) {
        if (/^[1-6]$/.test(comando)) {
            await enviarComDigitando(chat, '👋 Por favor, digite *OI*, *MENU* ou outra saudação para iniciar o atendimento.');
            return;
        }
    }

    if (userPdfChoices[msg.from]) {
        if (comando === '0') {
            await enviarComDigitando(chat, '⏳ Enviando *todos os catálogos*. Aguarde...');

            for (const file of userPdfChoices[msg.from]) {
                const filePath = path.join(pdfDir, file);
                const media = MessageMedia.fromFilePath(filePath);
                await client.sendMessage(msg.from, media, { caption: `📎 *${file}*` });
                await delay(1500);
            }

            delete userPdfChoices[msg.from];

            await enviarComDigitando(chat, '✅ *Todos os catálogos foram enviados.*\n\n🔄 Retornando ao menu principal...');
            await enviarMenu(msg, nomeFormatado);
            return;
        }

        const escolha = parseInt(comando);
        if (!isNaN(escolha) && escolha >= 1 && escolha <= userPdfChoices[msg.from].length) {
            const selectedFile = userPdfChoices[msg.from][escolha - 1];
            const filePath = path.join(pdfDir, selectedFile);
            const media = MessageMedia.fromFilePath(filePath);

            await enviarComDigitando(chat, '⏳ Processando sua escolha. Aguarde...');
            await client.sendMessage(msg.from, media, { caption: `📎 Aqui está o arquivo: *${selectedFile}*` });

            delete userPdfChoices[msg.from];

            await enviarComDigitando(chat, '🔄 Retornando ao menu principal...');
            await enviarMenu(msg, nomeFormatado);
        } else {
            await enviarComDigitando(chat, '❌ *Opção inválida.* Envie apenas o número do PDF desejado.');
        }
        return;
    }

    switch (comando) {
        case '1':
            await enviarComDigitando(chat, '📞 Um *vendedor* entrará em contato com você em breve.');
            break;
        case '2':
            await enviarComDigitando(chat, '💰 Envie seu *NOME*, *CPF* ou *CNPJ* para localizar seus dados.');
            break;
        case '3':
            await enviarComDigitando(chat, '🚀 Envie seu *currículo* e dados para candidatura neste chat.');
            break;
        case '4':
            await enviarComDigitando(chat, '🔔 Você receberá nossas *ofertas exclusivas* em breve!');
            break;
        case '5':
            await enviarComDigitando(chat, '📍 Localização da loja: https://maps.app.goo.gl/mLiFQuJSGqHb6WvE7');
            break;
        case '6':
            if (!fs.existsSync(pdfDir)) {
                await enviarComDigitando(chat, '❌ *A pasta de PDFs não foi encontrada.*');
                return;
            }

            const arquivos = fs.readdirSync(pdfDir);
            const pdfs = arquivos.filter(f => f.toLowerCase().endsWith('.pdf')).sort();

            if (pdfs.length === 0) {
                await enviarComDigitando(chat, '⚠️ *Nenhum catálogo PDF encontrado.*');
                return;
            }

            userPdfChoices[msg.from] = pdfs;

            let resposta = '📚 *Catálogos disponíveis:*\n\n';
            resposta += '*0* - 📥 *Baixar TODOS os catálogos*\n\n';
            pdfs.forEach((file, index) => {
                resposta += `*${index + 1}* - ${file}\n`;
            });
            resposta += '\n✳️ *Digite o número do catálogo desejado.*';

            await enviarComDigitando(chat, resposta);
            break;
        default:
            if (/^\d+$/.test(comando)) {
                await enviarComDigitando(chat, '❌ *Opção inválida.* Envie um número válido do *MENU*.');
            }
            break;
    }
});

// 🔄 Inatividade
setInterval(() => {
    const agora = Date.now();

    for (const contato in ultimasInteracoes) {
        const ultima = ultimasInteracoes[contato];
        const tempoSemInteracao = agora - ultima;

        if (iniciadasPeloCliente[contato]) {
            if (tempoSemInteracao >= TEMPO_ENCERRAMENTO) {
                client.sendMessage(contato, '🚫 Atendimento *encerrado por inatividade.* Digite *MENU* para começar de novo.');
                delete ultimasInteracoes[contato];
                delete inatividadeNotificada[contato];
                delete iniciadasPeloCliente[contato];
                delete userPdfChoices[contato];
            } else if (tempoSemInteracao >= TEMPO_AVISO && !inatividadeNotificada[contato]) {
                client.sendMessage(contato, '👋 Oi! Estou aqui se precisar de ajuda. Para voltar ao menu, digite *MENU*.');
                inatividadeNotificada[contato] = true;
            }
        }
    }
}, 60 * 1000);

// ✅ Ajuste de porta para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});
