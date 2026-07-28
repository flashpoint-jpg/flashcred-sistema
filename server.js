const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const JWT_SECRET = process.env.JWT_SECRET || 'flashpoint_secret_key_2026_secure';
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

let propostas = [];

// Rotas de Páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/consultar.html', (req, res) => res.sendFile(path.join(__dirname, 'consultar.html')));
app.get('/parcelas.html', (req, res) => res.sendFile(path.join(__dirname, 'parcelas.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Login Administrativo
app.post('/api/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === 'flashcred2026') {
        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ sucesso: true, token });
    } else {
        res.status(401).json({ sucesso: false, erro: 'Usuário ou senha incorretos.' });
    }
});

// Middleware de verificação de token Admin
function verificarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ sucesso: false, erro: 'Token não fornecido.' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ sucesso: false, erro: 'Sessão expirada ou inválida.' });
        req.admin = decoded;
        next();
    });
}

// Envio de nova proposta
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
            arquivos: arquivos ? Object.keys(arquivos).reduce((acc, key) => { acc[key] = arquivos[key][0].filename; return acc; }, {}) : {},
            dataCriacao: new Date()
        };
        propostas.push(novaProposta);
        console.log(`[NOVA PROPOSTA] Recebida de: ${novaProposta.nome} (CPF: ${novaProposta.cpf})`);
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Webhook Mercado Pago Blindado contra Erros
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const body = req.body;
        console.log('[WEBHOOK RECEBIDO]:', JSON.stringify(body));
        const paymentId = body.data?.id || body.id;
        
        if (paymentId) {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            
            if (paymentInfo && paymentInfo.status === 'approved') {
                const valorPago = paymentInfo.transaction_amount;
                for (let p of propostas) {
                    if (p.cobrancaPix && parseFloat(p.cobrancaPix.valorEntrada) === parseFloat(valorPago) && p.pagamentoEntradaStatus !== 'PAGO') {
                        p.pagamentoEntradaStatus = 'PAGO';
                        console.log(`[WEBHOOK] 💰 ENTRADA PAGA! Cliente: ${p.nome}`);
                        break;
                    }
                    if (p.parcelas) {
                        for (let parc of p.parcelas) {
                            if (parseFloat(parc.valor) === parseFloat(valorPago) && parc.status !== 'PAGO') {
                                parc.status = 'PAGO';
                                parc.dataPagamento = new Date().toLocaleDateString('pt-BR');
                                console.log(`[WEBHOOK] 💰 PARCELA ${parc.numero} PAGA! Cliente: ${p.nome}`);
                                break;
                            }
                        }
                    }
                }
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error('[ERRO NO WEBHOOK]:', err.message);
        res.status(200).send('OK'); // Retorna 200 pro MP não ficar reenviando em loop
    }
});

// Pagamento de Parcela Específica via Pix
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
                payer: { email: proposta.email || 'cliente@flashpoint.com', first_name: proposta.nome.split(' ')[0], last_name: 'Cliente', identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') } }
            }
        });
        if (result && result.point_of_interaction?.transaction_data) {
            copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
            paymentId = result.id;
        }
    } catch (mpErr) {
        console.log('[AVISO MP PARCELA]:', mpErr.message);
    }

    parcela.cobrancaPix = { copiaECola: copiaEColaPix, paymentId };
    res.json({ sucesso: true, parcela });
});

