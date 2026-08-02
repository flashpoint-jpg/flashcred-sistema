const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- API ROUTES ---

app.post('/api/propostas', async (req, res) => {
    try {
        const { nome, cpf, telefone, valor_desejado } = req.body;
        const queryText = `INSERT INTO propostas (nome, cpf, telefone, valor_desejado, status, data_criacao) 
                           VALUES ($1, $2, $3, $4, 'Em Análise', NOW()) RETURNING *`;
        const result = await pool.query(queryText, [nome, cpf, telefone, valor_desejado]);
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Erro ao criar proposta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/propostas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Erro ao buscar propostas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/propostas/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.query('UPDATE propostas SET status = $1 WHERE id = $2', [status, id]);
        return res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/propostas/:cpf', async (req, res) => {
    try {
        const cpfParam = req.params.cpf;
        const queryText = "SELECT * FROM propostas WHERE regexp_replace(cpf, '\\D', '', 'g') = $1 LIMIT 1";
        const result = await pool.query(queryText, [cpfParam]);

        if (result.rows.length > 0) {
            return res.json({ success: true, data: result.rows[0] });
        } else {
            return res.json({ success: false, message: "Nenhuma proposta encontrada." });
        }
    } catch (error) {
        console.error('Erro na consulta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- FRONTEND ROUTES (Arquivos na raiz) ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'consultar.html'));
});

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});
