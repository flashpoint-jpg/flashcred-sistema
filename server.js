const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ TOKEN CARREGADO DIRETO
const MP_TOKEN = process.env.MERCADO_PAGO_TOKEN;
console.log('🔹 Token carregado:', MP_TOKEN ? 'SIM' : 'NAO');

mercadopago.configure({ access_token: MP_TOKEN });

// ✅ ROTA TESTADA E FUNCIONAL
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Gerando Pix:', { valor, descricao, referencia });

    // CRIA PAGAMENTO DO JEITO CERTO
    const resultado = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao.substring(0, 40),
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    // ✅ FORMA GARANTIDA DE PEGAR O QR CODE
    const dados = resultado.body || resultado.response;
    const qrCode = dados?.point_of_interaction?.transaction_data?.qr_code;
    const qrCopiar = dados?.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode) {
      console.error('❌ Resposta completa:', JSON.stringify(dados, null, 2));
      throw new Error('Não foi possível gerar o QR Code');
    }

    console.log('✅ PIX GERADO COM SUCESSO!');
    res.json({
      sucesso: true,
      qr_code: qrCode,
      qr_copia_cola: qrCopiar
    });

  } catch (erro) {
    console.error('❌ ERRO FINAL:', erro);
    res.json({
      sucesso: false,
      mensagem: erro.message || 'Falha ao conectar no Mercado Pago'
    });
  }
});

// WEBHOOK
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if (req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if (pg.body.status === 'approved') {
        console.log('✅ PAGAMENTO CONFIRMADO:', pg.body.external_reference);
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(PORTA, () => console.log(`✅ SERVIDOR FLASHCRED 100% ONLINE`));
