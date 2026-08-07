const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ ISSO AQUI FAZ O SERVIDOR ENTREGAR TODOS OS ARQUIVOS DA PASTA
app.use(express.static(path.join(__dirname)));

// ✅ SEU TOKEN
const MP_TOKEN = 'APP_USR-8158139097874832-0727';

// ✅ ROTA DO PIX
app.post('/gerar-pix', async (req, res) => {
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
        res.status(resposta.status).json(dados);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// ✅ SE ALGUMA ROTA NÃO EXISTIR, MANDA PARA A PÁGINA PRINCIPAL
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'consultar.html'));
});

app.listen(PORTA, () => console.log('✅ Servidor online e funcionando!'));
