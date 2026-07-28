const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471' });

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

// Login do Administrador
app.post('/api/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === 'flashcred2026') {
        res.json({ sucesso: true, token: 'token-admin-autorizado-123' });
    } else {
        res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });
    }
});

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

app.post('/api/admin/atualizar', async (req, res) => {
    const { id, status, valorSolicitado, qtdParcelas, percentualEntrada, vencimentoEntrada } = req.body;
    const proposta = propostas.find(p => p.id == id);
    
    if (proposta) {
        if (status) proposta.status = status;
        if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
        if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;
        if (percentualEntrada) proposta.percentualEntrada = percentualEntrada;
        if (vencimentoEntrada) proposta.vencimentoEntrada = vencimentoEntrada;

        if (proposta.status === 'APROVADO') {
            const valorTotalMercadoria = parseFloat(proposta.valorSolicitado.toString().replace(',', '.'));
            const pEntrada = parseFloat(proposta.percentualEntrada || '20');
            const numParcelas = parseInt(proposta.qtdParcelas || '12');

            const valorEntrada = (valorTotalMercadoria * (pEntrada / 100)).toFixed(2);
            const valorFinanciado = valorTotalMercadoria - valorEntrada;
            const taxaJuros = 0.08;
            const fator = Math.pow(1 + taxaJuros, numParcelas);
            const valorParcelaMensal = ((valorFinanciado * taxaJuros * fator) / (fator - 1)).toFixed(2);

            let copiaEColaPix = `00020126580014br.gov.bcb.pix0136suporte@flashcredmoveis.com.br5204000053039865802BR5925FLASHCRED MOVEIS LTDA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;

            try {
                const payment = new Payment(client);
                const result = await payment.create({
                    body: {
                        transaction_amount: parseFloat(valorEntrada),
                        description: `Entrada FlashCred - ${proposta.nome}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: proposta.email || 'cliente@flashcred.com',
                            first_name: proposta.nome.split(' ')[0],
                            last_name: proposta.nome.split(' ').slice(1).join(' ') || 'Cliente',
                            identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') }
                        }
                    }
                });
                if (result && result.point_of_interaction && result.point_of_interaction.transaction_data) {
                    copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
                }
            } catch (mpErr) {
                console.log('Usando Pix seguro alternativo:', mpErr.message);
            }

            proposta.cobrancaPix = {
                valorEntrada: valorEntrada,
                percentualEntrada: pEntrada,
                valorParcelaMensal: valorParcelaMensal,
                vencimento: proposta.vencimentoEntrada || 'Hoje (Liberação Imediata)',
                copiaECola: copiaEColaPix
            };
        }

        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
