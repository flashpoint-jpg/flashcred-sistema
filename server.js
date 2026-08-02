const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ARQUIVO_DADOS = path.join(__dirname, 'propostas.json');

// Middlewares essenciais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Funções para ler e salvar propostas em arquivo (Persistência Real)
function lerPropostas() {
    try {
        if (fs.existsSync(ARQUIVO_DADOS)) {
            const dados = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
            return JSON.parse(dados);
        }
    } catch (error) {
        console.error("Erro ao ler arquivo de propostas:", error);
    }
    return [];
}

function salvarPropostasNoArquivo(lista) {
    try {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2), 'utf8');
    } catch (error) {
        console.error("Erro ao salvar arquivo de propostas:", error);
    }
}

// Rotas para as páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

// ==========================================
// ROTAS DE API DA APLICAÇÃO
// ==========================================

// 1. Cadastrar nova proposta
app.post('/api/propostas', (req, res) => {
    try {
        let propostas = lerPropostas();
        const novoId = propostas.length > 0 ? Math.max(...propostas.map(p => p.id)) + 1 : 1;

        const novaProposta = {
            id: novoId,
            nome: req.body.nome || 'Cliente Anônimo',
            cpf: req.body.cpf || '---',
            telefone: req.body.telefone || '---',
            valor_desejado: req.body.valor_desejado || 0,
            status: 'Em Análise',
            data_criacao: new Date().toISOString()
        };

        propostas.push(novaProposta);
        salvarPropostasNoArquivo(propostas);
        
        console.log("Proposta salva com sucesso no arquivo:", novaProposta);
        res.status(201).json({ success: true, message: "Proposta salva com sucesso!", id: novaProposta.id });
    } catch (error) {
        console.error("Erro ao salvar proposta:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Listar todas as propostas
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerPropostas();
        res.json({ success: true, data: propostas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Atualizar status de uma proposta
app.put('/api/proposta/:id/status', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        
        let propostas = lerPropostas();
        const proposta = propostas.find(p => p.id === id);
        
        if (proposta) {
            proposta.status = status;
            salvarPropostasNoArquivo(propostas);
            res.json({ success: true, message: "Status atualizado com sucesso!", data: proposta });
        } else {
            res.status(404).json({ success: false, error: "Proposta não encontrada." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Excluir uma proposta
app.delete('/api/proposta/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let propostas = lerPropostas();
        const index = propostas.findIndex(p => p.id === id);
        
        if (index !== -1) {
            propostas.splice(index, 1);
            salvarPropostasNoArquivo(propostas);
            res.json({ success: true, message: "Proposta excluída com sucesso!" });
        } else {
            res.status(404).json({ success: false, error: "Proposta não encontrada." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Geração de Pix Oficial via Mercado Pago
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { valor, descricao, emailCliente, tokenApi } = req.body;

        if (!tokenApi) {
            return res.status(400).json({ success: false, error: "Token da API não fornecido." });
        }

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenApi}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: descricao || 'Entrada FlashCred - Flash Point',
                payment_method_id: 'pix',
                payer: {
                    email: emailCliente || 'cliente@flashcred.com.br'
                }
            })
        });

        const data = await response.json();
        
        if (response.ok && data.point_of_interaction) {
            res.json({
                success: true,
                qr_code: data.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
                payment_id: data.id
            });
        } else {
            res.status(400).json({ success: false, error: data });
        }
    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
