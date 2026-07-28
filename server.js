const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const https = require('https');

const app = express();
const SECRET_KEY = 'flashpoint_secret_jwt_super_seguro';

// ==========================================
// SEU ACCESS TOKEN REAL DO MERCADO PAGO
// ==========================================
const MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'; 

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Configuração de Upload Seguro de Arquivos[span_0](start_span)[span_0](end_span)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads_seguros';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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

function salvar(lista) {
    fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
}

// Validador simples de CPF[span_1](start_span)[span_1](end_span)
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}

// Função para gerar o Pix automático e oficial via API REST do Mercado Pago
function criarPixMercadoPago(valor, descricao, emailPayer) {
    return new Promise((resolve) => {
        const dadosRequisicao = JSON.stringify({
            transaction_amount: Number(valor),
            description: descricao,
            payment_method_id: 'pix',
            payer: { email: emailPayer || 'cliente@flashpoint.com' }
        });

        const options = {
            hostname: 'api.mercadopago.com',
            path: '/v1/payments',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString() + Math.random().toString()
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(responseData);
                    if (json && json.point_of_interaction && json.point_of_interaction.transaction_data) {
                        resolve({
                            qrCode: json.point_of_interaction.transaction_data.qr_code,
                            paymentId: json.id
                        });
                    } else {
                        resolve({ qrCode: "Erro: Verifique o Access Token.", paymentId: null });
                    }
                } catch (err) {
                    resolve({ qrCode: "Erro ao processar resposta.", paymentId: null });
                }
            });
        });

        req.on('error', () => {
            resolve({ qrCode: "Erro de conexão.", paymentId: null });
        });

        req.write(dadosRequisicao);
        req.end();
    });
}

// Rota de Login do Admin[span_2](start_span)[span_2](end_span)
app.post('/api/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === 'flashpoint2026') {
        const token = jwt.sign({ usuario: 'admin' }, SECRET_KEY, { expiresIn: '8h' });
        return res.json({ sucesso: true, token });
    }
    res.status(401).json({ sucesso: false, erro: 'Usuário ou senha inválidos.' });
});

// Middleware de Proteção Admin[span_3](start_span)[span_3](end_span)
function verificarJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ sucesso: false, erro: 'Acesso negado. Token não fornecido.' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
}

