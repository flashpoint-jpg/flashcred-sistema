const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Caminho correto para pasta public
app.use(express.static(path.join(__dirname, 'public')));

// ✅ TOKEN EXATO — COPIADO DIRETO DA SUA TELA DO MERCADO PAGO
const MP_TOKEN = 'APP_USR-8158139097874832-0727';

// ✅ ROTA FORÇANDO O ENVIO DO TOKEN
app.post('/gerar-pix', async (req, res) => {
    try {
        const corpo = req.body;
        const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(corpo)
        });

        const retorno = await resposta.json();
        res.status(resposta.status).json(retorno);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

app.listen(PORTA, () => console.log('✅ SERVIDOR PRONTO COM TOKEN ATIVO!'));
