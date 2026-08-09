const express = require('express');
const cors = require('cors');
const https = require('https'); // ✅ VAMOS CHAMAR A API DIRETO, SEM A BIBLIOTECA
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

// ✅ ROTA 100% GARANTIDA — CHAMA A API DIRETO
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Gerando Pix:', { valor, descricao, referencia });

    const dadosPagamento = JSON.stringify({
      transaction_amount: Number(valor),
      description: descricao.substring(0, 45),
      payment_method_id: 'pix',
      external_reference: referencia,
      notification_url: 'https://flashcred-sistema.onrender.com/api/webhook-mercadopago',
      payer: { email: 'pagamento@flashcred.com.br' }
    });

    const opcoes = {
      hostname: 'api.mercadopago.com',
      path: '/v1/payments',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dadosPagamento)
      }
    };

    const requisicao = https.request(opcoes, (resp) => {
      let corpo = '';
      resp.on('data', (pedaco) => corpo += pedaco);
      resp.on('end', () => {
        const resultado = JSON.parse(corpo);
        console.log('🔹 Resposta da MP:', resultado);

        if(resultado.error) throw new Error(resultado.message || resultado.error);

        const qrCode = resultado.point_of_interaction?.transaction_data?.qr_code;
        if(!qrCode) throw new Error('QR Code não encontrado na resposta');

        res.json({ sucesso: true, qr_code: qrCode });
      });
    });

    requisicao.on('error', (erro) => {
      console.error('❌ ERRO NA REQUISIÇÃO:', erro);
      res.json({ sucesso: false, mensagem: erro.message });
    });

    requisicao.write(dadosPagamento);
    requisicao.end();

  } catch (erro) {
    console.error('❌ ERRO GERAL:', erro);
    res.json({ sucesso: false, mensagem: erro.message });
  }
});

// WEBHOOK
app.post('/api/webhook-mercadopago', async (req, res) => {
  res.sendStatus(200);
});

app.listen(PORTA, () => console.log('✅ AGORA VAI!'));
