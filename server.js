const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Servir os arquivos HTML/CSS/Imagens da pasta atual
app.use(express.static(path.join(__dirname)));

// Conexão com o PostgreSQL do Render (utiliza a variável de ambiente DATABASE_URL gerada automaticamente pelo Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Criar tabela de propostas automaticamente caso não exista
async function criarTabela() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS propostas (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                cpf VARCHAR(20) UNIQUE NOT NULL,
                nascimento DATE NOT NULL,
                cep VARCHAR(10) NOT NULL,
                endereco TEXT NOT NULL,
                telefone VARCHAR(20) NOT NULL,
                valor_desejado NUMERIC(12, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'Em Análise',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabela 'propostas' verificada/criada com sucesso.");
    } catch (err) {
        console.error("Erro ao criar tabela:", err);
    }
}
criarTabela();

// --- ROTAS DA API ---

// 1. Salvar nova proposta (chamada pelo index.html)
app.post('/api/propostas', async (req, res) => {
    const { nome, cpf, nascimento, cep, endereco, telefone, valor } = req.body;

    try {
        const query = `
            INSERT INTO propostas (nome, cpf, nascimento, cep, endereco, telefone, valor_desejado)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [nome, cpf, nascimento, cep, endereco, telefone, valor];
        const result = await pool.query(query, values);
        
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Erro ao salvar proposta:', error);
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Este CPF já possui uma proposta cadastrada.' });
        }
        res.status(500).json({ success: false, message: 'Erro interno ao salvar proposta.' });
    }
});

// 2. Listar todas as propostas (chamada pelo painel.html)
app.get('/api/propostas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propostas ORDER BY data_criacao DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erro ao buscar propostas:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar dados.' });
    }
});

// 3. Consultar proposta específica por CPF (chamada pelo acompanhar.html)
app.get('/api/propostas/:cpf', async (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    try {
        // Busca ignorando pontos e traços no banco
        const result = await pool.query("SELECT * FROM propostas WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = $1", [cpfLimpo]);
        
        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.json({ success: false, message: 'Proposta não encontrada.' });
        }
    } catch (error) {
        console.error('Erro ao consultar CPF:', error);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
