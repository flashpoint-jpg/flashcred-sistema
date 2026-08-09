const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');
const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ Configura o Token do Mercado Pago
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_TOKEN || 'SEU_TOKEN_AQUI'
});

// ✅ ROTA PARA GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao,
      payment_method_id: 'pix',
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      external_reference: referencia,
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    res.json({
      sucesso: true,
      qr_code: pagamento.response.point_of_interaction.transaction_data.qr_code,
      id_pagamento: pagamento.response.id
    });

  } catch (erro) {
    console.error('Erro ao gerar Pix:', erro);
    res.json({ sucesso: false, mensagem: 'Não foi possível gerar o Pix' });
  }
});

// ✅ WEBHOOK PARA RECEBER CONFIRMAÇÃO DE PAGAMENTO
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if(req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if(pg.response.status === 'approved') {
        console.log('✅ PAGAMENTO CONFIRMADO:', pg.response.external_reference);
        // Aqui você atualiza o status no Supabase
      }
    }
    res.sendStatus(200);
  } catch { res.sendStatus(500); }
});

app.listen(PORTA, () => console.log(`✅ Servidor rodando na porta ${PORTA}`));
