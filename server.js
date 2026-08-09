const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ HABILITA ACESSO E DADOS JSON
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ CONFIGURAÇÕES
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ COLOQUE SEU TOKEN DE PRODUÇÃO AQUI OU NAS VARIAVEIS DO RENDER
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_TOKEN || 'SEU_TOKEN_PRODUCAO_AQUI'
});

// ✅ ROTA PRINCIPAL PARA GERAR PIX
app.post('/api/gerar-pix', async (req, res) => {
  try {
    const { valor, descricao, referencia } = req.body;
    console.log('🔹 Gerando Pix:', { valor, descricao
