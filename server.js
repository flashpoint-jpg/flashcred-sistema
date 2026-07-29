const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

// Permite que o servidor abra qualquer arquivo HTML da sua pasta automaticamente
app.use(express.static(path.join(__dirname)));

// Banco de dados em memória temporário
const bancoDeDados = {};

// Rota para cadastrar solicitação via API
app.post('/api/solicitacoes', (req, res) => {
    const dados = req.body;
    if (!dados.cpf || !dados.nome) {
        return res.status(400).json({ erro: 'CPF e Nome são obrigatórios.' });
    }

    const cpfLimpo = dados.cpf.replace(/\D/g, '');
    bancoDeDados[cpfLimpo] = {
        ...dados,
        cpf: cpfLimpo,
        status: 'em_analise',
        data: new Date().toLocaleDateString('pt-BR')
    };

    res.status(201).json({ sucesso: true, mensagem: 'Solicitação salva com sucesso!' });
});

// Rota para consultar pelo CPF
app.get('/api/solicitacoes/:cpf', (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    const registro = bancoDeDados[cpfLimpo];

    if (!registro) {
        return res.json({ encontrado: false });
    }

    res.json({ encontrado: true, dados: registro });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
