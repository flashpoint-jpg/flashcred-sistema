const express = require('express');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rotas explícitas para garantir o carregamento das páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'painel.html')));

// Rota Pix /api/criar-pagamento
app.post('/api/criar-pagamento', async (req, res) => {
    try {
        const { valor, descricao, cpf, nome } = req.body;
        if (!valor) return res.status(400).json({ erro: "Valor não informado" });

        const tokenApi = process.env.MERCADO_PAGO_TOKEN;
        if (!tokenApi) {
            return res.status(400).json({ erro: "Token do Mercado Pago não configurado nas variáveis de ambiente do Render." });
        }

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
                payer: { 
                    email: 'cliente@flashcred.com',
                    first_name: nome || 'Cliente'
                }
            })
        });

        const dados = await resposta.json();
        if (resposta.ok && dados.point_of_interaction) {
            res.json({
                success: true,
                qr_code: dados.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: dados.point_of_interaction.transaction_data.qr_code_base64 ? `data:image/png;base64,${dados.point_of_interaction.transaction_data.qr_code_base64}` : null,
                payment_id: dados.id
            });
        } else {
            res.status(400).json({ erro: dados.message || "Erro ao gerar Pix no Mercado Pago" });
        }
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});
