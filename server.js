const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const ARQUIVO_DADOS = path.join(__dirname, 'propostas.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Garante que o arquivo de dados existe
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, '[]', 'utf8');
}

function lerPropostas() {
    try {
        const dados = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
        return JSON.parse(dados);
    } catch (e) {
        console.error("Erro ao ler propostas:", e.message);
        return [];
    }
}

function salvarPropostas(lista) {
    try {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(lista, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar:", e.message);
    }
}

// Páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/consultar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'consultar.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'painel.html')));

// API Propostas
app.post('/api/propostas', (req, res) => {
    try {
        let propostas = lerPropostas();
        const novoId = propostas.length > 0 ? Math.max(...propostas.map(p => p.id)) + 1 : 1;
        const nova = {
            id: novoId,
            nome: req.body.nome || 'Cliente',
            cpf: req.body.cpf || '---',
            telefone: req.body.telefone || '---',
            valor_desejado: parseFloat(req.body.valor_desejado) || 0,
            status: 'Em Análise',
            data_criacao: new Date().toISOString(),
            entrada_paga: false,
            valor_entrada: 0
        };
        propostas.push(nova);
        salvarPropostas(propostas);
        res.status(201).json({ success: true, id: novoId });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/propostas', (req, res) => {
    try {
        res.json({ success: true, data: lerPropostas() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/proposta/:id/status', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status, entrada_paga, valor_entrada } = req.body;
        const lista = lerPropostas();
        const item = lista.find(i => i.id === id);
        if (!item) return res.status(404).json({ success: false });
        
        if(status) item.status = status;
        if(typeof entrada_paga !== 'undefined') item.entrada_paga = entrada_paga;
        if(valor_entrada) item.valor_entrada = valor_entrada;
        salvarPropostas(lista);
        res.json({ success: true, data: item });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/proposta/:id', (req, res) => {
    try {
        const lista = lerPropostas();
        const index = lista.findIndex(i => i.id === parseInt(req.params.id));
        if (index === -1) return res.status(404).json({ success: false });
        lista.splice(index, 1);
        salvarPropostas(lista);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Rota Pix Mercado Pago
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { valor, descricao, emailCliente, tokenApi } = req.body;
        if (!tokenApi || !valor) return res.status(400).json({ success: false, error: "Dados incompletos" });

        const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
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

        const dados = await resposta.json();
        if (resposta.ok && dados.point_of_interaction) {
            res.json({
                success: true,
                qr_code: dados.point_of_interaction.transaction_data.qr_code,
                payment_id: dados.id
            });
        } else {
            res.status(400).json({ success: false, error: dados.message || "Erro Mercado Pago" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Inicialização OBRIGATÓRIA para o Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});
