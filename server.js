const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const ARQUIVO = './propostas.json';

function ler() {
    try {
        if (fs.existsSync(ARQUIVO)) {
            const d = fs.readFileSync(ARQUIVO, 'utf8');
            return d.trim() ? JSON.parse(d) : [];
        }
    } catch (e) {}
    return [];
}

app.post('/api/propostas', (req, res) => {
    try {
        const dados = req.body || {};
        let lista = ler();
        
        const nova = {
            nome: dados.nome || dados.name || 'Cliente',
            cpf: dados.cpf || dados.documento || '000.000.000-00',
            telefone: dados.telefone || dados.celular || '',
            produto: dados.produto || dados.modelo || 'Não especificado',
            endereco: dados.endereco || '',
            status: 'EM_ANALISE',
            parcelas: dados.parcelas || [],
            cobrancaPix: { valorEntrada: dados.valorEntrada || dados.entrada || '0,00' },
            dataCriacao: new Date().toISOString()
        };

        lista.unshift(nova);
        fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
        
        return res.json({ sucesso: true });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

app.get('/api/propostas', (req, res) => {
    res.json({ sucesso: true, propostas: ler() });
});

app.post('/api/propostas/status', (req, res) => {
    const { cpf, status } = req.body;
    let lista = ler();
    lista.forEach(p => { if (p.cpf === cpf) p.status = status; });
    fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
    res.json({ sucesso: true });
});

app.post('/api/propostas/editar', (req, res) => {
    const dados = req.body;
    let lista = ler();
    lista.forEach(p => {
        if (p.cpf === dados.cpfOriginal) {
            p.nome = dados.nome || p.nome;
            p.cpf = dados.cpf || p.cpf;
            p.telefone = dados.telefone || p.telefone;
            p.produto = dados.produto || p.produto;
            p.endereco = dados.endereco || p.endereco;
        }
    });
    fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
    res.json({ sucesso: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
