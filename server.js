const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MP_TOKEN = process.env.MERCADO_PAGO_TOKEN;
mercadopago.configure({ access_token: MP_TOKEN });

// ✅ ROTA CORRIGIDA 100% PARA VERSÃO 1.5.15
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao.substring(0,45),
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    // ✅ AQUI ERA O ERRO: PEGAR DENTRO DE .response.body
    const dados = pagamento.response.body;
    const qrCode = dados.point_of_interaction.transaction_data.qr_code;

    if(!qrCode) throw new Error('Sem QR Code');

    res.json({ sucesso: true, qr_code: qrCode });

  } catch (erro) {
    console.error('ERRO:', erro);
    res.json({ sucesso: false, mensagem: erro.message });
  }
});

app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if(req.body.type === 'payment') {
      const pg = await mercadopago.payment.findById(req.body.data.id);
      if(pg.response.body.status === 'approved') {
        console.log('✅ PAGO:', pg.response.body.external_reference);
      }
    }
    res.sendStatus(200);
  } catch { res.sendStatus(500); }
});

app.listen(PORTA, () => console.log('✅ FUNCIONANDO AGORA!'));
