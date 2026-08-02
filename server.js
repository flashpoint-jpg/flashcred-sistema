const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ARQUIVO_DADOS = path.join(__dirname, 'propostas.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Funções de salvamento seguro
function lerPropostas() {
    try {
        if (fs.existsSync(ARQUIVO_DADOS)) {
            const dados = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
            return JSON.parse(dados);
        }
    } catch (e) {
        console.error("Erro ao ler propostas:", e);
    }
    return [];
}

function salvarPropostas(lista) {
    try {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar propostas:", e);
    }
}

// Rotas de Páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

// Rotas da API
app.post('/api/propostas', (req, res) => {
    try {
        let propostas = lerPropostas();
        const novoId = propostas.length > 0 ? Math.max(...propostas.map(p => p.id)) + 1 : 1;

        const novaProposta = {
            id: novoId,
            nome: req.body.nome || 'Cliente',
            cpf: req.body.cpf || '---',
            telefone: req.body.telefone || '---',
            valor_desejado: req.body.valor_desejado || 0,
            status: 'Em Análise',
            data_criacao: new Date().toISOString()
        };

        propostas.push(novaProposta);
        salvarPropostas(propostas);
        
        res.status(201).json({ success: true, message: "Proposta salva!", id: novaProposta.id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerPropostas();
        res.json({ success: true, data: propostas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/proposta/:id/status', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        let propostas = lerPropostas();
        const p = propostas.find(item => item.id === id);
        if (p) {
            p.status = status;
            salvarPropostas(propostas);
            res.json({ success: true, data: p });
        } else {
            res.status(404).json({ success: false, error: "Não encontrada" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/proposta/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let propostas = lerPropostas();
        const index = propostas.findIndex(item => item.id === id);
        if (index !== -1) {
            propostas.splice(index, 1);
            salvarPropostas(propostas);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: "Não encontrada" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota Pix Mercado Pago
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { valor, descricao, emailCliente, tokenApi } = req.body;
        if (!tokenApi) return res.status(400).json({ success: false, error: "Token ausente" });

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenApi}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: descricao || 'Entrada FlashCred',
                payment_method_id: 'pix',
                payer: { email: emailCliente || 'cliente@flashcred.com' }
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
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
