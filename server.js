const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const ARQUIVO_PROPOSTAS = './propostas.json';

function lerPropostas() {
    try {
        if (fs.existsSync(ARQUIVO_PROPOSTAS)) {
            const dados = fs.readFileSync(ARQUIVO_PROPOSTAS, 'utf8');
            if (dados.trim() === '') return [];
            return JSON.parse(dados);
        }
    } catch (e) {
        console.error('Erro ao ler propostas:', e);
    }
    return [];
}

function salvarPropostas(propostas) {
    try {
        fs.writeFileSync(ARQUIVO_PROPOSTAS, JSON.stringify(propostas, null, 2));
        return true;
    } catch (e) {
        console.error('Erro ao salvar propostas:', e);
        return false;
    }
}

// 1. Rota para receber o formulário do site e salvar os dados reais
app.post('/api/propostas', (req, res) => {
    try {
        const dados = req.body;
        
        // Captura o CPF de qualquer formato que o formulário envie
        const cpfRecebido = dados.cpf || dados.CPF || dados.documento;

        if (!cpfRecebido) {
            return res.status(400).json({ sucesso: false, mensagem: 'CPF não informado.' });
        }

        let propostas = lerPropostas();
        
        const novaProposta = {
            nome: dados.nome || dados.name || 'Cliente',
            cpf: cpfRecebido,
            telefone: dados.telefone || dados.celular || dados.phone || '',
            produto: dados.produto || dados.modelo || '',
            endereco: dados.endereco || '',
            status: 'EM_ANALISE',
            parcelas: dados.parcelas || [],
            cobrancaPix: {
                valorEntrada: dados.valorEntrada || dados.entrada || '0,00'
            },
            dataCriacao: new Date().toISOString()
        };

        // Remove duplicadas do mesmo CPF e insere a nova no topo
        propostas = propostas.filter(p => p.cpf !== cpfRecebido);
        propostas.unshift(novaProposta);
        
        if (salvarPropostas(propostas)) {
            return res.status(200).json({ sucesso: true, mensagem: 'Proposta salva com sucesso!' });
        } else {
            return res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar no arquivo.' });
        }
    } catch (e) {
        console.error('Erro no POST /api/propostas:', e);
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 2. Rota para listar propostas no Painel Admin
app.get('/api/propostas', (req, res) => {
    const propostas = lerPropostas();
    res.json({ sucesso: true, propostas: propostas });
});

// 3. Rota para alterar status (Aprovar / Recusar)
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
    return res.status(404).json({ sucesso: false, mensagem: 'Não encontrada' });
});

// 4. Rota para editar dados pelo painel
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
            if (dados.valorEntrada) p.cobrancaPix.valorEntrada = dados.valorEntrada;
            encontrada = true;
        }
    });

    if (encontrada) {
        salvarPropostas(propostas);
        return res.json({ sucesso: true });
    }
    return res.status(404).json({ sucesso: false, mensagem: 'Não encontrada' });
});

// 5. Webhook Pix automático
app.post('/api/webhook/pix', (req, res) => {
    try {
        const notificacao = req.body;
        const idTransacao = notificacao?.data?.id || notificacao?.id;
        let propostas = lerPropostas();
        let encontrada = false;

        propostas.forEach(p => {
            if (p.cobrancaPix && (p.cobrancaPix.idTransacao === idTransacao || p.cobrancaPix.id === idTransacao)) {
                p.status = 'APROVADO';
                p.cobrancaPix.status = 'PAGO';
                encontrada = true;
            }
        });

        if (encontrada) {
            salvarPropostas(propostas);
            return res.status(200).json({ sucesso: true });
        }
        return res.status(404).json({ sucesso: false });
    } catch (e) {
        return res.status(500).json({ sucesso: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
