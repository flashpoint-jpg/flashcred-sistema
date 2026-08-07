const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/gerar-pix', async (req, res) => {
    const token = process.env.MP_TOKEN;

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
            console.error("Erro do Mercado Pago:", dados);
            return res.status(respostaMP.status).json({ message: dados.message || "Erro ao gerar pagamento" });
        }

        res.json(dados);
    } catch (erro) {
        console.error("Erro interno:", erro);
        res.status(500).json({ message: erro.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
