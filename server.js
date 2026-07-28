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

// Rota para salvar a proposta capturando os dados reais enviados pelo formulário
app.post('/api/propostas', (req, res) => {
    try {
        const dados = req.body || {};
        let lista = ler();
        
        // Varre todas as variações possíveis para garantir que o nome e CPF reais sejam salvos
        const nomeReal = dados.nome || dados.name || dados.cliente || dados.fullName || 'Cliente';
        const cpfReal = dados.cpf || dados.CPF || dados.documento || dados.doc || '000.000.000-00';
        const telefoneReal = dados.telefone || dados.celular || dados.phone || dados.whatsapp || '';
        const produtoReal = dados.produto || dados.modelo || dados.aparelho || 'Não especificado';
        const enderecoReal = dados.endereco || dados.rua || '';
        const entradaReal = dados.valorEntrada || dados.entrada || dados.sinal || '0,00';

        const nova = {
            nome: nomeReal,
            cpf: cpfReal,
            telefone: telefoneReal,
            produto: produtoReal,
            endereco: enderecoReal,
            status: 'EM_ANALISE',
            parcelas: dados.parcelas || [],
            cobrancaPix: { valorEntrada: entradaReal },
            dataCriacao: new Date().toISOString()
        };

        // Remove duplicado se já existir e coloca o novo no topo
        lista = lista.filter(p => p.cpf !== cpfReal);
        lista.unshift(nova);
        
        fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
        return res.json({ sucesso: true, mensagem: 'Salvo com sucesso!' });
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
            p.endereco = dados.endereco || dados.endereco;
            if (!p.cobrancaPix) p.cobrancaPix = {};
            if (dados.valorEntrada) p.cobrancaPix.valorEntrada = dados.valorEntrada;
        }
    });
    fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
    res.json({ sucesso: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
