const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const app = express();

app.use(cors());
app.use(express.json());

// Serve os arquivos HTML/CSS/JS que estão dentro da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota POST para gerar o Pix e retornar o QR Code em imagem Base64
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, tipo, propostaId } = req.body;

        if (!valor || !tipo || !propostaId) {
            return res.status(400).json({ erro: 'Dados incompletos para gerar o Pix.' });
        }

        // Código Copia e Cola (substitua ou Integre com sua API de Pagamento real aqui, ex: Mercado Pago, EFI)
        const copiaECola = `00020126580014br.gov.bcb.pix... (payload gerado para ${tipo} de R$ ${valor})`;

        // Transforma o Copia e Cola em imagem QR Code real
        let qrCodeBase64 = '';
        try {
            let qrDataUrl = await QRCode.toDataURL(copiaECola);
            qrCodeBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        } catch (err) {
            console.error('Erro ao gerar imagem QR Code:', err);
        }

        return res.json({
            sucesso: true,
            copiaECola: copiaECola,
            qrCodeBase64: qrCodeBase64
        });

    } catch (error) {
        console.error('Erro na API Pix:', error);
        return res.status(500).json({ erro: error.message || 'Erro interno ao gerar o Pix.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
