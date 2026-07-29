const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Seu Token real do Mercado Pago integrado
const MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_ACCESS_TOKEN });
const payment = new Payment(client);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'propostas.json');

function lerBanco() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    const data = fs.readFileSync(DB_FILE);
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function salvarBanco(dados) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
}

// --- ROTAS DA API ---

app.post('/api/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

app.post('/api/admin/login', (req, res) => {
    res.json({ sucesso: true, token: 'token_flashpoint_secure_99' });
});

// Criar Proposta
app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, telefone, whatsapp, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha os campos obrigatórios.' });
        }

        const propostas = lerBanco();
        const cpfLimpo = cpf.replace(/\D/g, '');

        const propostaExistente = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
        if (propostaExistente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe uma proposta para este CPF.' });
        }

        const telefoneFinal = telefone ? telefone.trim() : (whatsapp ? whatsapp.trim() : '');

        const novaProposta = {
            id: Date.now().toString(),
            nome: nome.trim(),
            cpf: cpf.trim(),
            telefone: telefoneFinal,
            nascimento,
            endereco,
            numero,
            cep,
            valorSolicitado: parseFloat(valorSolicitado),
            status: 'EM_ANALISE',
            qtdParcelas: 6,
            juros: 2.5,
            comprovanteRenda: req.file ? {
                nomeArquivo: req.file.originalname,
                contentType: req.file.mimetype
            } : null,
            parcelas: [],
            cobrancaPix: null,
            pagamentoEntradaStatus: 'PENDENTE'
        };

        propostas.push(novaProposta);
        salvarBanco(propostas);
        
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno: ' + err.message });
    }
});

// Listar todas as propostas
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerBanco();
        res.json({ sucesso: true, propostas });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar propostas.' });
    }
});

