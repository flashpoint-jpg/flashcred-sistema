const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// Middleware para ler JSON no corpo das requisições
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS do frontend) da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Configuração do Banco de Dados PostgreSQL (Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para conexões externas com o Render
    }
});

// 1. Rota para cadastrar uma nova proposta
app.post('/api/propostas', async (req, res) => {
    try {
        const { nome, cpf, nascimento, cep, endereco, telefone, valor } = req.body;
        
        const queryText = `
            INSERT INTO propostas (nome, cpf, nascimento, cep, endereco, telefone, valor_desejado, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Em Análise') 
            RETURNING *;
        `;
        
        const values = [nome, cpf, nascimento, cep, endereco, telefone, valor];
        const result = await pool.query(queryText, values);
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Erro detalhado no servidor:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar proposta.' });
    }
});

// 2. Rota para listar todas as propostas (usada no painel administrativo)
app.get('/api/propostas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propostas ORDER BY data_criacao DESC;');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erro ao buscar propostas:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar propostas.' });
    }
});

// 3. Rota para atualizar o status da proposta pelo painel administrativo
app.put('/api/propostas/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE propostas SET status = $1 WHERE id = $2 RETURNING *;',
            [status, id]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar status.' });
    }
});

// Inicialização do servidor na porta definida pelo Render ou porta 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
