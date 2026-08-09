// DENTRO DO SEU server.js, NA ROTA /api/gerar-pix
app.post('/api/gerar-pix', async (req, res) => {
    try {
        // ✅ LIMPEZA ABSOLUTA DO VALOR
        let valorRecebido = req.body.valor;
        // TROCA VÍRGULA POR PONTO, DEIXA SÓ NÚMEROS E PONTO
        const valorLimpo = Number(String(valorRecebido).replace(/[^0-9.]/g, '').replace(',', '.'));
        
        if(isNaN(valorLimpo) || valorLimpo <= 0) {
            return res.json({sucesso: false, mensagem: 'Valor inválido'});
        }

        // ✅ ENVIA PRO MERCADO PAGO COMO NÚMERO PURO, EX: 403.00
        const pagamento = await mercadopago.payment.create({
            transaction_amount: valorLimpo, // AQUI ERA O ERRO! AGORA VAI CERTO
            description: req.body.descricao,
            payment_method_id: 'pix',
            payer: { email: 'flashcred@suport.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: pagamento.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (erro) {
        console.log(erro);
        res.json({sucesso: false, mensagem: erro.message});
    }
});