// Atualizar Status (Aprovar / Recusar) com Criação de Pix Real no Mercado Pago
app.post('/api/propostas/status', async (req, res) => {
    try {
        const { cpf, status } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
        if (index === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        propostas[index].status = status;
        
        if (status === 'APROVADO' && (!propostas[index].parcelas || propostas[index].parcelas.length === 0)) {
            const valorSol = parseFloat(propostas[index].valorSolicitado || 1000);
            const qtdP = parseInt(propostas[index].qtdParcelas || 6);
            const jrs = parseFloat(propostas[index].juros || 2.5) / 100;
            const valEntrada = parseFloat((valorSol * 0.1).toFixed(2));
            const restante = valorSol - valEntrada;

            let valParcela = jrs > 0 ? (restante * Math.pow(1 + jrs, qtdP)) / qtdP : restante / qtdP;
            valParcela = parseFloat(valParcela.toFixed(2));

            propostas[index].valorEntrada = valEntrada;
            propostas[index].pagamentoEntradaStatus = 'PENDENTE';

            // Criação do Pix Real na API do Mercado Pago para a Entrada
            try {
                const bodyMP = {
                    transaction_amount: valEntrada,
                    description: `Entrada Empréstimo - ${propostas[index].nome}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@flashcred.com',
                        first_name: propostas[index].nome.split(' ')[0],
                        last_name: propostas[index].nome.split(' ').slice(1).join(' ') || 'Cliente',
                        identification: {
                            type: 'CPF',
                            number: cpfLimpo
                        }
                    }
                };

                const responseMP = await payment.create({ body: bodyMP });
                const pixData = responseMP.point_of_interaction.transaction_data;

                propostas[index].cobrancaPix = {
                    valorEntrada: valEntrada,
                    copiaECola: pixData.qr_code,
                    qrcode: pixData.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.qr_code)}`
                };
            } catch (errMp) {
                console.error('Erro ao gerar Pix no MP:', errMp.message);
                const fallbackPix = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266141740005204000053039865405' + valEntrada.toFixed(2) + '5802BR5913FlashCred6009SaoPaulo62070503***63041D3D';
                propostas[index].cobrancaPix = {
                    valorEntrada: valEntrada,
                    copiaECola: fallbackPix,
                    qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fallbackPix)}`
                };
            }

            let listaParcelas = [];
            const hoje = new Date();
            for (let i = 1; i <= qtdP; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                listaParcelas.push({
                    numero: i,
                    vencimento: venc.toLocaleDateString('pt-BR'),
                    valor: valParcela,
                    status: 'PENDENTE'
                });
            }
            propostas[index].parcelas = listaParcelas;
        }

        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Editar Proposta Completa (Admin)
app.post('/api/propostas/editar', async (req, res) => {
    try {
        const { cpfOriginal, nome, cpf, telefone, produto, valorSolicitado, valorEntrada, qtdParcelas, juros, endereco } = req.body;
        let propostas = lerBanco();
        const cpfOrigLimpo = cpfOriginal ? cpfOriginal.replace(/\D/g, '') : '';
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfOrigLimpo);
        if (index === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        const qtdP = parseInt(qtdParcelas) || 6;
        const jrs = parseFloat(juros) || 2.5;
        const valSol = parseFloat(valorSolicitado) || 0;
        const valEnt = parseFloat(valorEntrada) || 0;
        const restante = Math.max(0, valSol - valEnt);
        const taxaMensal = jrs / 100;

        let valParcela = taxaMensal > 0 ? (restante * Math.pow(1 + taxaMensal, qtdP)) / qtdP : restante / qtdP;
        valParcela = parseFloat(valParcela.toFixed(2));

        let listaParcelas = [];
        const hoje = new Date();
        for (let i = 1; i <= qtdP; i++) {
            let venc = new Date(hoje);
            venc.setMonth(venc.getMonth() + i);
            listaParcelas.push({
                numero: i,
                vencimento: venc.toLocaleDateString('pt-BR'),
                valor: valParcela,
                status: 'PENDENTE'
            });
        }

        let cobrancaPixAtual = propostas[index].cobrancaPix;
        try {
            const bodyMP = {
                transaction_amount: valEnt,
                description: `Entrada Empréstimo - ${nome || propostas[index].nome}`,
                payment_method_id: 'pix',
                payer: { email: 'cliente@flashcred.com', first_name: 'Cliente' }
            };
            const responseMP = await payment.create({ body: bodyMP });
            const pixData = responseMP.point_of_interaction.transaction_data;
            cobrancaPixAtual = {
                valorEntrada: valEnt,
                copiaECola: pixData.qr_code,
                qrcode: pixData.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.qr_code)}`
            };
        } catch (e) {
            // Mantém o anterior em caso de falha temporária
        }

        propostas[index] = {
            ...propostas[index],
            nome: nome || propostas[index].nome,
            cpf: cpf || propostas[index].cpf,
            telefone: telefone || propostas[index].telefone,
            produto: produto || propostas[index].produto,
            valorSolicitado: valSol,
            valorEntrada: valEnt,
            pagamentoEntradaStatus: propostas[index].pagamentoEntradaStatus || 'PENDENTE',
            qtdParcelas: qtdP,
            juros: jrs,
            endereco: endereco || propostas[index].endereco,
            parcelas: listaParcelas,
            cobrancaPix: cobrancaPixAtual
        };

        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Pagar Parcela Específica do Carnê via Mercado Pago Real
app.post('/api/parcelas/pagar', async (req, res) => {
    try {
        const { cpf, numeroParcela } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
        const pIndex = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
        if (pIndex === -1) return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada.' });

        let parcela = propostas[pIndex].parcelas.find(parc => parc.numero === numeroParcela);
        if (!parcela) return res.status(404).json({ sucesso: false, mensagem: 'Parcela não encontrada.' });

        try {
            const bodyMP = {
                transaction_amount: parcela.valor,
                description: `Parcela ${numeroParcela} - ${propostas[pIndex].nome}`,
                payment_method_id: 'pix',
                payer: { email: 'cliente@flashcred.com', first_name: propostas[pIndex].nome.split(' ')[0] }
            };

            const responseMP = await payment.create({ body: bodyMP });
            const pixData = responseMP.point_of_interaction.transaction_data;

            parcela.cobrancaPix = {
                copiaECola: pixData.qr_code,
                qrcode: pixData.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.qr_code)}`
            };
        } catch (errMp) {
            const fallbackPix = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266141740005204000053039865405' + parcela.valor.toFixed(2) + '5802BR5913FlashCred6009SaoPaulo62070503***63041D3D';
            parcela.cobrancaPix = {
                copiaECola: fallbackPix,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fallbackPix)}`
            };
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, parcela });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: e.message });
    }
});

// Webhook oficial do Mercado Pago
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const evento = req.body;
        if (evento && evento.type === 'payment') {
            const paymentId = evento.data?.id;
            if (paymentId) {
                const paymentInfo = await payment.get({ id: paymentId });
                if (paymentInfo && paymentInfo.status === 'approved') {
                    let propostas = lerBanco();
                    salvarBanco(propostas);
                }
            }
        }
        res.status(200).send('OK');
    } catch (e) {
        res.status(200).send('OK');
    }
});

// Consultas por CPF
app.get('/api/proposta/consultar', (req, res) => {
    try {
        const cpfParam = req.query.cpf ? req.query.cpf.replace(/\D/g, '') : '';
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfParam);
        
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

app.get('/api/propostas/:cpf', (req, res) => {
    try {
        const cpfParam = req.params.cpf ? req.params.cpf.replace(/\D/g, '') : '';
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfParam);
        
        if (proposta) {
            res.json({ sucesso: true, proposta });
        } else {
            res.json({ sucesso: false, mensagem: 'Proposta não encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
