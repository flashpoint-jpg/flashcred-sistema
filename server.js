const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const mercadopago = require('mercadopago');

const app = express();
const PORTA = process.env.PORT || 3000;

// 🔧 CONFIGURAÇÕES
app.use(cors());
app.use(express.json());

// SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_SERVICO_CHAVE = process.env.SUPABASE_SERVICO_CHAVE; // Coloque na aba de Variáveis de Ambiente no Render
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICO_CHAVE);

// MERCADO PAGO
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_TOKEN // Coloque seu Token de Produção aqui nas Variáveis do Render
});

// ✅ ROTA PARA GERAR PIX OFICIAL
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, descricao, referencia } = req.body;

        const pagamento = await mercadopago.payment.create({
            transaction_amount: Number(valor),
            description: descricao || 'Pagamento FlashCred',
            payment_method_id: 'pix',
            external_reference: referencia,
            notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
            payer: { email: 'pagamento@flashcred.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.body.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
            id_pagamento: pagamento.body.id
        });

    } catch (erro) {
        console.error('Erro ao gerar Pix:', erro);
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// ✅ ROTA DO WEBHOOK (RECEBE AVISO DE PAGAMENTO)
app.post('/api/webhook-mercadopago', async (req, res) => {
    try {
        const evento = req.body;
        console.log('📩 Aviso recebido do Mercado Pago:', evento);

        if (evento.action === 'payment.updated' && evento.data?.status === 'approved') {
            const referencia = evento.data.external_reference;
            console.log('✅ Pagamento aprovado! Ref:', referencia);

            // Atualiza no Supabase
            await supabase.from('propostas')
                .update({
                    entrada_paga: true,
                    status_pagamento: 'aprovado',
                    data_pagamento: new Date().toISOString(),
                    parcelas_pagas: supabase.raw('parcelas_pagas + 1')
                })
                .or('ultima_cobranca.eq.' + referencia + ', id.eq.' + referencia);
        }

        res.status(200).send('OK');
    } catch (erro) {
        console.error('Erro no Webhook:', erro);
        res.status(500).send('Erro');
    }
});

app.listen(PORTA, () => console.log(`🚀 Servidor rodando na porta ${PORTA}`));
