const express = require('express');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ SEM O CORS — EXPRESS JÁ RESOLVE TUDO
app.use(express.json());
app.use(express.static(__dirname));

// ✅ SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO JÁ COM SEU TOKEN
mercadopago.configure({
    access_token: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});

// ✅ ROTA DO PIX CORRIGIDA
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const valorLimpo = Number(String(req.body.valor).replace(/[^0-9,.]/g,'').replace(',','.'));
        if(isNaN(valorLimpo) || valorLimpo <=0) throw 'Valor inválido';

        const pagamento = await mercadopago.payment.create({
            transaction_amount: valorLimpo,
            description: req.body.descricao || 'Pagamento FlashCred',
            payment_method_id: 'pix',
            payer: { email: 'flashcred@suporte.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        res.json({sucesso: false, mensagem: erro.message});
    }
});

app.listen(PORTA, () => console.log(`Servidor rodando na porta ${PORTA}`));
