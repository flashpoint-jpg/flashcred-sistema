// server.js - Código Corrigido e Completo
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fetch = require('node-fetch'); // Importação necessária se não estiver usando Node v18+

const app = express();
app.use(cors()); // Importante para o front-end conseguir acessar a API
app.use(express.json());

// 1. Servir arquivos estáticos (HTML, CSS, JS do cliente)
// Coloque todos os seus arquivos HTML/CSS/JS na pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 2. Configuração Supabase
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'SUA_CHAVE_SERVICE_ROLE_AQUI';
if (SUPABASE_SERVICE_ROLE_KEY === 'SUA_CHAVE_SERVICE_ROLE_AQUI') {
    console.error("AVISO: A chave do Supabase não foi configurada nas variáveis de ambiente do Render.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 3. SEU TOKEN DO MERCADO PAGO
const MERCADO_PAGO_TOKEN = process.env.MP_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

// 4. Rotas da API do Servidor

// Rota para gerar o Pix real
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { valor, propostaId, nome } = req.body;

        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MERCADO_PAGO_TOKEN.trim()}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": `proposta_${propostaId}_${Date.now()}`
            },
            body: JSON.stringify({
                transaction_amount: Number(valor),
                description: `Proposta FlashCred #${propostaId} - ${nome}`,
                payment_method_id: 'pix',
                payer: {
                    email: `cliente_${propostaId}@flashcred.com`
                },
                external_reference: String(propostaId)
            })
        });

        const dados = await respostaMP.json();
        
        if (!respostaMP.ok || !dados.point_of_interaction) {
            throw new Error(dados.message || "Erro ao gerar Pix no MP");
        }

        return res.json({
            sucesso: true,
            qrcode: dados.point_of_interaction.transaction_data.qr_code_base64,
            copia_cola: dados.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error("Erro Pix:", erro);
        return res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota de Webhook (Baixa Automática)
app.post('/api/webhook-pix', async (req, res) => {
    try {
        const evento = req.body;
        console.log("Webhook recebido:", evento);

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
                        const { error } = await supabase.from('propostas')
                            .update({ 
                                entrada_paga: true, 
                                status: 'Em Andamento',
                                data_aprovacao_entrada: new Date().toISOString()
                            })
                            .eq('id', propostaId);
                        
                        if(error) throw error;
                        console.log(`✅ Proposta ${propostaId} atualizada pelo Webhook.`);
                    }
                }
            }
        }
        res.status(200).send('OK');
    } catch (erro) {
        console.error('Erro Webhook:', erro);
        res.status(500).send('Erro');
    }
});

// 5. Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
