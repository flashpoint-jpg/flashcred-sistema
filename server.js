const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();

// Configurações gerais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (HTMLs na raiz do projeto)
app.use(express.static(path.join(__dirname)));

// Configuração do Multer para upload de arquivos em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Conexão com o MongoDB (Substitua pela sua URI ou variável de ambiente se houver)
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/flashcred";
mongoose.connect(MONGO_URI)
    .then(() => console.log('Conectado ao MongoDB com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Schema do Banco de Dados para Propostas
const propostaSchema = new mongoose.Schema({
    nome: String,
    cpf: { type: String, unique: true },
    nascimento: String,
    endereco: String,
    numero: String,
    cep: String,
    valorSolicitado: Number,
    status: { type: String, default: 'EM_ANALISE' },
    produto: String,
    telefone: String,
    qtdParcelas: Number,
    juros: Number,
    valorEntrada: String,
    cobrancaPix: Object,
    pagamentoEntradaStatus: String,
    parcelas: Array,
    comprovanteRenda: {
        nomeArquivo: String,
        dados: Buffer,
        contentType: String
    }
});

const Proposta = mongoose.model('Proposta', propostaSchema);

// --- ROTAS DA API ---

// Rota de criação de proposta
app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha os campos obrigatórios.' });
        }

        const propostaExistente = await Proposta.findOne({ cpf: cpf.trim() });
        if (propostaExistente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe uma proposta para este CPF.' });
        }

        const novaPropostaData = {
            nome: nome.trim(),
            cpf: cpf.trim(),
            nascimento,
            endereco,
            numero,
            cep,
            valorSolicitado: parseFloat(valorSolicitado),
            status: 'EM_ANALISE'
        };

        if (req.file) {
            novaPropostaData.comprovanteRenda = {
                nomeArquivo: req.file.originalname,
                dados: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        const novaProposta = new Proposta(novaPropostaData);
        await novaProposta.save();
        
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar proposta:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }
});

// Rota de consulta de proposta por CPF (Query ou Parâmetro)
app.get('/api/proposta/consultar', async (req, res) => {
    try {
        const cpf = req.query.cpf;
        const proposta = await Proposta.findOne({ cpf: cpf ? cpf.trim() : '' });
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

app.get('/api/propostas/:cpf', async (req, res) => {
    try {
        const proposta = await Proposta.findOne({ cpf: req.params.cpf.trim() });
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

// Porta obrigatória para o Render funcionar corretamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
