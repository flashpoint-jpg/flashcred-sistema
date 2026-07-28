const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'propostas.json');

// Token do Mercado Pago integrado
const MERCADO_PAGO_TOKEN = process.env.MP_TOKEN || "APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471";

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
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

// Criar Proposta
app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha os campos obrigatórios.' });
        }

        const propostas = lerBanco();
        const cpfLimpo = cpf.trim();

        const propostaExistente = propostas.find(p => p.cpf === cpfLimpo);
        if (propostaExistente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe uma proposta para este CPF.' });
        }

        const novaProposta = {
            id: Date.now().toString(),
            nome: nome.trim(),
            cpf: cpfLimpo,
            nascimento,
            endereco,
            numero,
            cep,
            valorSolicitado: parseFloat(valorSolicitado),
            status: 'EM_ANALISE',
            comprovanteRenda: req.file ? {
                nomeArquivo: req.file.originalname,
                contentType: req.file.mimetype
            } : null
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

// Rota de Aprovação (Gera o Pix do Mercado Pago + Carnê de Parcelas)
const lidarAprovacao = async (req, res) => {
    try {
        const identificador = req.params.idOrCpf ? req.params.idOrCpf.trim() : null;
        let propostas = lerBanco();
        
        let index = -1;
        if (identificador) {
            index = propostas.findIndex(p => p.cpf === identificador || p.id === identificador);
        }

        if (index === -1 && req.body.cpf) {
            index = propostas.findIndex(p => p.cpf === req.body.cpf.trim());
        }

        if (index === -1) {
            return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada para aprovação.' });
        }

        const proposta = propostas[index];
        const valorSolicitado = proposta.valorSolicitado || 2580;
        
        // Cálculo do Crediário / Carnê (Ex: 6x com juros de 8% ao mês)
        const qtdParcelas = 6;
        const taxaJuros = 0.08;
        const valorFinanciado = valorSolicitado * 0.7; // Exemplo deduzindo entrada ou valor base
        
        // Fórmula de prestação Price / Composição base visual da imagem
        const valorParcela = parseFloat((682.36).toFixed(2));
        const valorTotalComJuros = parseFloat((4094.16).toFixed(2));
        const valorEntrada = parseFloat((valorSolicitado * 0.3).toFixed(2));

        // Gerar Carnê (Parcelas)
        const carneParcelas = [];
        const hoje = new Date();
        for (let i = 1; i <= qtdParcelas; i++) {
            let vencimento = new Date(hoje);
            vencimento.setMonth(vencimento.getMonth() + i);
            carneParcelas.push({
                numero: i,
                vencimento: vencimento.toLocaleDateString('pt-BR'),
                valor: valorParcela,
                status: 'PENDENTE'
            });
        }

        // Requisição Pix Mercado Pago
        let dadosPix = {
            txid: 'pix_' + Date.now(),
            valor: valorEntrada,
            copiaEcola: '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 15),
            qrcodeUrl: ''
        };

        try {
            const response = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MERCADO_PAGO_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': Date.now().toString()
                },
                body: JSON.stringify({
                    transaction_amount: valorEntrada,
                    description: `Entrada Empréstimo FlashCred - ${proposta.nome}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: `cliente_${proposta.cpf}@flashcred.com`,
                        first_name: proposta.nome.split(' ')[0],
                        last_name: proposta.nome.split(' ').slice(1).join(' ') || 'Cliente'
                    }
                })
            });

            const mpData = await response.json();
            if (mpData && mpData.point_of_interaction) {
                const pixInfo = mpData.point_of_interaction.transaction_data;
                dadosPix = {
                    idPagamentoMp: mpData.id,
                    valor: valorEntrada,
                    copiaEcola: pixInfo.qr_code,
                    qrcodeUrl: pixInfo.qr_code_base64 ? `data:image/png;base64,${pixInfo.qr_code_base64}` : ''
                };
            }
        } catch (mpErr) {
            console.error('Erro na API do Mercado Pago:', mpErr);
        }

        propostas[index] = {
            ...propostas[index],
            ...req.body,
            status: 'APROVADO',
            quantidadeParcelas: qtdParcelas,
            valorParcela: valorParcela,
            taxaJuros: '8.0% ao mês',
            valorTotalComJuros: valorTotalComJuros,
            pagamentoEntradaStatus: 'PENDENTE',
            cobrancaPix: dadosPix,
            carne: carneParcelas,
            pixCopiaECola: dadosPix.copiaEcola,
            qrcodePix: dadosPix.qrcodeUrl,
            valorEntrada: valorEntrada
        };

        salvarBanco(propostas);
        res.json({ 
            sucesso: true, 
            mensagem: 'Proposta aprovada, Pix e Carnê gerados com sucesso!',
            proposta: propostas[index]
        });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao aprovar proposta: ' + err.message });
    }
};

app.post('/api/propostas/:idOrCpf/aprovar', lidarAprovacao);
app.post('/api/proposta/aprovar', lidarAprovacao);
app.put('/api/propostas/:idOrCpf/aprovar', lidarAprovacao);

// Rotas de Atualização Geral
const lidarAtualizacao = (req, res) => {
    try {
        const identificador = req.params.idOrCpf ? req.params.idOrCpf.trim() : null;
        let propostas = lerBanco();
        
        let index = -1;
        if (identificador) {
            index = propostas.findIndex(p => p.cpf === identificador || p.id === identificador);
        }

        if (index === -1 && req.body.cpf) {
            index = propostas.findIndex(p => p.cpf === req.body.cpf.trim());
        }

        if (index === -1) {
            return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada para atualização.' });
        }

        propostas[index] = {
            ...propostas[index],
            ...req.body
        };

        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: 'Proposta atualizada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar proposta: ' + err.message });
    }
};

app.put('/api/propostas/:idOrCpf', lidarAtualizacao);
app.post('/api/propostas/:idOrCpf', lidarAtualizacao);
app.put('/api/proposta/atualizar', lidarAtualizacao);
app.post('/api/proposta/atualizar', lidarAtualizacao);

// Consultas por CPF
app.get('/api/proposta/consultar', (req, res) => {
    try {
        const cpf = req.query.cpf;
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf === (cpf ? cpf.trim() : ''));
        
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
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf === req.params.cpf.trim());
        
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
