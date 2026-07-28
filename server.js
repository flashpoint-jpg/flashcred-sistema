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
        console.log("Dados recebidos do site:", dados); // Ajuda a registrar no console do Render
        
        let lista = ler();
        
        // Pega qualquer chave que contenha nome ou cpf para nunca vir vazio
        let nomeFinal = 'Cliente';
        let cpfFinal = '';
        let telefoneFinal = '';
        let produtoFinal = 'Não especificado';

        for (let chave in dados) {
            let valor = dados[chave];
            if (!valor) continue;
            let chaveLower = chave.toLowerCase();
            
            if (chaveLower.includes('nome') || chaveLower.includes('client')) nomeFinal = valor;
            if (chaveLower.includes('cpf') || chaveLower.includes('doc') || chaveLower.includes('rg')) cpfFinal = valor;
            if (chaveLower.includes('tel') || chaveLower.includes('cel') || chaveLower.includes('whats') || chaveLower.includes('fone')) telefoneFinal = valor;
            if (chaveLower.includes('prod') || chaveLower.includes('model') || chaveLower.includes('aparelh')) produtoFinal = valor;
        }

        // Se ainda assim não achar, tenta campos diretos
        nomeFinal = dados.nome || dados.name || nomeFinal;
        cpfFinal = dados.cpf || dados.CPF || dados.documento || cpfFinal || '000.000.000-00';
        telefoneFinal = dados.telefone || dados.celular || dados.phone || telefoneFinal;
        produtoFinal = dados.produto || dados.modelo || produtoFinal;

        const nova = {
            nome: nomeFinal,
            cpf: cpfFinal,
            telefone: telefoneFinal,
            produto: produtoFinal,
            endereco: dados.endereco || '',
            status: 'EM_ANALISE',
            parcelas: dados.parcelas || [],
            cobrancaPix: { valorEntrada: dados.valorEntrada || dados.entrada || '0,00' },
            dataCriacao: new Date().toISOString()
        };

        lista = lista.filter(p => p.cpf !== cpfFinal);
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
