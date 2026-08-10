const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal corrigida para ler o arquivo HTML dentro da pasta 'public'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔑 CONFIGURAÇÃO DO MERCADO PAGO
// Substitua pelo seu Access Token real de produção ou testes
const client = new MercadoPagoConfig({ accessToken: 'SEU_ACCESS_TOKEN_AQUI' });

// Rota POST para gerar o Pix
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, descricao, referencia } = req.body;

        if (!valor || valor <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "Valor inválido para o Pix." });
        }

        const payment = new Payment(client);
        
        const body = {
            transaction_amount: Number(valor),
            description: descricao || "Pagamento FlashCred",
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@flashcred.com',
            },
            external_reference: referencia || 'ref_proposta'
        };

        const response = await payment.create({ body });

        const qrCode = response.point_of_interaction?.transaction_data?.qr_code;

        if (!qrCode) {
            throw new Error("O Mercado Pago não retornou o código QR Code.");
        }

        return res.status(200).json({
            sucesso: true,
            qr_code: qrCode,
            payment_id: response.id
        });

    } catch (error) {
        console.error("Erro ao gerar Pix no Mercado Pago:", error);
        return res.status(500).json({ 
            sucesso: false, 
            mensagem: error.message || "Erro interno ao processar o Pix." 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
