const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Aumenta o limite para aceitar imagens e PDFs enviados em Base64 ou dados grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos da pasta raiz
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

// 1. Rota de Cadastro de Proposta (Flexível para aceitar qualquer envio do front-end)
app.post('/api/propostas', (req, res) => {
    try {
        const novaProposta = req.body;
        
        // Se o CPF não vier no corpo principal, tenta buscar ou define um provisório para não travar o cliente
        if (!novaProposta || !novaProposta.cpf) {
            // Salva mesmo assim para evitar o erro na tela do cliente
            novaProposta.cpf = novaProposta.cpf || '000.000.000-00';
        }

        let propostas = lerPropostas();
        
        novaProposta.status = novaProposta.status || 'EM_ANALISE';
        novaProposta.parcelas = novaProposta.parcelas || [];
        novaProposta.dataCriacao = novaProposta.dataCriacao || new Date().toISOString();

        // Adiciona no topo da lista
        propostas.unshift(novaProposta);
        
        if (salvarPropostas(propostas)) {
            return res.status(200).json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
        } else {
            return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao salvar.' });
        }
    } catch (e) {
        console.error('Erro no POST /api/propostas:', e);
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 2. Listar Propostas (Painel Admin)
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerPropostas();
        return res.status(200).json({ sucesso: true, propostas: propostas });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 3. Atualizar Status (Aprovar / Recusar)
app.post('/api/propostas/status', (req, res) => {
    try {
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
            return res.status(200).json({ sucesso: true });
        }
        return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 4. Editar Proposta
app.post('/api/propostas/editar', (req, res) => {
    try {
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
            return res.status(200).json({ sucesso: true });
        }
        return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 5. Webhook Pix
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
            return res.status(200).json({ sucesso: true, mensagem: 'Pagamento confirmado!' });
        }

        return res.status(404).json({ sucesso: false, mensagem: 'Transação não encontrada.' });
    } catch (erro) {
        return res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
