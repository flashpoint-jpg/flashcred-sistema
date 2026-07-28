const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Multer para lidar com o upload do comprovante de renda mantendo a estrutura
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Conexão com o MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flashcred';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Conectado ao MongoDB com sucesso!');
}).catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
});

// Schema da Proposta (Adicionados os novos campos de endereço, nascimento e comprovante)
const propostaSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true, unique: true },
    nascimento: { type: String },
    endereco: { type: String },
    numero: { type: String },
    cep: { type: String },
    valorSolicitado: { type: Number, required: true },
    comprovanteRenda: {
        nomeArquivo: String,
        dados: Buffer,
        contentType: String
    },
    status: { type: String, default: 'ANALISE' },
    qtdParcelas: { type: Number, default: 0 },
    juros: { type: Number, default: 0 },
    cobrancaPix: {
        valorEntrada: { type: Number, default: 0 },
        qrcode: { type: String, default: '' },
        copiaEcola: { type: String, default: '' }
    },
    parcelas: [{
        numero: Number,
        valor: Number,
        vencimento: String
    }],
    dataCriacao: { type: Date, default: Date.now }
});

const Proposta = mongoose.model('Proposta', propostaSchema);

// 1. Rota para o cliente criar/enviar a proposta (atualizada para receber os novos campos e o arquivo)
app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
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
            status: 'ANALISE',
            qtdParcelas: 0,
            juros: 0
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

// 2. Rota para o cliente consultar a proposta pelo CPF
app.get('/api/proposta/consultar', async (req, res) => {
    try {
        const { cpf } = req.query;
        if (!cpf) {
            return res.status(400).json({ sucesso: false, mensagem: 'CPF não informado.' });
        }

        const proposta = await Proposta.findOne({ cpf: cpf.trim() }).select('-comprovanteRenda.dados');
        if (!proposta) {
            return res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }

        res.json({ sucesso: true, proposta });
    } catch (err) {
        console.error('Erro ao consultar proposta:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }
});

// 3. Rota para o Admin listar todas as propostas
app.get('/api/admin/propostas', async (req, res) => {
    try {
        const propostas = await Proposta.find().select('-comprovanteRenda.dados').sort({ dataCriacao: -1 });
        res.json({ sucesso: true, propostas });
    } catch (err) {
        console.error('Erro ao listar propostas:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }
});

// 4. Rota para o Admin atualizar/aprovar a proposta
app.put('/api/admin/proposta/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, qtdParcelas, juros, valorEntrada, qrcode, copiaEcola } = req.body;

        const dadosAtualizados = {};
        if (status) dadosAtualizados.status = status;
        if (qtdParcelas !== undefined) dadosAtualizados.qtdParcelas = Number(qtdParcelas);
        if (juros !== undefined) dadosAtualizados.juros = Number(juros);
        
        if (valorEntrada !== undefined || qrcode !== undefined || copiaEcola !== undefined) {
            dadosAtualizados.cobrancaPix = {
                valorEntrada: Number(valorEntrada || 0),
                qrcode: qrcode || '',
                copiaEcola: copiaEcola || ''
            };
        }

        const propostaAtualizada = await Proposta.findByIdAndUpdate(
            id, 
            { $set: dadosAtualizados }, 
            { new: true }
        ).select('-comprovanteRenda.dados');

        if (!propostaAtualizada) {
            return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }

        res.json({ sucesso: true, mensagem: 'Proposta atualizada com sucesso!', proposta: propostaAtualizada });
    } catch (err) {
        console.error('Erro ao atualizar proposta:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