// Geração de PDF do Carnê
app.get('/api/carnet/pdf/:cpf', (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    const proposta = propostas.find(p => p.cpf && p.cpf.replace(/\D/g, '') === cpfLimpo);
    if (!proposta) return res.status(404).send('Proposta não encontrada.');

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Carne_${proposta.nome.replace(/\s+/g, '_')}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).fillColor('#dc2626').text('DISTRIBUIDORA FLASHPOINT', { align: 'center' });
    doc.fontSize(10).fillColor('#555').text('Carnê de Pagamento Crediário Oficial', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text(`Cliente: ${proposta.nome} | CPF: ${proposta.cpf}`);
    doc.text(`Valor Financiado: R$ ${proposta.valorSolicitado} | Condição: ${proposta.qtdParcelas}x`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111').text('Extrato de Parcelas:', { underline: true });
    doc.moveDown(0.5);

    if (proposta.parcelas && proposta.parcelas.length > 0) {
        proposta.parcelas.forEach(p => {
            doc.fontSize(10).fillColor('#333').text(`Parcela ${p.numero}ª - Vencimento: ${p.vencimento} - Valor: R$ ${p.valor} - Status: [ ${p.status} ]`);
        });
    } else {
        doc.text('Nenhuma parcela gerada.');
    }

    doc.end();
});

// Consulta cliente com Auto-Check de Pagamento
app.get('/api/propostas/:cpf', async (req, res) => {
    const cpfLimpo = req.params.cpf.replace(/\D/g, '');
    const proposta = propostas.find(p => p.cpf && p.cpf.replace(/\D/g, '') === cpfLimpo);
    
    if (proposta) {
        if (proposta.cobrancaPix && proposta.cobrancaPix.paymentId && proposta.pagamentoEntradaStatus !== 'PAGO') {
            try {
                const payment = new Payment(client);
                const paymentInfo = await payment.get({ id: proposta.cobrancaPix.paymentId });
                if (paymentInfo && paymentInfo.status === 'approved') {
                    proposta.pagamentoEntradaStatus = 'PAGO';
                    console.log(`[AUTO-CHECK] Entrada confirmada para: ${proposta.nome}`);
                }
            } catch (e) {}
        }
        res.json({ sucesso: true, proposta });
    } else {
        res.json({ sucesso: false });
    }
});

// Listar propostas (Admin) com Auto-Check em lote
app.get('/api/admin/propostas', verificarAdmin, async (req, res) => {
    for (let p of propostas) {
        if (p.cobrancaPix && p.cobrancaPix.paymentId && p.pagamentoEntradaStatus !== 'PAGO') {
            try {
                const payment = new Payment(client);
                const paymentInfo = await payment.get({ id: p.cobrancaPix.paymentId });
                if (paymentInfo && paymentInfo.status === 'approved') {
                    p.pagamentoEntradaStatus = 'PAGO';
                }
            } catch (e) {}
        }
    }
    res.json(propostas);
});

// Atualizar e Recalcular Carnê (Admin)
app.post('/api/admin/atualizar', verificarAdmin, async (req, res) => {
    const { id, status, pagamentoEntradaStatus, valorSolicitado, qtdParcelas, percentualEntrada, taxaJuros } = req.body;
    const proposta = propostas.find(p => p.id == id);
    if (!proposta) return res.status(404).json({ sucesso: false, erro: 'Não encontrado' });

    if (status) proposta.status = status;
    if (pagamentoEntradaStatus) proposta.pagamentoEntradaStatus = pagamentoEntradaStatus;
    if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
    if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;
    if (percentualEntrada) proposta.percentualEntrada = percentualEntrada;
    if (taxaJuros) proposta.taxaJuros = taxaJuros;

    if (proposta.status === 'APROVADO') {
        const valorTotal = parseFloat(proposta.valorSolicitado.toString().replace(',', '.'));
        const pEntrada = parseFloat(proposta.percentualEntrada || '20');
        const numParcelas = parseInt(proposta.qtdParcelas || '12');
        const jurosMensal = parseFloat(proposta.taxaJuros || '8.0') / 100;

        const valorEntrada = (valorTotal * (pEntrada / 100)).toFixed(2);
        const valorFinanciado = valorTotal - valorEntrada;
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
                    payer: { email: proposta.email || 'cliente@flashpoint.com', first_name: proposta.nome.split(' ')[0], identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') } }
                }
            });
            if (result && result.point_of_interaction?.transaction_data) {
                copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
                paymentId = result.id;
            }
        } catch (e) {
            console.log('[AVISO MP ENTRADA]:', e.message);
        }

        proposta.cobrancaPix = { valorEntrada, percentualEntrada: pEntrada, valorParcelaMensal, copiaECola: copiaEColaPix, paymentId };
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Enterprise rodando na porta ${PORT}`));
