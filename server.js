const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://rgcclordmjmwuzrrfbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2Nsb3JkbWptd3V6cnJmYmQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzg2MDgxNywiZXhwIjoyMDUzNDM2ODE3fQ.sua_chave_completa_aqui'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- CONFIGURAÇÃO DO MERCADO PAGO (PRODUÇÃO) ---
const client = new MercadoPagoConfig({ 
  accessToken: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471' 
});
const payment = new Payment(client);

// --- ROTA DE CADASTRO E GERAÇÃO DE PIX ---
app.post('/api/cadastrar', async (req, res) => {
  try {
    const { nome, email, valor } = req.body;

    const { data: clienteSalvo, error: dbError } = await supabase
      .from('clientes')
      .insert([{ nome, email, valor, status: 'pendente' }])
      .select()
      .single();

    if (dbError) {
      return res.status(400).json({ sucesso: false, erro: dbError.message });
    }

    const bodyMP = {
      transaction_amount: Number(valor || 10.00),
      description: `Pagamento Flashcred - ${nome || 'Cliente'}`,
      payment_method_id: 'pix',
      payer: {
        email: email || 'cliente@flashcred.com',
      },
    };

    const responseMP = await payment.create({ body: bodyMP });
    
    const qrCodeCopiaECola = responseMP.point_of_interaction.transaction_data.qr_code;
    const qrCodeBase64 = responseMP.point_of_interaction.transaction_data.qr_code_base64;
    const paymentId = responseMP.id;

    await supabase
      .from('clientes')
      .update({ 
        payment_id: String(paymentId),
        pix_copia_e_cola: qrCodeCopiaECola 
      })
      .eq('id', clienteSalvo.id);

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Cadastro salvo e Pix gerado com sucesso!',
      qrCodeCopiaECola,
      qrCodeBase64,
      paymentId,
      clienteId: clienteSalvo.id
    });

  } catch (erro) {
    return res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// --- ROTA DE WEBHOOK (NOTIFICAÇÃO AUTOMÁTICA DO MERCADO PAGO) ---
app.post('/api/webhook', async (req, res) => {
  try {
    const evento = req.body;

    if (evento.type === 'payment' || evento.action === 'payment.created' || evento.action === 'payment.updated') {
      const paymentId = evento.data?.id || evento.id;

      if (paymentId) {
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === 'approved') {
          const idDoPagamentoString = String(paymentInfo.id);

          await supabase
            .from('clientes')
            .update({ status: 'pago' })
            .eq('payment_id', idDoPagamentoString);
        }
      }
    }

    return res.status(200).send('OK');

  } catch (erro) {
    return res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
