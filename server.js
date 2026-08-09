const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MP_TOKEN = process.env.MERCADO_PAGO_TOKEN;

app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 VALOR:', valor);
    console.log('🔹 DESCRICAO:', descricao || 'Sem descrição');
    console.log('🔹 REF:', referencia);

    // ✅ CORRIGIDO: SE DESCRICAO FOR VAZIA, USA TEXTO PADRÃO
    const textoDescricao = (descricao || 'Pagamento FlashCred').substring(0,40);

    const corpo = JSON.stringify({
      transaction_amount: Number(valor),
      description: textoDescricao,
      payment_method_id: 'pix',
      external_reference: referencia || `pag_${Date.now()}`,
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
        'Content-Length': Buffer.byteLength(corpo)
      }
    };

    const requisicao = https.request(opcoes, (resp) => {
      let respostaCrua = '';
      resp.on('data', p => respostaCrua += p);
      resp.on('end', () => {
        console.log('🔹 RESPOSTA MP:', respostaCrua);
        const dados = JSON.parse(respostaCrua);

        if(dados.error) return res.json({ sucesso: false, mensagem: dados.message || dados.error });

        const qr = dados?.point_of_interaction?.transaction_data?.qr_code;
        if(!qr) return res.json({ sucesso: false, mensagem: 'QR Code não encontrado' });

        res.json({ sucesso: true, qr_code: qr });
      });
    });

    requisicao.on('error', e => res.json({ sucesso: false, mensagem: e.message }));
    requisicao.write(corpo);
    requisicao.end();

  } catch(e) {
    console.error('❌ ERRO:', e);
    res.json({ sucesso: false, mensagem: e.message });
  }
});

app.post('/api/webhook-mercadopago', (req,res)=>res.sendStatus(200));

app.listen(PORTA, ()=>console.log('✅ AGORA VAI DAR CERTO!'));
