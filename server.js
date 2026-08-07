const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/gerar-pix', async (req, res) => {
    // 1. Pega o token das variáveis de ambiente do Render
    const token = process.env.MP_TOKEN;

    // 2. Verificação de segurança (se cair aqui, o erro é no painel do Render)
    if (!token) {
        console.error("ERRO: A variável MP_TOKEN não foi encontrada no Render.");
        return res.status(400).json({ message: "authorization value not present" });
    }

    try {
        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.trim()}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": "ID-" + Date.now()
            },
            body: JSON.stringify(req.body)
        });

        const dados = await respostaMP.json();
        
        if (!respostaMP.ok) {
            return res.status(respostaMP.status).json(dados);
        }

        res.json(dados);
    } catch (erro) {
        res.status(500).json({ message: erro.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
