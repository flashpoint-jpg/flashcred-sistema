const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ HABILITA TUDO ANTES DE TUDO
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO — VERIFIQUE A VARIAVEL NO RENDER!
const MP_TOKEN = process.env.MERCADO_PAGO_TOKEN;
if (!MP_TOKEN) {
  console.error('❌ ERRO: COLOQUE O TOKEN DE PRODUÇÃO NAS VARIAVEIS DO RENDER!');
} else {
  mercadopago.configure({ access_token: MP_TOKEN });
}

// ✅ ROTA GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    if (!MP_TOKEN) return res.json({ sucesso: false, mensagem: 'Token do Mercado Pago não configurado' });

    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Requisição Pix:', { valor, descricao, referencia });

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao.substring(0, 50),
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    const qrDados = pagamento?.response?.point_of_interaction?.transaction_data;
    if (!qrDados?.qr_code) throw new Error('QR Code não retornado pela API');

    console.log('✅ PIX GERADO COM SUCESSO');
    res.json({ sucesso: true, qr_code: qrDados.qr_code });

  } catch (erro) {
    console.error('❌ ERRO:', erro);
    res.json({ sucesso: false, mensagem: erro.message || 'Falha ao gerar Pix' });
  }
});

// ✅ WEBHOOK
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if (req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if (pg.response.status === 'approved') {
        console.log('✅ PAGAMENTO CONFIRMADO:', pg.response.external_reference);
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// ✅ INICIA SERVIDOR
app.listen(PORTA, () => console.log(`✅ SERVIDOR FLASHCRED ONLINE NA PORTA ${PORTA}`));
