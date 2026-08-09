const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const mercadopago = require('mercadopago');

const app = express();
const PORTA = process.env.PORT || 3000;

// 🔧 CONFIGURAÇÕES BÁSICAS
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Para servir suas páginas HTML

// 📊 SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_SERVICO_CHAVE = process.env.SUPABASE_SERVICO_CHAVE;

if (!SUPABASE_SERVICO_CHAVE) {
  console.error('❌ ERRO: Variável SUPABASE_SERVICO_CHAVE não configurada!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICO_CHAVE);

// 💳 MERCADO PAGO
const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_TOKEN;
if (!MERCADOPAGO_TOKEN) {
  console.error('❌ ERRO: Variável MERCADOPAGO_TOKEN não configurada!');
  process.exit(1);
}

mercadopago.configure({ access_token: MERCADOPAGO_TOKEN });

// ✅ ROTA: GERAR PIX OFICIAL
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao || 'Pagamento FlashCred',
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    res.json({
      sucesso: true,
      qr_code: pagamento.body.point_of_interaction.transaction_data.qr_code,
      id_pagamento: pagamento.body.id
    });

  } catch (erro) {
    console.error('Erro ao gerar Pix:', erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ✅ ROTA: RECEBER AVISO DE PAGAMENTO (WEBHOOK)
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    const evento = req.body;
    console.log('📩 Aviso recebido MP:', evento);

    if (evento.action === 'payment.updated' && evento.data?.status === 'approved') {
      const ref = evento.data.external_reference;
      console.log('✅ Pagamento aprovado! Ref:', ref);

      await supabase.from('propostas')
        .update({
          entrada_paga: true,
          status_pagamento: 'aprovado',
          data_pagamento: new Date().toISOString(),
          parcelas_pagas: supabase.raw('COALESCE(parcelas_pagas, 0) + 1')
        })
        .or('ultima_cobranca.eq.' + ref + ', id.eq.' + ref);
    }

    res.status(200).send('OK');
  } catch (erro) {
    console.error('Erro Webhook:', erro);
    res.status(500).send('Erro');
  }
});

// 🚀 INICIAR SERVIDOR
app.listen(PORTA, () => {
  console.log(`✅ Servidor rodando na porta ${PORTA}`);
  console.log(`🌐 Site: https://flashcred-sistema.onrender.com`);
});
