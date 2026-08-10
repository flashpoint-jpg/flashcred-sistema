const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ CONFIGURAÇÕES GERAIS
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// ✅ PÁGINA INICIAL AUTOMÁTICA
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ✅ SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO — VERSÃO NOVA CORRIGIDA
const mpConfig = new MercadoPagoConfig({
    accessToken: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});
const pagamentoServico = new Payment(mpConfig);

// ✅ ROTA DE GERA PIX — LIMPEZA DE VALOR E TUDO
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const valorLimpo = Number(
            String(req.body.valor)
            .replace(/[^0-9,.]/g, '')
            .replace(',', '.')
        );

        if(isNaN(valorLimpo) || valorLimpo <= 0) {
            return res.json({sucesso: false, mensagem: 'Valor inválido'});
        }

        const pagamento = await pagamentoServico.create({
            body: {
                transaction_amount: valorLimpo,
                description: req.body.descricao || 'Pagamento FlashCred',
                payment_method_id: 'pix',
                payer: { email: 'flashcred@suporte.com.br' }
            }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error('ERRO:', erro);
        res.json({sucesso: false, mensagem: erro.message});
    }
});

app.listen(PORTA, () => {
    console.log('✅ FlashCred rodando perfeitamente!');
});
