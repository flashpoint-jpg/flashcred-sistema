const express = require('express');
const app = express();

// Necessário para o servidor conseguir ler dados enviados em JSON no corpo da requisição (req.body)
app.use(express.json());

// Sua rota que estava gerando o erro na linha 2 (ajustada abaixo)
app.post('/api/gerar-pix', async (req, res) => {
    try {
        // Seu código de geração de Pix aqui...
        
        return res.status(200).json({ sucesso: true, mensagem: "Pix gerado com sucesso!" });
    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        return res.status(500).json({ erro: error.message });
    }
});

// Defina a porta e coloque o servidor para rodar (geralmente porta 3000 ou process.env.PORT para o Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
