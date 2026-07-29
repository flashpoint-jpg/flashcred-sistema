const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json());
app.use(cors());

// Permite servir arquivos estáticos (como o index.html) da mesma pasta
app.use(express.static(__dirname));

// Configurações do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'SUA_SUPABASE_SERVICE_ROLE_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração do Mercado Pago com o seu Token de Acesso
const mpClient = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});

// Rota principal para carregar o seu site (index.html) corretamente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Rota para gerar o Pix via API do Mercado Pago
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { cpf, valor, nome, email } = req.body;

        const payment = new Payment(mpClient);
        
        const body = {
            transaction_amount: parseFloat(valor),
            description: `Entrada Empréstimo - FlashCred (CPF: ${cpf})`,
            payment_method_id: 'pix',
            payer: {
                email: email || 'cliente@flashcred.com',
                first_name: nome || 'Cliente',
                identification: {
                    type: 'CPF',
                    number: cpf.replace(/\D/g, '')
                }
            }
        };

        const response = await payment.create({ body });

        res.json({
            success: true,
            payment_id: response.id,
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error('Erro ao gerar Pix no Mercado Pago:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Rota de Webhook: Atualiza automaticamente o Supabase quando o cliente paga
app.post('/api/webhook', async (req, res) => {
    try {
        const evento = req.body;

        if (evento.type === 'payment' || evento.action === 'payment.created' || evento.data) {
            const paymentId = evento.data?.id || evento.id;
            
            if (paymentId) {
                const payment = new Payment(mpClient);
                const paymentInfo = await payment.get({ id: paymentId });

                if (paymentInfo.status === 'approved') {
                    const descricao = paymentInfo.description || '';
                    const matchCpf = descricao.match(/CPF:\s*([0-9.-]+)/);
                    
                    if (matchCpf && matchCpf[1]) {
                        const cpfLimpo = matchCpf[1].replace(/\D/g, '');
                        
                        const { error } = await supabase
                            .from('propostas')
                            .update({ entrada_paga: true })
                            .eq('cpf', cpfLimpo);

                        if (error) {
                            console.error('Erro ao atualizar Supabase via webhook:', error);
                        } else {
                            console.log(`✅ Sucesso! Entrada marcada como paga para o CPF: ${cpfLimpo}`);
                        }
                    }
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no Webhook:', error);
        res.status(500).send('Erro interno');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
                    
