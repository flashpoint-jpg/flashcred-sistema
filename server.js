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

// Rota de consulta do cliente atualizada com os detalhes do Pix e Parcelas com juros de 8%
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

// Rota de aprovação e cálculo com juros compostos de 8% ao mês e porcentagem de entrada
app.post('/api/admin/atualizar', (req, res) => {
    const { id, status, valorSolicitado, qtdParcelas, percentualEntrada, vencimentoEntrada } = req.body;
    const proposta = propostas.find(p => p.id == id);
    
    if (proposta) {
        if (status) proposta.status = status;
        if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
        if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;
        if (percentualEntrada) proposta.percentualEntrada = percentualEntrada;
        if (vencimentoEntrada) proposta.vencimentoEntrada = vencimentoEntrada;

        // Se aprovado, calcula a entrada, aplica 8% de juros ao mês nas parcelas e gera o Pix
        if (proposta.status === 'APROVADO') {
            const valorTotalMercadoria = parseFloat(proposta.valorSolicitado.toString().replace(',', '.'));
            const pEntrada = parseFloat(proposta.percentualEntrada || '20'); // Padrão 20% se não informado
            const numParcelas = parseInt(proposta.qtdParcelas || '12');

            // Valor da Entrada Obrigatória
            const valorEntrada = (valorTotalMercadoria * (pEntrada / 100)).toFixed(2);
            
            // Restante financiado com juros de 8% ao mês (Tabela Price / Juros Compostos)
            const valorFinanciado = valorTotalMercadoria - valorEntrada;
            const taxaJuros = 0.08;
            
            // Fórmula da prestação com juros compostos: PMT = PV * [ i * (1 + i)^n ] / [ (1 + i)^n - 1 ]
            const fator = Math.pow(1 + taxaJuros, numParcelas);
            const valorParcelaMensal = ((valorFinanciado * taxaJuros * fator) / (fator - 1)).toFixed(2);

            proposta.cobrancaPix = {
                valorEntrada: valorEntrada,
                percentualEntrada: pEntrada,
                valorParcelaMensal: valorParcelaMensal,
                vencimento: proposta.vencimentoEntrada || 'À vista para liberação',
                copiaECola: `00020126580014br.gov.bcb.pix0136suporte@flashcredmoveis.com.br5204000053039865802BR5925FLASHCRED MOVEIS LTDA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`
            };
        }

        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
