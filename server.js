app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, tipo, propostaId } = req.body;

        if (!valor || !tipo || !propostaId) {
            return res.status(400).json({ erro: 'Dados incompletos para gerar o Pix.' });
        }

        // ==========================================
        // SUBSTITUA ESTA VARIÁVEL PELA RESPOSTA REAL DA SUA API DE PAGAMENTO
        // A sua API (Mercado Pago, EFI, etc.) deve retornar a string oficial do Pix (payload Copia e Cola)
        // ==========================================
        const copiaEColaReal = "COLOQUE_AQUI_O_PAYLOAD_OFICIAL_RETORNADO_PELA_SUA_API"; 

        // Transforma o Copia e Cola oficial em imagem QR Code real
        let qrCodeBase64 = '';
        try {
            let qrDataUrl = await QRCode.toDataURL(copiaEColaReal);
            qrCodeBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        } catch (err) {
            console.error('Erro ao gerar imagem QR Code:', err);
        }

        return res.json({
            sucesso: true,
            copiaECola: copiaEColaReal,
            qrCodeBase64: qrCodeBase64
        });

    } catch (error) {
        console.error('Erro na API Pix:', error);
        return res.status(500).json({ erro: error.message || 'Erro interno ao gerar o Pix.' });
    }
});
