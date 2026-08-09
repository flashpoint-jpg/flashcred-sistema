const QRCode = require('qrcode'); // Certifique-se de importar

app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, tipo, propostaId } = req.body;

        if (!valor || !tipo || !propostaId) {
            return res.status(400).json({ erro: 'Dados incompletos para gerar o Pix.' });
        }

        // 1. Defina o seu código Copia e Cola real (ou integração com sua API de pagamento)
        const copiaECola = `00020126580014br.gov.bcb.pix... (payload real para ${tipo} de R$ ${valor})`;

        // 2. Transforma o Copia e Cola em Imagem Base64 QR Code automaticamente
        let qrCodeBase64 = '';
        try {
            qrCodeBase64 = await QRCode.toDataURL(copiaECola);
            // Remove o prefixo do dataurl para enviar limpo se necessário, ou envia direto
            qrCodeBase64 = qrCodeBase64.replace(/^data:image\/png;base64,/, "");
        } catch (err) {
            console.error('Erro ao gerar imagem QR Code:', err);
        }

        return res.json({
            sucesso: true,
            copiaECola: copiaECola,
            qrCodeBase64: qrCodeBase64 // Envia a imagem gerada para o frontend
        });

    } catch (error) {
        console.error('Erro na API Pix:', error);
        return res.status(500).json({ erro: error.message || 'Erro interno ao gerar o Pix.' });
    }
});
