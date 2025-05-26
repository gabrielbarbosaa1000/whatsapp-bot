const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');

const client = new Client();
const delay = ms => new Promise(res => setTimeout(res, ms));

const userPdfChoices = {};
const ultimasInteracoes = {};
const iniciadasPeloCliente = {};
const inatividadeNotificada = {};

const TEMPO_AVISO = 5 * 60 * 1000; // 5 minutos
const TEMPO_ENCERRAMENTO = 10 * 60 * 1000; // 10 minutos

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

client.initialize();

function saudacaoPersonalizada() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
}

async function enviarMenu(msg, nome) {
    const chat = await msg.getChat();
    await delay(1000);
    await chat.sendStateTyping();
    await delay(2000);

    const menuMensagem = `
Escolha uma das opções abaixo 👇

🛍️  *[1]* Falar com um Vendedor  
💰  *[2]* Financeiro (Boletos, Pagamentos)  
💼  *[3]* Trabalhe Conosco  
🔔  *[4]* Ofertas e Novidades  
📍  *[5]* Localização da Loja  
📑  *[6]* Catálogos de Produtos  

Digite o número da opção desejada.  
_📌 Digite "*MENU*" a qualquer momento para voltar ao menu._
`;

    await client.sendMessage(msg.from, menuMensagem);
}

client.on('message', async (msg) => {
    const chat = await msg.getChat();
    const comando = msg.body.trim().toLowerCase();
    const contact = await msg.getContact();
    const nome = contact.pushname || 'cliente';
    const nomeFormatado = nome.split(" ")[0];
    const pdfDir = path.join(__dirname, 'arquivos', 'PDFs');

    if (!msg.fromMe) {
        ultimasInteracoes[msg.from] = Date.now();
        inatividadeNotificada[msg.from] = false;

        if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(comando)) {
            iniciadasPeloCliente[msg.from] = true;
        }
    }

    if (comando === 'sair' || comando === 'parar') {
        delete userPdfChoices[msg.from];
        delete ultimasInteracoes[msg.from];
        delete iniciadasPeloCliente[msg.from];
        delete inatividadeNotificada[msg.from];

        await client.sendMessage(msg.from, '✅ Atendimento encerrado. Quando quiser, é só digitar *MENU* para começar de novo.');
        return;
    }

    if (/^(oi|olá|ola|menu|bom dia|boa tarde|boa noite)$/i.test(comando)) {
        await enviarMenu(msg, nomeFormatado);
        return;
    }

    if (!iniciadasPeloCliente[msg.from]) {
        if (/^[1-6]$/.test(comando)) {
            await client.sendMessage(msg.from, '👋 Por favor, digite *OI*, *MENU* ou outra saudação para iniciar o atendimento.');
            return;
        }
    }

    if (userPdfChoices[msg.from]) {
        const escolha = parseInt(comando);
        if (!isNaN(escolha) && escolha >= 1 && escolha <= userPdfChoices[msg.from].length) {
            const selectedFile = userPdfChoices[msg.from][escolha - 1];
            const filePath = path.join(pdfDir, selectedFile);
            const media = MessageMedia.fromFilePath(filePath);

            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);

            await client.sendMessage(msg.from, media, {
                caption: `📎 Aqui está o arquivo: *${selectedFile}*`
            });

            const logPath = path.join(__dirname, 'logs', 'catalogo_logs.csv');
            const logData = `"${msg.from}","${nome}","${selectedFile}","${new Date().toLocaleString()}"\n`;

            fs.appendFile(logPath, logData, (err) => {
                if (err) console.error('Erro ao salvar log:', err);
                else console.log(`📥 Log salvo: ${nome} solicitou ${selectedFile}`);
            });

            delete userPdfChoices[msg.from];

            await delay(1000);
            await client.sendMessage(msg.from, '🔄 Retornando ao menu principal...');
            await enviarMenu(msg, nomeFormatado);
        } else {
            await client.sendMessage(msg.from, '❌ Opção inválida. Envie apenas o número do PDF desejado.');
        }
        return;
    }

    switch (comando) {
        case '1':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);
            await client.sendMessage(msg.from, '📞 Um vendedor entrará em contato com você em breve. Aguarde!');
            break;

        case '2':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);
            await client.sendMessage(msg.from, '💰 Informe seu *Nome*, *CPF* ou *CNPJ* para podermos localizar seus dados financeiros.');
            break;

        case '3':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);
            await client.sendMessage(msg.from, '🚀 Que bom que deseja fazer parte da nossa equipe.\nPara nos enviar seu *CURRÍCULO*, clique no link abaixo e será direcionado para um novo WhatsApp.\nEncaminhe o arquivo em formato PDF ou DOC (Word).\nJuntamente com o currículo, informar qual a vaga de interesse.\nAté mais e boa sorte.\n\n👉 https://wa.me/5562999777321');
            break;

        case '4':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);
            await client.sendMessage(msg.from, '🔔 Agora você vai receber *OFERTAS EXCLUSIVAS*, novidades e muito mais.\nPrimeiramente, *NÃO SE ESQUEÇA* de salvar este número aqui nos seus contatos.\nAgora é só esperar que enviaremos os conteúdos em primeira mão pra você.');
            break;

        case '5':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);
            await client.sendMessage(msg.from, '📍 Aqui está nossa localização no Google Maps:\n\nhttps://maps.app.goo.gl/mLiFQuJSGqHb6WvE7');
            break;

        case '6':
            await chat.sendStateTyping();
            await delay(1000);
            await client.sendMessage(msg.from, '⏳ Processando sua escolha, por favor aguarde...');
            await delay(1500);

            if (!fs.existsSync(pdfDir)) {
                await client.sendMessage(msg.from, '❌ A pasta de PDFs não foi encontrada.');
                return;
            }

            const arquivos = fs.readdirSync(pdfDir);
            const pdfs = arquivos.filter(file => file.toLowerCase().endsWith('.pdf')).sort();

            if (pdfs.length === 0) {
                await client.sendMessage(msg.from, '⚠️ Nenhum catálogo PDF encontrado no momento.');
                return;
            }

            userPdfChoices[msg.from] = pdfs;

            let resposta = '📚 Catálogos disponíveis:\n\n';
            pdfs.forEach((file, index) => {
                resposta += `*${index + 1}* - ${file}\n`;
            });
            resposta += '\nDigite o número do catálogo que deseja receber.';

            await chat.sendStateTyping();
            await delay(1500);
            await client.sendMessage(msg.from, resposta);
            break;
    }
});

// Verificação de inatividade e encerramento
setInterval(() => {
    const agora = Date.now();

    for (const contato in ultimasInteracoes) {
        const ultima = ultimasInteracoes[contato];
        const tempoSemInteracao = agora - ultima;

        if (iniciadasPeloCliente[contato]) {
            if (tempoSemInteracao >= TEMPO_ENCERRAMENTO) {
                client.sendMessage(contato, '🚫 Atendimento encerrado por inatividade. Quando quiser, é só digitar *MENU* para começar de novo.');
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
