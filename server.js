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
        console.error('Erro detalhado no servidor:', error); // Mostra o erro exato no log do Render
        res.status(500).json({ success: false, message: 'Erro interno ao salvar proposta.' });
    }
});
