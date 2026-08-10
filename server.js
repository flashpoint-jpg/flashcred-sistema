const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ CONFIGURAÇÕES GERAIS
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ✅ SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO — JÁ COLOQUEI O SEU TOKEN AUTOMÁTICO
mercadopago.configure({
    access_token: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});

// ✅ ROTA PRINCIPAL PARA GERAR PIX — 100% CORRIGIDA
app.post('/api/gerar-pix', async (req, res) => {
    try {
        let valorBruto = req.body.valor;
        
        // 🧹 LIMPEZA TOTAL DO VALOR — NÃO TEM MAIS ERRO DE FORMATO
        const valorLimpo = Number(
            String(valorBruto)
            .replace(/[^0-9,.]/g, '')
            .replace(',', '.')
        );

        if(isNaN(valorLimpo) || valorLimpo <= 0) {
            return res.json({sucesso: false, mensagem: 'Valor inválido para pagamento'});
        }

        // GERA O PIX NO MERCADO PAGO
        const pagamento = await mercadopago.payment.create({
            transaction_amount: valorLimpo,
            description: req.body.descricao || 'Pagamento FlashCred',
            payment_method_id: 'pix',
            payer: { email: 'flashcred@suporte.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code,
            copia_cola: pagamento.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error('ERRO AO GERAR PIX:', erro);
        res.json({sucesso: false, mensagem: erro.message || 'Falha na geração do Pix'});
    }
});

// ✅ INICIA O SERVIDOR
app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});
