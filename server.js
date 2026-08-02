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
        console.error('ERRO DETALHADO COMPLETO:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Falha de comunicação com o banco de dados. Verifique a variável DATABASE_URL no Render.' 
        });
    }
});
