const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'propostas.json');

function lerBanco() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    const data = fs.readFileSync(DB_FILE);
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function salvarBanco(dados) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
}

// --- ROTAS DA API ---

app.post('/api/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

app.post('/api/admin/login', (req, res) => {
    res.json({ sucesso: true, token: 'token_flashpoint_secure_99' });
});

// Criar Proposta
app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha os campos obrigatórios.' });
        }

        const propostas = lerBanco();
        const cpfLimpo = cpf.trim();

        const propostaExistente = propostas.find(p => p.cpf === cpfLimpo);
        if (propostaExistente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe uma proposta para este CPF.' });
        }

        const novaProposta = {
            id: Date.now().toString(),
            nome: nome.trim(),
            cpf: cpfLimpo,
            nascimento,
            endereco,
            numero,
            cep,
            valorSolicitado: parseFloat(valorSolicitado),
            status: 'EM_ANALISE',
            qtdParcelas: 6,
            juros: 2.5,
            comprovanteRenda: req.file ? {
                nomeArquivo: req.file.originalname,
                contentType: req.file.mimetype
            } : null,
            parcelas: [],
            cobrancaPix: null,
            pagamentoEntradaStatus: 'PENDENTE'
        };

        propostas.push(novaProposta);
        salvarBanco(propostas);
        
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno: ' + err.message });
    }
});

// Listar todas as propostas
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerBanco();
        res.json({ sucesso: true, propostas });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar propostas.' });
    }
});

// Atualizar Status (Aprovar / Recusar)
app.post('/api/propostas/status', (req, res) => {
    try {
        const { cpf, status } = req.body;
        let propostas = lerBanco();
        const index = propostas.findIndex(p => p.cpf === cpf);
        if (index === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        propostas[index].status = status;
        
        if (status === 'APROVADO' && (!propostas[index].parcelas || propostas[index].parcelas.length === 0)) {
            const valorSol = parseFloat(propostas[index].valorSolicitado || 1000);
            const qtdP = parseInt(propostas[index].qtdParcelas || 6);
            const jrs = parseFloat(propostas[index].juros || 2.5) / 100;
            const valEntrada = parseFloat((valorSol * 0.1).toFixed(2));
            const restante = valorSol - valEntrada;

            let valParcela = jrs > 0 ? (restante * Math.pow(1 + jrs, qtdP)) / qtdP : restante / qtdP;
            valParcela = parseFloat(valParcela.toFixed(2));

            propostas[index].valorEntrada = valEntrada;
            propostas[index].pagamentoEntradaStatus = 'PENDENTE';
            const pixCode = '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 15);
            propostas[index].cobrancaPix = {
                valorEntrada: valEntrada,
                copiaECola: pixCode,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
            };

            let listaParcelas = [];
            const hoje = new Date();
            for (let i = 1; i <= qtdP; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                listaParcelas.push({
                    numero: i,
                    vencimento: venc.toLocaleDateString('pt-BR'),
                    valor: valParcela,
                    status: 'PENDENTE'
                });
            }
            propostas[index].parcelas = listaParcelas;
        }

        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Editar Proposta Completa (Admin)
app.post('/api/propostas/editar', (req, res) => {
    try {
        const { cpfOriginal, nome, cpf, telefone, produto, valorSolicitado, valorEntrada, qtdParcelas, juros, endereco } = req.body;
        let propostas = lerBanco();
        const index = propostas.findIndex(p => p.cpf === cpfOriginal);
        if (index === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        const qtdP = parseInt(qtdParcelas) || 6;
        const jrs = parseFloat(juros) || 2.5;
        const valSol = parseFloat(valorSolicitado) || 0;
        const valEnt = parseFloat(valorEntrada) || 0;
        const restante = Math.max(0, valSol - valEnt);
        const taxaMensal = jrs / 100;

        let valParcela = taxaMensal > 0 ? (restante * Math.pow(1 + taxaMensal, qtdP)) / qtdP : restante / qtdP;
        valParcela = parseFloat(valParcela.toFixed(2));

        let listaParcelas = [];
        const hoje = new Date();
        for (let i = 1; i <= qtdP; i++) {
            let venc = new Date(hoje);
            venc.setMonth(venc.getMonth() + i);
            listaParcelas.push({
                numero: i,
                vencimento: venc.toLocaleDateString('pt-BR'),
                valor: valParcela,
                status: 'PENDENTE'
            });
        }

        const pixCode = propostas[index].cobrancaPix?.copiaECola || ('00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 15));

        propostas[index] = {
            ...propostas[index],
            nome: nome || propostas[index].nome,
            cpf: cpf || propostas[index].cpf,
            telefone: telefone || propostas[index].telefone,
            produto: produto || propostas[index].produto,
            valorSolicitado: valSol,
            valorEntrada: valEnt,
            qtdParcelas: qtdP,
            juros: jrs,
            endereco: endereco || propostas[index].endereco,
            parcelas: listaParcelas,
            cobrancaPix: {
                valorEntrada: valEnt,
                copiaECola: pixCode,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
            }
        };

        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Pagar Parcela Específica do Carnê
app.post('/api/parcelas/pagar', (req, res) => {
    try {
        const { cpf, numeroParcela } = req.body;
        let propostas = lerBanco();
        const pIndex = propostas.findIndex(p => p.cpf === cpf);
        if (pIndex === -1) return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada.' });

        let parcela = propostas[pIndex].parcelas.find(parc => parc.numero === numeroParcela);
        if (!parcela) return res.status(404).json({ sucesso: false, mensagem: 'Parcela não encontrada.' });

        const pixCode = '00020126580014br.gov.bcb.pix0136PARC' + numeroParcela + Math.random().toString(36).substring(2, 10);
        parcela.cobrancaPix = {
            copiaECola: pixCode,
            qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
        };

        salvarBanco(propostas);
        res.json({ sucesso: true, parcela });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: e.message });
    }
});

// Webhook para notificações automáticas do Mercado Pago
app.post('/api/webhook/mercadopago', (req, res) => {
    try {
        const evento = req.body;
        if (evento && (evento.type === 'payment' || evento.action === 'payment.created')) {
            let propostas = lerBanco();
            salvarBanco(propostas);
        }
        res.status(200).send('OK');
    } catch (e) {
        res.status(200).send('OK');
    }
});

// Consultas por CPF
app.get('/api/proposta/consultar', (req, res) => {
    try {
        const cpf = req.query.cpf;
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf === (cpf ? cpf.trim() : ''));
        
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

app.get('/api/propostas/:cpf', (req, res) => {
    try {
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf === req.params.cpf.trim());
        
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
