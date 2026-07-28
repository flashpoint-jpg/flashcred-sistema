const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Multer para Uploads (Selfie, Documentos, Renda, Residência)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limite 10MB
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN' 
});
const payment = new Payment(client);

// Banco de dados em memória
let propostas = [];
let configuracoesGlobal = {
    porcentagemEntrada: 39,
    maxParcelas: 12,
    taxaJurosMensal: 2.5
};

// Funções de Validação
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function calcularIdade(dataNascimento) {
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
        idade--;
    }
    return idade;
}

// 1. CADASTRAR PROPOSTA (Com Selfie + Documentos + Validações)
app.post('/api/propostas', upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documento', maxCount: 1 },
    { name: 'comprovanteResidencia', maxCount: 1 },
    { name: 'comprovanteRenda', maxCount: 1 }
]), async (req, res) => {
    try {
        const { nome, cpf, dataNascimento, celular, email, cep, rua, bairro, cidade, estado, valorSolicitado, qtdParcelas } = req.body;

        if (!validarCPF(cpf)) {
            return res.status(400).json({ sucesso: false, erro: 'CPF inválido.' });
        }

        if (calcularIdade(dataNascimento) < 18) {
            return res.status(400).json({ sucesso: false, erro: 'É necessário ter no mínimo 18 anos.' });
        }

        const files = req.files || {};
        const novaProposta = {
            id: Date.now().toString(),
            dataCriacao: new Date().toISOString(),
            nome,
            cpf: cpf.replace(/[^\d]/g, ''),
            dataNascimento,
            celular: celular.replace(/[^\d]/g, ''),
            email,
            endereco: { cep, rua, bairro, cidade, estado },
            documentos: {
                selfie: files.selfie ? '/uploads/' + files.selfie[0].filename : null,
                documento: files.documento ? '/uploads/' + files.documento[0].filename : null,
                residencia: files.comprovanteResidencia ? '/uploads/' + files.comprovanteResidencia[0].filename : null,
                renda: files.comprovanteRenda ? '/uploads/' + files.comprovanteRenda[0].filename : null
            },
            valores: {
                solicitado: parseFloat(valorSolicitado) || 1000,
                porcentagemEntrada: configuracoesGlobal.porcentagemEntrada,
                numParcelas: parseInt(qtdParcelas) || 12
            },
            status: 'EM_ANALISE',
            pixEntrada: null,
            parcelas: []
        };

        // Calcula entrada inicial
        novaProposta.valores.entrada = (novaProposta.valores.solicitado * novaProposta.valores.porcentagemEntrada) / 100;

        propostas.push(novaProposta);
        res.json({ sucesso: true, idProposta: novaProposta.id, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar cadastro.' });
    }
});

// 2. CONSULTAR PROPOSTA PELO CPF (Área do Cliente)
app.get('/api/consultar/:cpf', (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/[^\d]/g, '');
    const proposta = propostas.find(p => p.cpf === cpfLimpo);
    if (!proposta) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });
    res.json({ sucesso: true, proposta });
});

