const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Faz o servidor entregar seus arquivos HTML, CSS, JS
app.use(express.static(__dirname));

// ✅ SEU TOKEN DE PRODUÇÃO
const MP_TOKEN = 'APP_USR-8158139097874832-0727';

// ✅ Rota para gerar Pix (resolvendo o bloqueio)
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

// ✅ Se acessar qualquer endereço, leva para a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORTA, () => console.log(`✅ Servidor rodando perfeitamente na porta ${PORTA}`));
