const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (HTML, CSS, JS) da pasta raiz ou pública
app.use(express.static(__dirname));

// Nome do arquivo onde as propostas são salvas (ajuste se o seu for diferente, ex: 'database.json')
const ARQUIVO_PROPOSTAS = './propostas.json';

// Função auxiliar para ler propostas
function lerPropostas() {
    try {
        if (fs.existsSync(ARQUIVO_PROPOSTAS)) {
            const dados = fs.readFileSync(ARQUIVO_PROPOSTAS, 'utf8');
            return JSON.parse(dados);
        }
    } catch (e) {
        console.error('Erro ao ler arquivo de propostas:', e);
    }
    return [];
}

// Função auxiliar para salvar propostas
function salvarPropostas(propostas) {
    try {
        fs.writeFileSync(ARQUIVO_PROPOSTAS, JSON.stringify(propostas, null, 2));
        return true;
    } catch (e) {
        console.error('Erro ao salvar arquivo de propostas:', e);
        return false;
    }
}

// 1. Rota para listar todas as propostas (usada pelo Admin)
app.get('/api/propostas', (req, res) => {
    const propostas = lerPropostas();
    res.json({ sucesso: true, propostas: propostas });
});

// 2. Rota para alterar o status da proposta (Aprovado / Recusado)
app.post('/api/propostas/status', (req, res) => {
    const { cpf, status } = req.body;
    let propostas = lerPropostas();
    let encontrada = false;

    propostas.forEach(p => {
        if (p.cpf === cpf) {
            p.status = status;
            encontrada = true;
        }
    });

    if (encontrada) {
        salvarPropostas(propostas);
        return res.json({ sucesso: true });
    }
    return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
});

// 3. Rota de Controle Total para Editar Dados da Proposta
app.post('/api/propostas/editar', (req, res) => {
    const dados = req.body;
    let propostas = lerPropostas();
    let encontrada = false;

    propostas.forEach(p => {
        if (p.cpf === dados.cpfOriginal) {
            p.nome = dados.nome || p.nome;
            p.cpf = dados.cpf || p.cpf;
            p.telefone = dados.telefone || p.telefone;
            p.produto = dados.produto || p.produto;
            p.endereco = dados.endereco || p.endereco;
            if (!p.cobrancaPix) p.cobrancaPix = {};
            if (dados.valorEntrada) {
                p.cobrancaPix.valorEntrada = dados.valorEntrada;
            }
            encontrada = true;
        }
    });

    if (encontrada) {
        salvarPropostas(propostas);
        return res.json({ sucesso: true });
    }
    return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
});

// 4. Rota Webhook para receber confirmação automática de pagamento Pix
app.post('/api/webhook/pix', (req, res) => {
    try {
        const notificacao = req.body;
        const idTransacao = notificacao?.data?.id || notificacao?.id;
        
        let propostas = lerPropostas();
        let propostaEncontrada = false;

        propostas.forEach(p => {
            if (p.cobrancaPix && (p.cobrancaPix.idTransacao === idTransacao || p.cobrancaPix.id === idTransacao)) {
                p.status = 'APROVADO';
                p.cobrancaPix.status = 'PAGO';
                propostaEncontrada = true;
            }
        });

        if (propostaEncontrada) {
            salvarPropostas(propostas);
            return res.status(200).json({ sucesso: true, mensagem: 'Pagamento confirmado e sistema atualizado!' });
        }

        return res.status(404).json({ sucesso: false, mensagem: 'Transação não encontrada.' });
    } catch (erro) {
        console.error('Erro no webhook:', erro);
        return res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Configuração da porta do servidor para o Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
