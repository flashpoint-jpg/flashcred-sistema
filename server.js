const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa o Supabase no backend
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rota para gerar o Pix (Entrada ou Parcelas)
app.post('/gerar-pix', async (req, res) => {
    try {
        const token = process.env.MP_TOKEN;
        if (!token) {
            return res.status(400).json({ message: "authorization value not present" });
        }

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
            return res.status(respostaMP.status).json({ message: dados.message || "Erro ao gerar pagamento" });
        }

        res.json(dados);
    } catch (erro) {
        res.status(500).json({ message: erro.message });
    }
});

// Webhook para dar baixa automática nas entradas e parcelas
app.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = data.id;
            const token = process.env.MP_TOKEN;

            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${token.trim()}` }
            });
            const pag = await response.json();

            if (pag.status === 'approved') {
                const ref = pag.external_reference; // Ex: "ID_entrada" ou "ID_parcela_1"
                
                if (ref) {
                    const partes = ref.split('_');
                    const propostaId = partes[0];

                    if (ref.includes('entrada')) {
                        await supabase.from('propostas').update({ entrada_paga: true }).eq('id', propostaId);
                    } else if (ref.includes('parcela')) {
                        const numParcela = parseInt(partes[2]);
                        await supabase.from('propostas').update({ parcelas_pagas: numParcela }).eq('id', propostaId);
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