// Cadastro de Proposta com Geração Automática via Mercado Pago[span_4](start_span)[span_4](end_span)
app.post('/api/propostas', upload.any(), async (req, res) => {
    try {
        const dados = req.body || {};
        
        if (!dados.cpf || !validarCPF(dados.cpf)) {
            return res.status(400).json({ sucesso: false, erro: 'CPF inválido.' });
        }

        let lista = ler();
        const valorSolicitado = parseFloat(dados.valorSolicitado) || 0;
        const qtdParcelas = parseInt(dados.qtdParcelas) || 12;
        const valorParcela = (valorSolicitado / qtdParcelas).toFixed(2);
        
        const valorEntradaStr = (valorSolicitado * 0.1).toFixed(2);
        
        const resEntrada = await criarPixMercadoPago(
            valorEntradaStr, 
            `Entrada Crediário - CPF ${dados.cpf}`, 
            dados.email
        );

        const parcelas = [];
        const hoje = new Date();
        for (let i = 1; i <= qtdParcelas; i++) {
            let dataVenc = new Date(hoje);
            dataVenc.setMonth(hoje.getMonth() + i);
            
            const resParcela = await criarPixMercadoPago(
                valorParcela, 
                `Parcela ${i}/${qtdParcelas} - CPF ${dados.cpf}`, 
                dados.email
            );

            parcelas.push({
                numero: i,
                vencimento: dataVenc.toLocaleDateString('pt-BR'),
                valor: valorParcela,
                status: 'PENDENTE',
                paymentId: resParcela.paymentId,
                cobrancaPix: { copiaECola: resParcela.qrCode }
            });
        }

        const nova = {
            nome: dados.nome,
            cpf: dados.cpf.replace(/[^\d]/g, ''),
            telefone: dados.telefone,
            email: dados.email,
            produto: dados.produto || 'Crediário Geral',
            endereco: dados.endereco || 'Endereço não cadastrado',
            valorSolicitado: valorSolicitado.toFixed(2),
            status: 'EM_ANALISE',
            pagamentoEntradaStatus: 'PENDENTE',
            paymentIdEntrada: resEntrada.paymentId,
            cobrancaPix: { 
                valorEntrada: valorEntradaStr, 
                copiaECola: resEntrada.qrCode 
            },
            parcelas: parcelas,
            arquivos: req.files ? req.files.map(f => f.filename) : [],
            dataCriacao: new Date().toISOString()
        };

        lista = lista.filter(p => p.cpf !== nova.cpf);
        lista.unshift(nova);
        salvar(lista);

        return res.json({ sucesso: true });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// WEBHOOK: Recebe notificações automáticas do Mercado Pago quando o cliente paga
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const evento = req.body;
        if (evento.type === 'payment' || (evento.action && evento.action.includes('payment'))) {
            const paymentId = evento.data ? evento.data.id : null;
            if (paymentId) {
                // Consulta os detalhes do pagamento direto na API do Mercado Pago
                const options = {
                    hostname: 'api.mercadopago.com',
                    path: `/v1/payments/${paymentId}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}` }
                };

                https.get(options, (resp) => {
                    let data = '';
                    resp.on('data', (chunk) => { data += chunk; });
                    resp.on('end', () => {
                        try {
                            const pagJson = JSON.parse(data);
                            if (pagJson.status === 'approved') {
                                let lista = ler();
                                let alterado = false;

                                lista.forEach(p => {
                                    // Verifica se é a entrada
                                    if (p.paymentIdEntrada && String(p.paymentIdEntrada) === String(paymentId)) {
                                        p.pagamentoEntradaStatus = 'APROVADO';
                                        p.status = 'APROVADO'; // Opcional: aprova a proposta automaticamente
                                        alterado = true;
                                    }
                                    // Verifica se é alguma parcela
                                    if (p.parcelas) {
                                        p.parcelas.forEach(parc => {
                                            if (parc.paymentId && String(parc.paymentId) === String(paymentId)) {
                                                parc.status = 'PAGO';
                                                alterado = true;
                                            }
                                        });
                                    }
                                });

                                if (alterado) salvar(lista);
                            }
                        } catch (e) {}
                    });
                });
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        res.status(200).send('OK');
    }
});

// Listar propostas (Admin)[span_5](start_span)[span_5](end_span)
app.get('/api/propostas', verificarJWT, (req, res) => {
    res.json({ sucesso: true, propostas: ler() });
});

// Buscar proposta por CPF (Cliente)[span_6](start_span)[span_6](end_span)
app.get('/api/propostas/:cpf', (req, res) => {
    const cpfBuscado = req.params.cpf.replace(/[^\d]/g, '');
    const lista = ler();
    const proposta = lista.find(p => p.cpf === cpfBuscado);
    if (proposta) {
        res.json({ sucesso: true, proposta });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});

// Mudar status (Admin)[span_7](start_span)[span_7](end_span)
app.post('/api/propostas/status', verificarJWT, (req, res) => {
    const { cpf, status } = req.body;
    let lista = ler();
    lista.forEach(p => { if (p.cpf === cpf) p.status = status; });
    salvar(lista);
    res.json({ sucesso: true });
});

// Editar proposta (Admin)[span_8](start_span)[span_8](end_span)
app.post('/api/propostas/editar', verificarJWT, (req, res) => {
    const dados = req.body;
    let lista = ler();
    lista.forEach(p => {
        if (p.cpf === dados.cpfOriginal) {
            p.nome = dados.nome || p.nome;
            p.cpf = dados.cpf || p.cpf;
            p.telefone = dados.telefone || p.telefone;
            p.produto = dados.produto || p.produto;
            p.valorSolicitado = dados.valorSolicitado || p.valorSolicitado;
            if (dados.valorEntrada) {
                if (!p.cobrancaPix) p.cobrancaPix = {};
                p.cobrancaPix.valorEntrada = dados.valorEntrada;
            }
            p.endereco = dados.endereco || p.endereco;
        }
    });
    salvar(lista);
    res.json({ sucesso: true });
});

// Pagar parcela específica[span_9](start_span)[span_9](end_span)
app.post('/api/parcelas/pagar', (req, res) => {
    const { cpf, numeroParcela } = req.body;
    let lista = ler();
    let parcelaEncontrada = null;
    
    lista.forEach(p => {
        if (p.cpf === cpf) {
            p.parcelas.forEach(parc => {
                if (parc.numero === Number(numeroParcela)) {
                    parcelaEncontrada = parc;
                }
            });
        }
    });
    
    if (parcelaEncontrada) {
        res.json({ sucesso: true, parcela: parcelaEncontrada });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Parcela não encontrada' });
    }
});

// Gerar Carnê em PDF[span_10](start_span)[span_10](end_span)
app.get('/api/carnet/pdf/:cpf', (req, res) => {
    const cpfBuscado = req.params.cpf.replace(/[^\d]/g, '');
    const lista = ler();
    const proposta = lista.find(p => p.cpf === cpfBuscado);

    if (!proposta) return res.status(404).send('Proposta não encontrada.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Carne_${proposta.cpf}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(20).text('Distribuidora Flashpoint - Carnê Digital', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Titular: ${proposta.nome}`);
    doc.text(`CPF: ${proposta.cpf}`);
    doc.text(`Valor Total / Limite: R$ ${proposta.valorSolicitado}`);
    doc.moveDown();
    doc.text('Demonstrativo de Parcelas:', { underline: true });
    doc.moveDown();

    if (proposta.parcelas) {
        proposta.parcelas.forEach(parc => {
            doc.text(`Parcela ${parc.numero}ª | Vencimento: ${parc.vencimento} | Valor: R$ ${parc.valor} | Status: ${parc.status}`);
        });
    }
    doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando com Mercado Pago e Webhook na porta ${PORT}`);
});
