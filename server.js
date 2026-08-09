const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Rota para gerar o Pix (Evita o erro Unexpected token '<' retornando sempre JSON)
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const { valor, tipo, propostaId } = req.body;

        if (!valor || !tipo || !propostaId) {
            return res.status(400).json({ erro: 'Dados incompletos para gerar o Pix.' });
        }

        // --- INSIRA AQUI A INTEGRAÇÃO COM SUA API DE PAGAMENTO (Ex: Mercado Pago, EFI, etc.) ---
        // Exemplo simulado de retorno correto em JSON:
        
        const copiaECacheExemplo = `00020126580014br.gov.bcb.pix... (copia e cola gerado para ${tipo} de R$ ${valor})`;
        
        return res.json({
            sucesso: true,
            copiaECola: copiaECacheExemplo,
            qrCodeBase64: '' // Insira a string Base64 do QR Code se a sua API fornecer
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
