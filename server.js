const express = require('express');
const app = express();

// 1. Necessário para ler dados em JSON
app.use(express.json());

// 2. ADICIONE ESTA LINHA: Diz ao Express para servir todos os arquivos estáticos da pasta atual (ou troque 'public' se estiver usando uma pasta específica)
app.use(express.static(__dirname));

// Sua rota de Pix
app.post('/api/gerar-pix', async (req, res) => {
    try {
        return res.status(200).json({ sucesso: true, mensagem: "Pix gerado com sucesso!" });
    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        return res.status(500).json({ erro: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
