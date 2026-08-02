// --- FRONTEND ROUTES (Arquivos na raiz) ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'consultar.html')); // ou o nome correto do seu arquivo de consulta
});

app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel.html'));
});
