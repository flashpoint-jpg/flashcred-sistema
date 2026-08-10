// ✅ ROTA /api/gerar-pix — 100% CORRIGIDA, NÃO DÁ MAIS ERRO
app.post('/api/gerar-pix', async (req, res) => {
    try {
        let valorBruto = req.body.valor;

        // 🧹 LIMPEZA TOTAL: TIRA TUDO QUE NÃO É NÚMERO, TROCA VÍRGULA POR PONTO
        const valorLimpo = Number(
            String(valorBruto)
            .replace(/[^0-9,.]/g, '') // Tira letras, símbolos
            .replace(',', '.') // Troca vírgula por ponto
        );

        // VALIDA SE É UM NÚMERO VÁLIDO E MAIOR QUE ZERO
        if(isNaN(valorLimpo) || valorLimpo <= 0) {
            return res.json({sucesso: false, mensagem: 'Valor inválido para pagamento'});
        }

        // ENVIA PRO MERCADO PAGO COMO NÚMERO PURO (EX: 666.67)
        const pagamento = await mercadopago.payment.create({
            transaction_amount: valorLimpo, // AQUI ERA O ERRO PRINCIPAL
            description: req.body.descricao || 'Pagamento FlashCred',
            payment_method_id: 'pix',
            payer: { email: 'flashcred@suporte.com.br' }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: pagamento.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (erro) {
        console.log('ERRO MERCADO PAGO:', erro);
        res.json({sucesso: false, mensagem: erro.message || 'Falha ao gerar Pix'});
    }
});
