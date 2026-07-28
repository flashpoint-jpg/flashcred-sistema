const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

let propostas = [];

app.post('/api/propostas', upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documento', maxCount: 1 },
    { name: 'comprovanteResidencia', maxCount: 1 },
    { name: 'comprovanteRenda', maxCount: 1 }
]), (req, res) => {
    try {
        const dados = req.body;
        const arquivos = req.files;

        if (dados.dataNascimento) {
            const hoje = new Date();
            const nascimento = new Date(dados.dataNascimento);
            let idade = hoje.getFullYear() - nascimento.getFullYear();
            const m = hoje.getMonth() - nascimento.getMonth();
            if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
            if (idade < 18) {
                return res.status(400).json({ sucesso: false, erro: 'Você precisa ter pelo menos 18 anos.' });
            }
        }

        const novaProposta = {
            id: Date.now(),
            ...dados,
            status: 'EM_ANALISE',
            arquivos: arquivos ? Object.keys(arquivos).reduce((acc, key) => {
                acc[key] = arquivos[key][0].filename;
                return acc;
            }, {}) : {},
            dataCriacao: new Date()
        };

        propostas.push(novaProposta);
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

app.get('/api/propostas/:cpf', (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    const proposta = propostas.find(p => p.cpf && p.cpf.replace(/\D/g, '') === cpfLimpo);
    if (proposta) {
        res.json({ sucesso: true, proposta });
    } else {
        res.json({ sucesso: false });
    }
});

app.get('/api/admin/propostas', (req, res) => {
    res.json(propostas);
});

// Atualizar status, valor, parcelas e gerar Pix/Simulação de Carnê
app.post('/api/admin/atualizar', (req, res) => {
    const { id, status, valorSolicitado, qtdParcelas } = req.body;
    const proposta = propostas.find(p => p.id == id);
    if (proposta) {
        if (status) proposta.status = status;
        if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
        if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;

        // Se aprovado, gera os dados simulados do Pix copia e cola e QR Code de pagamento
        if (proposta.status === 'APROVADO') {
            const valorTotalNum = parseFloat(proposta.valorSolicitado.toString().replace(',', '.')) * 1.35; // Exemplo com juros
            const valorParcelaCalc = (valorTotalNum / parseInt(proposta.qtdParcelas)).toFixed(2);
            
            proposta.cobrancaPix = {
                copiaECola: `00020126580014br.gov.bcb.pix0136suporte@flashcredmoveis.com.br5204000053039865802BR5925FLASHCRED MOVEIS LTDA6009SAO PAULO62070503***6304ABCD`,
                valorParcela: valorParcelaCalc,
                vencimento: '30 dias após liberação'
            };
        }

        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
