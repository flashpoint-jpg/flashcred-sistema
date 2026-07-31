const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://rgcclordmjmwuzrrfbd.supabase.co';
// Chave anon/public correta do seu projeto Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2Nsb3JkbWptd3V6cnJmYmQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzg2MDgxNywiZXhwIjoyMDUzNDM2ODE3fQ.sua_chave_completa_aqui'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- CONFIGURAÇÃO DO MERCADO PAGO (PRODUÇÃO) ---
const client = new MercadoPagoConfig({ 
  accessToken: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471' 
});
const payment = new Payment(client);

// Rota para receber o cadastro do cliente e salvar no Supabase
app.post('/api/cadastrar', async (req, res) => {
  try {
    const { nome, email, valor } = req.body;

    console.log('Recebendo cadastro:', { nome, email, valor });

    // 1. Insere o cliente na tabela do Supabase
    const { data: clienteSalvo, error: dbError } = await supabase
      .from('clientes')
      .insert([{ nome, email, valor, status: 'pendente' }])
      .select()
      .single();

    if (dbError) {
      console.error('Erro ao salvar no Supabase:', dbError);
      return res.status(400).json({ sucesso: false, erro: dbError.message });
    }

    // 2. Gera o Pix real no Mercado Pago de Produção
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

    // 3. Atualiza o registro com o ID do pagamento do Mercado Pago
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
    console.error('Erro geral no servidor:', erro);
    return res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
