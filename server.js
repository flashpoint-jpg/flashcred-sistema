const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Permite receber dados grandes e JSON do formulário
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos (HTML, CSS, JS, etc.)
app.use(express.static(__dirname));

const ARQUIVO_PROPOSTAS = './propostas.json';

// Função para ler propostas com segurança
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

// Função para salvar propostas com segurança
function salvarPropostas(propostas) {
    try {
        fs.writeFileSync(ARQUIVO_PROPOSTAS, JSON.stringify(propostas, null, 2));
        return true;
    } catch (e) {
        console.error('Erro ao salvar propostas:', e);
        return false;
    }
}

// 1. Rota para CADASTRAR/ENVIAR nova proposta (Formulário do site)
app.post('/api/propostas', (req, res) => {
    try {
        const novaProposta = req.body;
        
        // Validação básica
        if (!novaProposta || !novaProposta.cpf) {
            return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos (CPF obrigatório).' });
        }

        let propostas = lerPropostas();
        
        // Define propriedades iniciais se não existirem
        novaProposta.status = novaProposta.status || 'EM_ANALISE';
        novaProposta.parcelas = novaProposta.parcelas || [];
        novaProposta.dataCriacao = novaProposta.dataCriacao || new Date().toISOString();

        // Adiciona a nova proposta no topo da lista
        propostas.unshift(novaProposta);
        
        if (salvarPropostas(propostas)) {
            return res.status(200).json({ sucesso: true, mensagem: 'Proposta salva com sucesso!' });
        } else {
            return res.status(500).json({ sucesso: false, mensagem: 'Erro ao gravar no servidor.' });
        }
    } catch (e) {
        console.error('Erro no POST /api/propostas:', e);
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 2. Rota para LISTAR todas as propostas (Painel Administrativo)
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerPropostas();
        return res.status(200).json({ sucesso: true, propostas: propostas });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// 3. Rota para ATUALIZAR STATUS (Aprovar / Recusar)
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

// 4. Rota para EDITAR DADOS da proposta pelo painel
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

// 5. Rota Webhook Pix (Confirmação automática de pagamento)
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

// Inicialização do servidor na porta do Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
