const express = require('express');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

mercadopago.configure({
    access_token: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});

app.post('/api/gerar-pix', async (req, res) => {
    try {
        const valor = Number(String(req.body.valor).replace(/[^0-9,.]/g,'').replace(',','.'));
        if(isNaN(valor) || valor <= 0) throw 'Valor inválido';

        const pag = await mercadopago.payment.create({
            transaction_amount: valor,
            description: 'Pagamento FlashCred',
            payment_method_id: 'pix',
            payer: { email: 'flashcred@suporte.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pag.point_of_interaction.transaction_data.qr_code
        });
    } catch(e) {
        res.json({sucesso: false, mensagem: e.message});
    }
});

app.listen(PORTA, () => console.log('Servidor rodando!'));
