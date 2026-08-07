const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Caminho correto para os arquivos na pasta public
app.use(express.static(path.join(__dirname, 'public')));

// ✅ SEU TOKEN EXATO, COPIADO DA TELA DO MERCADO PAGO
const MP_TOKEN = 'APP_USR-8158139097874832-0727';

// ✅ ROTA DO PIX COM AUTORIZAÇÃO GARANTIDA
app.post('/gerar-pix', async (req, res) => {
    try {
        console.log('Gerando Pix com token:', MP_TOKEN);

        const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const dados = await resposta.json();
        console.log('Resposta MP:', resposta.status, dados);
        
        res.status(resposta.status).json(dados);
    } catch (erro) {
        console.error('Erro interno:', erro);
        res.status(500).json({ erro: erro.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consultar.html'));
});

app.listen(PORTA, () => console.log('✅ Servidor online com token configurado!'));
