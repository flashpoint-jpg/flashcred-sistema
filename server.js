const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares essenciais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public (HTML, imagens, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Banco de dados em memória (ou array temporário para armazenamento)
let propostas = [];
let contadorId = 1;

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para a página de consulta
app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

// Rota para o painel administrativo
app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

// ==========================================
// ROTAS DE API DA APLICAÇÃO
// ==========================================

// 1. Cadastrar nova proposta (Salvando no servidor)
app.post('/api/propostas', (req, res) => {
    try {
        const novaProposta = {
            id: contadorId++,
            nome: req.body.nome || 'Cliente Anônimo',
            cpf: req.body.cpf || '---',
            telefone: req.body.telefone || '---',
            valor_desejado: req.body.valor_desejado || 0,
            status: 'Em Análise',
            data_criacao: new Date().toISOString()
        };

        propostas.push(novaProposta);
        console.log("Proposta salva com sucesso:", novaProposta);
        
        res.status(201).json({ 
            success: true, 
            message: "Proposta salva com sucesso!",
            id: novaProposta.id 
        });
    } catch (error) {
        console.error("Erro ao salvar proposta:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Listar todas as propostas cadastradas
app.get('/api/propostas', (req, res) => {
    try {
        res.json({ success: true, data: propostas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Atualizar status de uma proposta (Aprovada/Recusada)
app.put('/api/proposta/:id/status', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        
        const proposta = propostas.find(p => p.id === id);
        if (proposta) {
            proposta.status = status;
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
        const index = propostas.findIndex(p => p.id === id);
        
        if (index !== -1) {
            propostas.splice(index, 1);
            res.json({ success: true, message: "Proposta excluída com sucesso!" });
        } else {
            res.status(404).json({ success: false, error: "Proposta não encontrada." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Rota para criação de Pix Oficial via API do Mercado Pago
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

// Inicialização segura do servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
