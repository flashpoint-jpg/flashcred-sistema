const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Multer para upload de comprovantes
const upload = multer({ dest: 'uploads/' });

// Funções auxiliares para leitura e escrita do banco de dados local (JSON)
const DB_PATH = path.join(__dirname, 'propostas.json');

function lerBanco() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([]));
    }
    try {
        const dados = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(dados);
    } catch (e) {
        return [];
    }
}

function salvarBanco(dados) {
    fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2));
}

// ------------------------------------
// ROTAS DA API
// ------------------------------------

// Rota de Login Genérica[span_0](start_span)[span_0](end_span)
app.post('/api/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

// Login de Administrador[span_1](start_span)[span_1](end_span)
app.post('/api/admin/login', (req, res) => {
    const { usuario, senha } = req.body;
    // Credenciais padrão (ajuste conforme seu uso)
    if (usuario === 'admin' && senha === 'admin123') {
        res.json({ sucesso: true, token: 'token_flashpoint_secure_99' });
    } else {
        res.status(401).json({ sucesso: false, erro: 'Usuário ou senha inválidos.' });
    }
});

// Criar Nova Proposta[span_2](start_span)[span_2](end_span)
app.post('/api/proposta/criar', upload.single('comprovanteRenda'), (req, res) => {
    try {
        const propostas = lerBanco();
        const novaProposta = {
            ...req.body,
            status: 'EM_ANALISE',
            dataCriacao: new Date().toISOString(),
            comprovanteRenda: req.file ? { nomeArquivo: req.file.originalname, caminho: req.file.path } : null
        };
        propostas.push(novaProposta);
        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: 'Proposta criada com sucesso.' });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Listar Propostas[span_3](start_span)[span_3](end_span)
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerBanco();
        res.json({ sucesso: true, propostas });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Consultar Proposta por CPF[span_4](start_span)[span_4](end_span)
app.get('/api/propostas/:cpf', (req, res) => {
    try {
        const cpfBusca = req.params.cpf.replace(/\D/g, '');
        const propostas = lerBanco();
        const proposta = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfBusca);
        if (!proposta) {
            return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });
        }
        res.json({ sucesso: true, proposta });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Atualizar Status da Proposta[span_5](start_span)[span_5](end_span)
app.post('/api/propostas/status', (req, res) => {
    try {
        const { cpf, status } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
        const proposta = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo);

        if (!proposta) {
            return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada.' });
        }

        proposta.status = status;

        // Se aprovado, calcula entrada (10%) e gera parcelas automáticas caso não existam
        if (status === 'APROVADO') {
            const valorSol = parseFloat(proposta.valorSolicitado) || 0;
            const qtdParc = parseInt(proposta.qtdParcelas) || 1;
            const taxaJuros = parseFloat(proposta.juros) || 0;

            const valorEntrada = valorSol * 0.10;
            proposta.valorEntrada = valorEntrada.toFixed(2);
            proposta.cobrancaPix = proposta.cobrancaPix || { valorEntrada: valorEntrada.toFixed(2), status: 'PENDENTE' };

            if (!proposta.parcelas || proposta.parcelas.length === 0) {
                const restante = valorSol - valorEntrada;
                const taxa = taxaJuros / 100;
                let valorParcela = 0;

                if (taxa > 0) {
                    let montante = restante * Math.pow(1 + taxa, qtdParc);
                    valorParcela = montante / qtdParc;
                } else {
                    valorParcela = restante / qtdParc;
                }

                proposta.parcelas = [];
                for (let i = 1; i <= qtdParc; i++) {
                    proposta.parcelas.push({
                        numero: i,
                        valor: valorParcela.toFixed(2),
                        status: 'PENDENTE',
                        vencimento: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    });
                }
            }
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, proposta });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Editar Proposta Completamente[span_6](start_span)[span_6](end_span)
app.post('/api/propostas/editar', (req, res) => {
    try {
        const { cpfOriginal, nome, cpf, telefone, produto, valorSolicitado, valorEntrada, qtdParcelas, juros, endereco } = req.body;
        let propostas = lerBanco();
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfOriginal.replace(/\D/g, ''));

        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada para edição.' });
        }

        let p = propostas[index];
        p.nome = nome;
        p.cpf = cpf;
        p.telefone = telefone;
        p.whatsapp = telefone;
        p.produto = produto;
        p.valorSolicitado = valorSolicitado;
        p.valorEntrada = valorEntrada;
        p.qtdParcelas = qtdParcelas;
        p.juros = juros;
        p.endereco = endereco;

        if (p.cobrancaPix) {
            p.cobrancaPix.valorEntrada = valorEntrada;
        } else {
            p.cobrancaPix = { valorEntrada, status: 'PENDENTE' };
        }

        // Recalcular carnê de parcelas com os novos valores
        const valorSol = parseFloat(valorSolicitado) || 0;
        const valEnt = parseFloat(valorEntrada) || 0;
        const qtdParc = parseInt(qtdParcelas) || 1;
        const taxaJuros = parseFloat(juros) || 0;
        const restante = Math.max(0, valorSol - valEnt);
        const taxa = taxaJuros / 100;
        let valorParcela = 0;

        if (taxa > 0) {
            let montante = restante * Math.pow(1 + taxa, qtdParc);
            valorParcela = montante / qtdParc;
        } else {
            valorParcela = restante / qtdParc;
        }

        p.parcelas = [];
        for (let i = 1; i <= qtdParc; i++) {
            p.parcelas.push({
                numero: i,
                valor: valorParcela.toFixed(2),
                status: 'PENDENTE',
                vencimento: new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, proposta: p });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Excluir Proposta
app.post('/api/propostas/excluir', (req, res) => {
    try {
        const { cpf } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
        
        if (index === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        propostas.splice(index, 1);
        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Atualizar Status de uma Parcela Específica (Admin)
app.post('/api/parcelas/status', (req, res) => {
    try {
        const { cpf, numeroParcela, status } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';
        const proposta = propostas.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo);

        if (!proposta || !proposta.parcelas) {
            return res.status(404).json({ sucesso: false, erro: 'Proposta ou parcelas não encontradas.' });
        }

        const parcela = proposta.parcelas.find(p => p.numero == numeroParcela);
        if (!parcela) {
            return res.status(404).json({ sucesso: false, erro: 'Parcela não encontrada.' });
        }

        parcela.status = status;
        if (status === 'PAGO') {
            parcela.dataPagamento = new Date().toISOString();
        } else {
            delete parcela.dataPagamento;
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: `Parcela ${numeroParcela} atualizada para ${status}.` });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Endpoint de Notificações em Tempo Real para o Painel Admin
app.get('/api/admin/notificacoes', (req, res) => {
    try {
        let propostas = lerBanco();
        let pagamentosRecentes = [];

        propostas.forEach(p => {
            if (p.cobrancaPix && (p.cobrancaPix.status === 'PAGO' || p.cobrancaPix.pago === true)) {
                pagamentosRecentes.push({
                    tipo: 'ENTRADA',
                    cliente: p.nome,
                    cpf: p.cpf,
                    valor: p.cobrancaPix.valorEntrada || p.valorEntrada,
                    data: p.cobrancaPix.dataPagamento || 'Recente'
                });
            }
            if (p.parcelas) {
                p.parcelas.forEach(parc => {
                    if (parc.status === 'PAGO') {
                        pagamentosRecentes.push({
                            tipo: `PARCELA ${parc.numero}`,
                            cliente: p.nome,
                            cpf: p.cpf,
                            valor: parc.valor,
                            data: parc.dataPagamento || 'Recente'
                        });
                    }
                });
            }
        });

        res.json({ sucesso: true, totalPropostas: propostas.length, pagamentosRecentes });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
