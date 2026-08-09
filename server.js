const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const mercadopago = require('mercadopago');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_SERVICO_CHAVE = process.env.SUPABASE_SERVICO_CHAVE;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICO_CHAVE);

// MERCADO PAGO
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_TOKEN
});

// GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    const pag = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao,
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'contato@flashcred.com.br' }
    });
    res.json({
      sucesso: true,
      qr_code: pag.response.point_of_interaction.transaction_data.qr_code,
      id_pagamento: pag.response.id
    });
  } catch (erro) {
    console.log(erro);
    res.status(500).json({sucesso:false});
  }
});

// WEBHOOK
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    const ev = req.body;
    if(ev.action === 'payment.updated' && ev.data.status === 'approved'){
      const ref = ev.data.external_reference;
      await supabase.from('propostas')
        .update({
          entrada_paga: true,
          data_pagamento: new Date(),
          parcelas_pagas: supabase.raw('COALESCE(parcelas_pagas,0)+1')
        })
        .or('ultima_cobranca.eq.'+ref+', id.eq.'+ref);
    }
    res.send('OK');
  } catch(e){
    res.send('ERRO');
  }
});

// INICIAR
app.listen(PORTA, ()=> console.log('✅ Servidor rodando!'));