// 3. ADMIN: APROVAR/REJEITAR & GERAR PIX ENTRADA / CARNÊ
app.post('/api/admin/decisao', async (req, res) => {
    const { idProposta, decisao, adminPassword, novoValorSolicitado, novaPorcentagemEntrada } = req.body;
    const SENHA_CORRETA = process.env.ADMIN_PASSWORD || 'admin123';

    if (adminPassword !== SENHA_CORRETA) {
        return res.status(401).json({ sucesso: false, erro: 'Senha incorreta.' });
    }

    const proposta = propostas.find(p => p.id === idProposta);
    if (!proposta) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });

    if (decisao === 'APROVAR') {
        proposta.status = 'APROVADO';

        if (novoValorSolicitado) proposta.valores.solicitado = parseFloat(novoValorSolicitado);
        if (novaPorcentagemEntrada) proposta.valores.porcentagemEntrada = parseFloat(novaPorcentagemEntrada);

        proposta.valores.entrada = (proposta.valores.solicitado * proposta.valores.porcentagemEntrada) / 100;
        const saldoDevedor = proposta.valores.solicitado - proposta.valores.entrada;
        proposta.valores.valorParcela = (saldoDevedor * 1.05) / proposta.valores.numParcelas;

        // Gerar Carnê
        proposta.parcelas = [];
        for (let i = 1; i <= proposta.valores.numParcelas; i++) {
            const dataVenc = new Date();
            dataVenc.setMonth(dataVenc.getMonth() + i);
            proposta.parcelas.push({
                numero: i,
                valor: proposta.valores.valorParcela,
                vencimento: dataVenc.toISOString().split('T')[0],
                status: 'PENDENTE',
                pixQrCode: null,
                pixCopiaCola: null
            });
        }

        // Gerar Pix de Entrada via SDK v2 do Mercado Pago
        try {
            const bodyMP = {
                transaction_amount: Number(proposta.valores.entrada.toFixed(2)),
                description: `Entrada Empréstimo - ${proposta.nome}`,
                payment_method_id: 'pix',
                payer: {
                    email: proposta.email || 'cliente@flashcred.com',
                    first_name: proposta.nome.split(' ')[0],
                    identification: { type: 'CPF', number: proposta.cpf }
                }
            };
            const result = await payment.create({ body: bodyMP });
            proposta.pixEntrada = {
                qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: result.point_of_interaction.transaction_data.qr_code
            };
        } catch (mpErr) {
            console.error("Erro MP:", mpErr);
            proposta.pixEntrada = {
                qrCodeBase64: '',
                copiaECola: '00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540539.005802BR5915FLASHCRED'
            };
        }

        return res.json({ sucesso: true, status: 'APROVADO', proposta });
    } else {
        proposta.status = 'REJEITADO';
        return res.json({ sucesso: true, status: 'REJEITADO' });
    }
});

// 4. GERAR PIX DE PARCELA DO CARNÊ
app.post('/api/parcelas/gerar-pix', async (req, res) => {
    const { idProposta, numeroParcela } = req.body;
    const proposta = propostas.find(p => p.id === idProposta);
    if (!proposta) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });

    const parcela = proposta.parcelas.find(p => p.numero === parseInt(numeroParcela));
    if (!parcela) return res.status(404).json({ sucesso: false, erro: 'Parcela não encontrada.' });

    try {
        const bodyMP = {
            transaction_amount: Number(parcela.valor.toFixed(2)),
            description: `Parcela ${parcela.numero} - ${proposta.nome}`,
            payment_method_id: 'pix',
            payer: {
                email: proposta.email || 'cliente@flashcred.com',
                first_name: proposta.nome.split(' ')[0],
                identification: { type: 'CPF', number: proposta.cpf }
            }
        };
        const result = await payment.create({ body: bodyMP });
        parcela.pixQrCode = result.point_of_interaction.transaction_data.qr_code_base64;
        parcela.pixCopiaCola = result.point_of_interaction.transaction_data.qr_code;

        res.json({ sucesso: true, pixQrCode: parcela.pixQrCode, pixCopiaCola: parcela.pixCopiaCola });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao gerar Pix da parcela.' });
    }
});

// 5. LISTAR PROPOSTAS (Admin)
app.get('/api/admin/propostas', (req, res) => {
    res.json({ sucesso: true, propostas, configuracoes: configuracoesGlobal });
});

// 6. ATUALIZAR CONFIGURAÇÕES GLOBAIS (Admin)
app.post('/api/admin/configuracoes', (req, res) => {
    const { porcentagemEntrada, maxParcelas, taxaJurosMensal, adminPassword } = req.body;
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) {
        return res.status(401).json({ sucesso: false, erro: 'Senha incorreta.' });
    }
    if (porcentagemEntrada) configuracoesGlobal.porcentagemEntrada = parseFloat(porcentagemEntrada);
    if (maxParcelas) configuracoesGlobal.maxParcelas = parseInt(maxParcelas);
    if (taxaJurosMensal) configuracoesGlobal.taxaJurosMensal = parseFloat(taxaJurosMensal);
    res.json({ sucesso: true, configuracoes: configuracoesGlobal });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
