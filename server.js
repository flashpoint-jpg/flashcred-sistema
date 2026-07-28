const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static('public'));

const ACCESS_TOKEN_MP = process.env.MP_ACCESS_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'flashcred_secret_key_2026';

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN_MP });
const payment = new Payment(client);

const PORCENTAGEM_ENTRADA = 0.39; // 39%
const TAXA_JUROS_MENSAL = 0.07;   // 7% a.m.

const PROPOSTAS = {};

function autenticarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Acesso não autorizado.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ erro: 'Sessão expirada.' });
        req.user = user;
        next();
    });
}

// CLIENTE: Enviar proposta
app.post('/api/cliente/enviar-proposta', (req, res) => {
    try {
        const { cliente, produto, valorTotal, parcelasSaldo, assinaturaBase64 } = req.body;

        if (!cliente?.cpf || !cliente?.nome || !valorTotal || !assinaturaBase64) {
            return res.status(400).json({ sucesso: false, erro: 'Preencha todos os campos e assine.' });
        }

        const parcelasInt = parseInt(parcelasSaldo);
        if (parcelasInt < 3 || parcelasInt > 6) {
            return res.status(400).json({ sucesso: false, erro: 'Parcelamento deve ser de 3x a 6x.' });
        }

        const idProposta = `PROP-${Date.now()}`;
        const entrada = parseFloat((valorTotal * PORCENTAGEM_ENTRADA).toFixed(2));
        const saldo = valorTotal - entrada;
        const saldoComJuros = saldo * Math.pow((1 + TAXA_JUROS_MENSAL), parcelasInt);
        const valorParcela = parseFloat((saldoComJuros / parcelasInt).toFixed(2));

        PROPOSTAS[idProposta] = {
            id: idProposta,
            cliente,
            produto,
            valorTotal,
            valorEntrada: entrada,
            parcelasSaldo: parcelasInt,
            valorParcela,
            assinaturaBase64,
            status: 'EM_ANALISE',
            pixData: null,
            carneParcelas: [],
            criadoEm: new Date().toLocaleString('pt-BR')
        };

        return res.json({ sucesso: true, idProposta });
    } catch (e) {
        return res.status(500).json({ sucesso: false, erro: 'Erro ao registrar proposta.' });
    }
});

// CLIENTE: Status
app.get('/api/cliente/status-proposta/:id', (req, res) => {
    const prop = PROPOSTAS[req.params.id];
    if (!prop) return res.status(404).json({ erro: 'Não encontrada.' });

    return res.json({
        status: prop.status,
        financeiro: {
            valorTotal: prop.valorTotal,
            valorEntrada: prop.valorEntrada,
            parcelasSaldo: prop.parcelasSaldo,
            valorParcela: prop.valorParcela
        },
        pix: prop.pixData
    });
});

// ADMIN: Login
app.post('/api/admin/login', (req, res) => {
    const { senha } = req.body;
    if (senha === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ sucesso: true, token });
    }
    return res.status(401).json({ sucesso: false, erro: 'Senha incorreta!' });
});

// ADMIN: Listar Propostas
app.get('/api/admin/propostas', autenticarAdmin, (req, res) => {
    return res.json(Object.values(PROPOSTAS).reverse());
});

// ADMIN: Aprovar/Rejeitar e Gerar Carnê
app.post('/api/admin/decisao', autenticarAdmin, async (req, res) => {
    try {
        const { idProposta, decisao, urlWebhookBase } = req.body;
        const prop = PROPOSTAS[idProposta];

        if (!prop) return res.status(404).json({ erro: 'Proposta não encontrada.' });

        if (decisao === 'REJEITAR') {
            prop.status = 'REJEITADO';
            return res.json({ sucesso: true, status: 'REJEITADO' });
        }

        if (decisao === 'APROVAR') {
            const bodyPayment = {
                transaction_amount: prop.valorEntrada,
                description: `Entrada (39%) Flashcred - Pedido ${prop.id}`,
                payment_method_id: 'pix',
                external_reference: prop.id,
                notification_url: `${urlWebhookBase}/api/webhook/mercadopago`,
                payer: {
                    email: prop.cliente.email || 'cliente@flashcred.com.br',
                    first_name: prop.cliente.nome,
                    identification: {
                        type: 'CPF',
                        number: prop.cliente.cpf.replace(/\D/g, '')
                    }
                }
            };

            const responseMP = await payment.create({ body: bodyPayment });

            prop.pixData = {
                qrCodeBase64: responseMP.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: responseMP.point_of_interaction.transaction_data.qr_code
            };

            // Gerar Carnê
            const carne = [];
            const hoje = new Date();
            for (let i = 1; i <= prop.parcelasSaldo; i++) {
                const dataVenc = new Date(hoje);
                dataVenc.setDate(dataVenc.getDate() + (i * 30));
                carne.push({
                    numeroParcela: i,
                    valor: prop.valorParcela,
                    vencimento: dataVenc.toLocaleDateString('pt-BR')
                });
            }
            prop.carneParcelas = carne;

            prop.status = 'APROVADO';
            return res.json({ sucesso: true, status: 'APROVADO' });
        }
    } catch (error) {
        return res.status(500).json({ sucesso: false, erro: 'Erro no Mercado Pago.' });
    }
});

// Webhook Mercado Pago
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const idPagamento = req.body?.data?.id || req.query['data.id'] || req.query.id;
        const tipo = req.body?.type || req.query.topic;

        if (tipo === 'payment' && idPagamento) {
            const dadosPagamento = await payment.get({ id: idPagamento });
            const idProposta = dadosPagamento.external_reference;

            if (dadosPagamento.status === 'approved' && PROPOSTAS[idProposta]) {
                PROPOSTAS[idProposta].status = 'ENTRADA_PAGA';
            }
        }
        return res.status(200).send('OK');
    } catch (err) {
        return res.status(200).send('OK');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`⚡ Servidor rodando na porta ${PORT}`));
