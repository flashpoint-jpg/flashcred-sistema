const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração das credenciais do Supabase no Servidor (onde não existe bloqueio de CORS)
const SUPABASE_URL = 'https://rgcclordmjmwuzrrfbd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';

// Rota de API do seu próprio servidor para buscar os clientes com segurança
app.get('/api/clientes', async (req, res) => {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=id.desc`, {
            headers: {
                'apikey': SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
