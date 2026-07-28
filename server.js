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

// Rotas explícitas para carregar as páginas sem erro 404
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send('Arquivo index.html não encontrado na raiz.');
});

app.get('/consultar.html', (req, res) => {
    const p = path.join(__dirname, 'consultar.html');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.send('Arquivo consultar.html não encontrado.');
});

app.get('/parcelas.html', (req, res) => {
    const p = path.join(__dirname, 'parcelas.html');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.send('Arquivo parcelas.html não encontrado.');
});

app.get('/admin.html', (req, res) => {
    const p = path.join(__dirname, 'admin.html');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.send('Arquivo admin.html não encontrado.');
});

// Login do Administrador
app.post('/api/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === 'flashcred2026') {
        res.json({ sucesso: true, token: 'token-admin-autorizado-123' });
    } else {
        res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });
    }
});

// Envio de nova proposta pelo cliente
app.post('/api/propostas', upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documento', maxCount: 1 },
    { name: 'comprovanteResidencia', maxCount: 1 },
    { name: 'comprovanteRenda', maxCount: 1 }
]), (req, res) => {
    try {
        const dados = req.body;
        const arquivos = req.files;

        const novaProposta = {
            id: Date.now(),
            ...dados,
            status: 'EM_ANALISE',
            pagamentoEntradaStatus: 'PENDENTE',
            parcelas: [],
            arquivos: arquivos ? Object.keys(arquivos).reduce((acc, key) => {
                acc[key] = arquivos[key][0].filename;
                return acc;
            }, {}) : {},
            dataCriacao: new Date()
        };

        propostas.push(novaProposta);
        console.log(`[NOVA PROPOSTA] Recebida de: ${novaProposta.nome} (CPF: ${novaProposta.cpf})`);
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Webhook do Mercado Pago (Notificação automática de pagamentos)
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const body = req.body;
        const paymentId = body.data?.id || body.id;
        if (paymentId) {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            
            if (paymentInfo && paymentInfo.status === 'approved') {
                const valorPago = paymentInfo.transaction_amount;

                for (let p of propostas) {
                    // Verifica se o pagamento corresponde à Entrada Pix
                    if (p.cobrancaPix && parseFloat(p.cobrancaPix.valorEntrada) === valorPago && p.pagamentoEntradaStatus !== 'PAGO') {
                        p.pagamentoEntradaStatus = 'PAGO';
                        console.log(`[NOTIFICAÇÃO PIX] 💰 ENTRADA PAGA! Cliente: ${p.nome} | Valor: R$ ${valorPago}`);
                        break;
                    }
                    // Verifica se o pagamento corresponde a alguma parcela do carnê
                    if (p.parcelas) {
                        for (let parc of p.parcelas) {
                            if (parseFloat(parc.valor) === valorPago && parc.status !== 'PAGO') {
                                parc.status = 'PAGO';
                                parc.dataPagamento = new Date().toLocaleDateString('pt-BR');
                                console.log(`[NOTIFICAÇÃO PIX] 💰 PARCELA ${parc.numero} PAGA! Cliente: ${p.nome} | Valor: R$ ${valorPago}`);
                                break;
                            }
                        }
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(200);
    }
});

// Solicitar pagamento via Pix de uma parcela específica do carnê
app.post('/api/parcelas/pagar', async (req, res) => {
    const { cpf, numeroParcela } = req.body;
    const cpfLimpo = cpf.replace(/\D/g, '');
    const proposta = propostas.find(p => p.cpf && p.cpf.replace(/\D/g, '') === cpfLimpo);

    if (!proposta) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });

    const parcela = proposta.parcelas.find(parc => parc.numero == numeroParcela);
    if (!parcela) return res.status(404).json({ sucesso: false, erro: 'Parcela não encontrada.' });

    let copiaEColaPix = `00020126580014br.gov.bcb.pix0136suporte@flashpointdistribuidora.com.br5204000053039865802BR5925FLASHPOINT DISTRIBUIDORA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;
    let paymentId = null;

    try {
        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: parseFloat(parcela.valor),
                description: `Parcela ${parcela.numero}/${proposta.qtdParcelas} - Flashpoint - ${proposta.nome}`,
                payment_method_id: 'pix',
                payer: {
                    email: proposta.email || 'cliente@flashpoint.com',
                    first_name: proposta.nome.split(' ')[0],
                    last_name: proposta.nome.split(' ').slice(1).join(' ') || 'Cliente',
                    identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') }
                }
            }
        });
        if (result && result.point_of_interaction && result.point_of_interaction.transaction_data) {
            copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
            paymentId = result.id;
        }
    } catch (mpErr) {}

    parcela.cobrancaPix = { copiaECola: copiaEColaPix, paymentId };
    res.json({ sucesso: true, parcela });
});

// Consulta cliente por CPF (página do cliente)
app.get('/api/propostas/:cpf', async (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    const proposta = propostas.find(p => p.cpf && p.cpf.replace(/\D/g, '') === cpfLimpo);
    
    if (proposta) {
        // Verifica automaticamente se a entrada foi paga no MP
        if (proposta.cobrancaPix && proposta.cobrancaPix.paymentId && proposta.pagamentoEntradaStatus !== 'PAGO') {
            try {
                const payment = new Payment(client);
                const paymentInfo = await payment.get({ id: proposta.cobrancaPix.paymentId });
                if (paymentInfo && paymentInfo.status === 'approved') {
                    proposta.pagamentoEntradaStatus = 'PAGO';
                    console.log(`[AUTO-CHECK] Entrada paga confirmada para: ${proposta.nome}`);
                }
            } catch (e) {}
        }
        res.json({ sucesso: true, proposta });
    } else {
        res.json({ sucesso: false });
    }
});

// Listar propostas para o Painel Administrativo
app.get('/api/admin/propostas', async (req, res) => {
    // Varredura automática para atualizar status de pagamentos pendentes no painel
    for (let p of propostas) {
        if (p.cobrancaPix && p.cobrancaPix.paymentId && p.pagamentoEntradaStatus !== 'PAGO') {
            try {
                const payment = new Payment(client);
                const paymentInfo = await payment.get({ id: p.cobrancaPix.paymentId });
                if (paymentInfo && paymentInfo.status === 'approved') {
                    p.pagamentoEntradaStatus = 'PAGO';
                    console.log(`[AUTO-CHECK ADMIN] Entrada paga confirmada para: ${p.nome}`);
                }
            } catch (e) {}
        }
    }
    res.json(propostas);
});

// Atualizar e aprovar proposta / Recalcular Carnê no Admin
app.post('/api/admin/atualizar', async (req, res) => {
    const { id, status, pagamentoEntradaStatus, valorSolicitado, qtdParcelas, percentualEntrada, taxaJuros } = req.body;
    const proposta = propostas.find(p => p.id == id);
    
    if (proposta) {
        if (status) proposta.status = status;
        if (pagamentoEntradaStatus) proposta.pagamentoEntradaStatus = pagamentoEntradaStatus;
        if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
        if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;
        if (percentualEntrada) proposta.percentualEntrada = percentualEntrada;
        if (taxaJuros) proposta.taxaJuros = taxaJuros;

        // Se for aprovado, gera/recalcula a entrada e o carnê de parcelas
        if (proposta.status === 'APROVADO') {
            const valorTotalMercadoria = parseFloat(proposta.valorSolicitado.toString().replace(',', '.'));
            const pEntrada = parseFloat(proposta.percentualEntrada || '20');
            const numParcelas = parseInt(proposta.qtdParcelas || '12');
            const jurosMensal = parseFloat(proposta.taxaJuros || '8.0') / 100;

            const valorEntrada = (valorTotalMercadoria * (pEntrada / 100)).toFixed(2);
            const valorFinanciado = valorTotalMercadoria - valorEntrada;
            const fator = Math.pow(1 + jurosMensal, numParcelas);
            const valorParcelaMensal = ((valorFinanciado * jurosMensal * fator) / (fator - 1)).toFixed(2);

            let copiaEColaPix = proposta.cobrancaPix?.copiaECola || `00020126580014br.gov.bcb.pix0136suporte@flashpointdistribuidora.com.br5204000053039865802BR5925FLASHPOINT DISTRIBUIDORA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;
            let paymentId = proposta.cobrancaPix?.paymentId || null;

            try {
                const payment = new Payment(client);
                const result = await payment.create({
                    body: {
                        transaction_amount: parseFloat(valorEntrada),
                        description: `Entrada Flashpoint - ${proposta.nome}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: proposta.email || 'cliente@flashpoint.com',
                            first_name: proposta.nome.split(' ')[0],
                            last_name: proposta.nome.split(' ').slice(1).join(' ') || 'Cliente',
                            identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') }
                        }
                    }
                });
                if (result && result.point_of_interaction && result.point_of_interaction.transaction_data) {
                    copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
                    paymentId = result.id;
                }
            } catch (mpErr) {}

            proposta.cobrancaPix = {
                valorEntrada: valorEntrada,
                percentualEntrada: pEntrada,
                valorParcelaMensal: valorParcelaMensal,
                copiaECola: copiaEColaPix,
                paymentId: paymentId
            };

            proposta.parcelas = [];
            for (let i = 1; i <= numParcelas; i++) {
                let dataVenc = new Date();
                dataVenc.setMonth(dataVenc.getMonth() + i);
                proposta.parcelas.push({
                    numero: i,
                    valor: valorParcelaMensal,
                    vencimento: dataVenc.toLocaleDateString('pt-BR'),
                    status: 'PENDENTE'
                });
            }
        }
        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
