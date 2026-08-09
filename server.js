const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve os arquivos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota POST para gerar o Pix
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, tipo, propostaId } = req.body;

        if (!valor || !tipo || !propostaId) {
            return res.status(400).json({ erro: 'Dados incompletos para gerar o Pix.' });
        }

        // Payload padrão (substitua pelo real da sua API quando integrar)
        const copiaEColaReal = "00020126580014br.gov.bcb.pix... (payload real)";

        // Gera a URL do QR Code usando uma API pública segura (sem precisar instalar nada)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(copiaEColaReal)}`;

        return res.json({
            sucesso: true,
            copiaECola: copiaEColaReal,
            qrCodeUrl: qrCodeUrl
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
