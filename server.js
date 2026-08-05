const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const MERCADO_PAGO_TOKEN = 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

app.post('/api/criar-pagamento', async (req, res) => {
    try {
        const { valor, tipo, cpf, nome, email } = req.body;
        
        // Define o método de pagamento ('pix' ou 'bolbradesco' para boleto)
        const payment_method_id = tipo === 'pix' ? 'pix' : 'bolbradesco';

        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: Number(valor),
            description: `Entrada Proposta FlashCred`,
            payment_method_id: payment_method_id,
            payer: {
                email: email || "cliente@flashcred.com.br",
                first_name: nome.split(' ')[0],
                last_name: nome.split(' ').slice(1).join(' ') || 'Cliente',
                identification: {
                    type: 'CPF',
                    number: cpf.replace(/\D/g, '')
                }
            }
        }, {
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            }
        });

        res.json({
            success: true,
            id: response.data.id,
            status: response.data.status,
            // Dados do Pix
            qr_code: response.data.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: response.data.point_of_interaction?.transaction_data?.qr_code_base64,
            // Dados do Boleto
            barcode: response.data.barcode?.content,
            external_resource_url: response.data.transaction_details?.external_resource_url
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
