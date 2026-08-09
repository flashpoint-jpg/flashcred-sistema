const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// Configurações obrigatórias
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Dados do Supabase
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Token Mercado Pago (coloque nas VARIÁVEIS do Render, nunca deixe direto aqui em produção!)
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_TOKEN || 'COLOQUE_AQUI_SEU_TOKEN_DE_PRODUCAO'
});

// ROTA PARA GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Gerando Pix:', { valor, descricao, referencia });

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao,
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    const qrCode = pagamento?.response?.point_of_interaction?.transaction_data?.qr_code;
    if (!qrCode) throw new Error('API não retornou o QR Code');

    console.log('✅ PIX GERADO COM SUCESSO');
    res.json({ sucesso: true, qr_code: qrCode });

  } catch (erro) {
    console.error('❌ ERRO NO SERVIDOR:', erro);
    res.json({ sucesso: false, mensagem: erro.message || 'Falha ao gerar Pix' });
  }
});

// ROTA PARA RECEBER CONFIRMAÇÃO DE PAGAMENTO
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if (req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if (pg.response.status === 'approved') {
        const ref = pg.response.external_reference;
        console.log('✅ PAGAMENTO CONFIRMADO:', ref);
        // Aqui adiciona o código para marcar parcela como paga no Supabase
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// INICIA O SERVIDOR
app.listen(PORTA, () => console.log(`✅ SERVIDOR FLASHCRED RODANDO NA PORTA ${PORTA}`));
