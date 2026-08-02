const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Inicialização segura da tabela sem travar o app
pool.query(`
    CREATE TABLE IF NOT EXISTS propostas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) NOT NULL,
        nascimento DATE NOT NULL,
        cep VARCHAR(10) NOT NULL,
        endereco TEXT NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        valor_desejado NUMERIC(12,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Em Análise',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).then(() => {
    console.log("Tabela 'propostas' verificada com sucesso.");
}).catch(err => {
    console.error("Erro ao criar tabela:", err);
});

// Rota de cadastro
app.post('/api/propostas', async (req, res) => {
    try {
        let { nome, cpf, nascimento, cep, endereco, telefone, valor } = req.body;
        const valorNumerico = parseFloat(valor) || 0;

        const queryText = `
            INSERT INTO propostas (nome, cpf, nascimento, cep, endereco, telefone, valor_desejado, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Em Análise') 
            RETURNING *;
        `;
        
        const values = [nome, cpf, nascimento, cep, endereco, telefone, valorNumerico];
        const result = await pool.query(queryText, values);
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('ERRO NO POSTGRESQL:', error.message);
        res.status(500).json({ success: false, message: error.message || 'Erro interno ao salvar proposta.' });
    }
});

// Rota de listagem
app.get('/api/propostas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propostas ORDER BY data_criacao DESC;');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar propostas.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
