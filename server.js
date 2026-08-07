const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Arquivos na pasta PUBLIC
app.use(express.static(path.join(__dirname, 'public')));

// ✅ SEU TOKEN — COPIADO EXATO
const MP_TOKEN = 'APP_USR-8158139097874832-0727';

// ✅ ROTA DO PIX — OBRIGATÓRIA
app.post('/gerar-pix', async (req, res) => {
    console.log('Recebido pedido de Pix');
    try {
        const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        const dados = await resposta.json();
        console.log('Resposta Mercado Pago:', dados);
        res.status(resposta.status).json(dados);
    } catch (erro) {
        console.error('Erro:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

app.listen(PORTA, () => console.log('✅ SERVIDOR ATIVO — TOKEN CONFIGURADO!'));
