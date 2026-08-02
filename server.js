// Exemplo da rota que recebe a proposta no backend
app.post('/api/propostas', (req, res) => {
    try {
        const novaProposta = req.body;
        // Salva no banco de dados ou array
        propostas.push(novaProposta);
        res.json({ success: true, message: "Proposta salva com sucesso!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
