const express = require('express');
const axios = require('axios');
const app = express();
const PORTA = process.env.PORT || 3000;

// 🔑 Token do Mercado Pago (use variável de ambiente no Render!)
const TOKEN_MP = process.env.MP_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

// Permite requisições do seu site
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());

// ✅ Rota que gera o pagamento Pix ou Boleto
app.post('/api/criar-pagamento', async (req, res) => {
    try {
        const { valor, tipo, cpf, nome, descricao } = req.body;

        if (!valor || !tipo || !cpf || !nome) {
            return res.json({ erro: 'Dados incompletos' });
        }

        const metodoPagto = tipo === 'pix' ? 'pix' : 'boleto';
        const nomePartes = nome.split(' ');

        const resposta = await axios.post(
            'https://api.mercadopago.com/v1/payments',
            {
                transaction_amount: Number(valor.toFixed(2)),
                description: descricao || 'Pagamento',
                payment_method_id: metodoPagto,
                payer: {
                    email: 'pagamento@flashcred.com.br',
                    identification: { type: 'CPF', number: cpf },
                    first_name: nomePartes[0] || '---',
                    last_name: nomePartes.slice(1).join(' ') || '---'
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${TOKEN_MP}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const dados = resposta.data;

        if (tipo === 'pix' && dados.point_of_interaction?.transaction_data) {
            res.json({
                sucesso: true,
                qr_code: dados.point_of_interaction.transaction_data.qr_code,
                qr_code_imagem: dados.point_of_interaction.transaction_data.qr_code_base64
            });
        } else if (tipo === 'boleto' && dados.external_resource_url) {
            res.json({
                sucesso: true,
                link_boleto: dados.external_resource_url,
                linha_digitavel: dados.barcode || '---'
            });
        } else {
            res.json({ erro: 'Resposta inesperada do Mercado Pago' });
        }
    } catch (erro) {
        console.error(erro?.response?.data || erro.message);
        res.json({ 
            erro: erro?.response?.data?.message || erro.message || 'Erro desconhecido' 
        });
    }
});

// Rota de teste
app.get('/', (req, res) => {
    res.send('✅ Servidor FlashCred funcionando!');
});

app.listen(PORTA, () => {
    console.log(`🚀 Servidor rodando na porta ${PORTA}`);
});
