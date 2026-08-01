const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_HOST = 'rgcclordmjmwuzrrfbd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';

// Rota de API segura usando o módulo HTTPS nativo do Node
app.get('/api/clientes', (req, res) => {
    const options = {
        hostname: SUPABASE_HOST,
        path: '/rest/v1/clientes?select=*&order=id.desc',
        method: 'GET',
        headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    const supabaseReq = https.request(options, (supabaseRes) => {
        let data = '';

        supabaseRes.on('data', (chunk) => {
            data += chunk;
        });

        supabaseRes.on('end', () => {
            try {
                res.setHeader('Content-Type', 'application/json');
                res.send(data);
            } catch (e) {
                res.status(500).json({ error: 'Erro ao processar dados do banco' });
            }
        });
    });

    supabaseReq.on('error', (error) => {
        res.status(500).json({ error: error.message });
    });

    supabaseReq.end();
});

app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
