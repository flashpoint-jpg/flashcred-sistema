const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// Habilita tudo
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurações
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

// Token Mercado Pago (coloque nas variáveis do Render ou direto aqui)
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_TOKEN || 'COLOQUE_SEU_TOKEN_DE_PRODUCAO_AQUI'
});

// ROTA GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Requisição gerar Pix:', { valor, descricao, referencia });

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao,
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    const qrCode = pagamento?.response?.point_of_interaction?.transaction_data?.qr_code;
    if (!qrCode) throw new Error('Não retornou o QR Code');

    console.log('✅ Pix gerado com sucesso');
    res.json({ sucesso: true, qr_code: qrCode });

  } catch (erro) {
    console.error('❌ ERRO:', erro);
    res.json({ sucesso: false, mensagem: erro.message || 'Falha ao gerar Pix' });
  }
});

// ROTA WEBHOOK PARA RECEBER CONFIRMAÇÃO
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if (req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if (pg.response.status === 'approved') {
        const ref = pg.response.external_reference;
        console.log('✅ PAGAMENTO CONFIRMADO:', ref);
        // Aqui você atualiza o status no Supabase se quiser
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// INICIA O SERVIDOR
app.listen(PORTA, () => console.log(`✅ SERVIDOR RODANDO NA PORTA ${PORTA}`));
