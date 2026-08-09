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

// MERCADO PAGO — VERIFIQUE SE É TOKEN DE PRODUÇÃO!
const MP_TOKEN = process.env.MERCADO_PAGO_TOKEN;
if(!MP_TOKEN) console.error('❌ FALTA O TOKEN DO MERCADO PAGO NAS VARIÁVEIS!');
mercadopago.configure({ access_token: MP_TOKEN });

// ROTA GERAR PIX — CORRIGIDA PARA PEGAR O QR CODE DE FORMA SEGURA
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Gerando Pix:', { valor, descricao, referencia });

    const pagamento = await mercadopago.payment.create({
      transaction_amount: Number(valor),
      description: descricao.substring(0,50), // Limita tamanho para não dar erro
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    // Forma garantida de pegar o QR Code
    const dadosTransacao = pagamento?.response?.point_of_interaction?.transaction_data;
    if(!dadosTransacao || !dadosTransacao.qr_code) {
      console.error('❌ Resposta da MP:', pagamento.response);
      throw new Error('Mercado Pago não retornou o QR Code');
    }

    console.log('✅ PIX GERADO COM SUCESSO!');
    res.json({ sucesso: true, qr_code: dadosTransacao.qr_code });

  } catch (erro) {
    console.error('❌ ERRO:', erro);
    res.json({ 
      sucesso: false, 
      mensagem: erro.message || 'Falha ao gerar Pix' 
    });
  }
});

// WEBHOOK
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    if (req.body.type === 'payment') {
      const idPag = req.body.data.id;
      const pg = await mercadopago.payment.findById(idPag);
      if (pg.response.status === 'approved') {
        const ref = pg.response.external_reference;
        console.log('✅ PAGAMENTO CONFIRMADO:', ref);
        // Atualiza status no Supabase aqui
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(PORTA, () => console.log(`✅ SERVIDOR RODANDO NA PORTA ${PORTA}`));
