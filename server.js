const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'SUA_SUPABASE_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Mercado Pago (Insira seu Access Token de Produção ou Teste)
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_DO_MERCADO_PAGO' });

// Rota para criar o pagamento Pix dinâmico
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { proposta_id, valor, nome, email } = req.body;

        const payment = new Payment(client);
        const body = {
            transaction_amount: Number(valor),
            description: `Pagamento Proposta FlashCred #${proposta_id}`,
            payment_method_id: 'pix',
            payer: {
                email: email || 'cliente@flashcred.com.br',
                first_name: nome || 'Cliente FlashCred'
            },
            external_reference: String(proposta_id)
        };

        const response = await payment.create({ body });

        res.json({
            sucesso: true,
            payment_id: response.id,
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) {
        console.error('Erro ao gerar Pix MP:', error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// Rota de Webhook para receber a confirmação de pagamento do Mercado Pago (Baixa Automática)
app.post('/api/webhook-pix', async (req, res) => {
    const { action, data } = req.body;

    if (action === 'payment.created' || action === 'payment.updated') {
        try {
            const paymentId = data.id;
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });

            if (paymentInfo.status === 'approved') {
                const propostaId = paymentInfo.external_reference;

                // Busca a proposta no Supabase
                const { data: proposta, err } = await supabase
                    .from('propostas')
                    .select('*')
                    .eq('id', propostaId)
                    .single();

                if (proposta) {
                    // Atualiza automaticamente a entrada ou incrementa parcelas pagas
                    let novasPagas = (proposta.parcelas_pagas || 0) + 1;
                    if (novasPagas > proposta.quantidade_parcelas) {
                        novasPagas = proposta.quantidade_parcelas;
                    }

                    await supabase
                        .from('propostas')
                        .update({ 
                            entrada_paga: true, 
                            parcelas_pagas: novasPagas 
                        })
                        .eq('id', propostaId);

                    console.log(`Baixa automática realizada com sucesso para a proposta ID: ${propostaId}`);
                }
            }
        } catch (err) {
            console.error('Erro no processamento do webhook:', err);
        }
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
