const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MERCADO_PAGO_TOKEN = process.env.MP_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

// Rota oficial para gerar Pix real via API do Mercado Pago
app.post('/gerar-pix', async (req, res) => {
    try {
        const { valor, propostaId, nome } = req.body;
        const valorNumerico = Number(String(valor).replace(',', '.'));

        if (!valorNumerico || isNaN(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({ sucesso: false, erro: "Valor de transação inválido." });
        }

        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MERCADO_PAGO_TOKEN.trim()}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": `proposta_${propostaId}_${Date.now()}`
            },
            body: JSON.stringify({
                transaction_amount: valorNumerico,
                description: `Proposta FlashCred #${propostaId} - ${nome || 'Cliente'}`,
                payment_method_id: 'pix',
                payer: {
                    email: `cliente_${propostaId}@flashcred.com`
                },
                external_reference: String(propostaId)
            })
        });

        const dados = await respostaMP.json();
        
        if (!respostaMP.ok || !dados.point_of_interaction) {
            return res.status(400).json({ sucesso: false, erro: dados.message || "Erro ao gerar pagamento no Mercado Pago" });
        }

        return res.status(200).json({
            sucesso: true,
            qrcode: dados.point_of_interaction.transaction_data.qr_code_base64,
            copia_cola: dados.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error("Erro interno ao gerar Pix:", erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor" });
    }
});

// Webhook para baixa automática
app.post('/api/webhook-pix', async (req, res) => {
    try {
        const evento = req.body;

        if (evento.type === 'payment' || (evento.action && evento.action.includes('payment'))) {
            const paymentId = evento.data?.id;

            if (paymentId) {
                const respPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: { 'Authorization': `Bearer ${MERCADO_PAGO_TOKEN.trim()}` }
                });
                const pagamento = await respPagamento.json();

                if (pagamento.status === 'approved') {
                    const propostaId = pagamento.external_reference;

                    if (propostaId) {
                        await supabase.from('propostas')
                            .update({ 
                                entrada_paga: true, 
                                status: 'Em Andamento',
                                data_aprovacao_entrada: new Date().toISOString()
                            })
                            .eq('id', propostaId);
                        
                        console.log(`✅ Proposta ${propostaId} paga e atualizada automaticamente!`);
                    }
                }
            }
        }

        return res.status(200).send('OK');
    } catch (erro) {
        console.error('Erro no Webhook:', erro);
        return res.status(500).send('Erro interno');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
