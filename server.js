const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

// Configuração básica do Express
app.use(express.json());
app.use(express.static(__dirname)); // Serve os arquivos HTML/JS da pasta

// 🔑 CONFIGURAÇÃO DO MERCADO PAGO
// Substitua 'SEU_ACCESS_TOKEN_AQUI' pelo seu Access Token real do Mercado Pago (produção ou teste)
const client = new MercadoPagoConfig({ accessToken: 'SEU_ACCESS_TOKEN_AQUI' });

// Rota POST para gerar o Pix que o seu front-end está chamando
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, descricao, referencia } = req.body;

        if (!valor || valor <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "Valor inválido para o Pix." });
        }

        const payment = new Payment(client);
        
        // Dados da cobrança Pix para o Mercado Pago
        const body = {
            transaction_amount: Number(valor),
            description: descricao || "Pagamento FlashCred",
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@email.com', // Pode ser ajustado se tiver o e-mail do cliente
            },
            external_reference: referencia || 'ref_proposta'
        };

        const response = await payment.create({ body });

        // Extrai o código "Copia e Cola" do Pix gerado pelo Mercado Pago
        const qrCode = response.point_of_interaction.transaction_data.qr_code;

        // Retorna sempre em formato JSON válido para o front-end
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

// Porta padrão para o Render ou ambiente local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
