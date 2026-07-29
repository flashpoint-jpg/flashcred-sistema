const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'propostas.json');

// CONFIGURAÇÕES GERAIS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// FUNÇÕES AUXILIARES
function lerBanco() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return []; }
}

function salvarBanco(dados) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2), 'utf8');
}

function validarCPF(cpf) {
    cpf = (cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i-1]) * (11 - i);
    resto = (soma * 10) % 11;
    if ([10, 11].includes(resto)) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i-1]) * (12 - i);
    resto = (soma * 10) % 11;
    if ([10, 11].includes(resto)) resto = 0;
    return resto === parseInt(cpf[10]);
}

function validarIdade(dataNasc) {
    if (!dataNasc) return false;
    const nasc = new Date(dataNasc);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade >= 18;
}

// ROTAS
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// LOGIN ADMIN
app.post('/api/admin/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Painel liberado!' });
});

// CADASTRAR PROPOSTA
app.post('/api/proposta/criar', upload.none(), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !nascimento || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
        }
        if (!validarCPF(cpf)) {
            return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido!' });
        }
        if (!validarIdade(nascimento)) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente deve ter pelo menos 18 anos!' });
        }

        const propostas = lerBanco();
        const cpfLimpo = cpf.replace(/\D/g, '');
        if (propostas.find(p => p.cpf.replace(/\D/g, '') === cpfLimpo)) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe proposta para este CPF.' });
        }

        const nova = {
            id: Date.now().toString(),
            nome: nome.trim(),
            cpf: cpf.trim(),
            nascimento, endereco, numero, cep,
            valorTotal: parseFloat(valorSolicitado),
            status: 'EM_ANALISE',
            valorEntrada: 0, qtdParcelas: 6, juros: 6,
            parcelas: [], cobrancaPix: null,
            dataCadastro: new Date().toLocaleDateString('pt-BR')
        };
        propostas.push(nova);
        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: 'Proposta cadastrada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro: ' + err.message });
    }
});

// LISTAR TODAS PROPOSTAS
app.get('/api/propostas', (req, res) => {
    try {
        const lista = lerBanco().map(p => ({
            ...p,
            totalPago: p.parcelas?.filter(x => x.status === 'PAGO').reduce((s, x) => s + x.valor, 0) || 0,
            totalDevido: p.parcelas?.filter(x => x.status !== 'PAGO').reduce((s, x) => s + x.valor, 0) || 0
        }));
        res.json({ sucesso: true, propostas: lista });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar painel.' });
    }
});

// ALTERAR STATUS / APROVAR PROPOSTA
app.post('/api/propostas/status', (req, res) => {
    try {
        const { cpf, status, valorEntrada, qtdParcelas, juros } = req.body;
        let propostas = lerBanco();
        const cpfLimpo = cpf.replace(/\D/g, '');
        const idx = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfLimpo);
        if (idx === -1) return res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });

        propostas[idx].status = status;
        if (status === 'APROVADO') {
            const valorTotal = propostas[idx].valorTotal;
            const ent = parseFloat(valorEntrada) || (valorTotal * 0.39);
            const qtd = parseInt(qtdParcelas) || 6;
            const tx = (parseFloat(juros) || 6) / 100;
            const restante = Math.max(0, valorTotal - ent);
            const valParcela = parseFloat(((restante * Math.pow(1 + tx, qtd)) / qtd).toFixed(2));

            propostas[idx].valorEntrada = ent;
            propostas[idx].qtdParcelas = qtd;
            propostas[idx].juros = tx * 100;
            propostas[idx].valorTotalComJuros = parseFloat((ent + (valParcela * qtd)).toFixed(2));

            const pixEntrada = '00020126580014br.gov.bcb.pix01363552949852FLASHPOINT';
            propostas[idx].cobrancaPix = {
                valorEntrada: ent,
                copiaECola: pixEntrada,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixEntrada)}`
            };

            const lista = [];
            const hoje = new Date();
            for (let i = 1; i <= qtd; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                lista.push({
                    numero: i,
                    vencimento: venc.toLocaleDateString('pt-BR'),
                    valor: valParcela,
                    status: 'PENDENTE'
                });
            }
            propostas[idx].parcelas = lista;
        }
        salvarBanco(propostas);
        res.json({ sucesso: true });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// MARCAR PARCELA COMO PAGA
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
            parcela.dataPagamento = new Date().toLocaleDateString('pt-BR');
        } else {
            delete parcela.dataPagamento;
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: `Parcela ${numeroParcela} atualizada para ${status}.` });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// NOTIFICAÇÕES ADMIN
app.get('/api/admin/notificacoes', (req, res) => {
    try {
        let propostas = lerBanco();
        let pagamentosRecentes = [];

        propostas.forEach(p => {
            if (p.cobrancaPix && p.pagamentoEntradaStatus === 'PAGO') {
                pagamentosRecentes.push({
                    tipo: 'ENTRADA',
                    cliente: p.nome,
                    cpf: p.cpf,
                    valor: p.valorEntrada,
                    data: 'Recente'
                });
            }
            p.parcelas?.forEach(parc => {
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
        });

        res.json({ sucesso: true, totalPropostas: propostas.length, pagamentosRecentes });
    } catch (e) {
        res.status(500).json({ sucesso: false, erro: e.message });
    }
});

// EDITAR PROPOSTA COMPLETA
app.post('/api/propostas/editar-tudo', (req, res) => {
    try {
        const { cpfOriginal, nome, cpf, nascimento, endereco, numero, cep, valorTotal, valorEntrada, qtdParcelas, juros, status } = req.body;
        let propostas = lerBanco();
        const cpfOrigLimpo = cpfOriginal.replace(/\D/g, '');
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfOrigLimpo);

        if (index === -1) return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada!' });

        if (cpf && !validarCPF(cpf)) return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido!' });
        if (nascimento && !validarIdade(nascimento)) return res.status(400).json({ sucesso: false, mensagem: 'Cliente deve ter pelo menos 18 anos!' });

        const novoValorTotal = parseFloat(valorTotal) || propostas[index].valorTotal;
        const novaEntrada = parseFloat(valorEntrada) || propostas[index].valorEntrada;
        const novaQtd = parseInt(qtdParcelas) || propostas[index].qtdParcelas;
        const novoJuros = parseFloat(juros) || propostas[index].juros;
        const tx = novoJuros / 100;
        const restante = Math.max(0, novoValorTotal - novaEntrada);
        const valorParcela = parseFloat(((restante * Math.pow(1 + tx, novaQtd)) / novaQtd).toFixed(2));

        propostas[index] = {
            ...propostas[index],
            nome: nome || propostas[index].nome,
            cpf: cpf || propostas[index].cpf,
            nascimento: nascimento || propostas[index].nascimento,
            endereco: endereco || propostas[index].endereco,
            numero: numero || propostas[index].numero,
            cep: cep || propostas[index].cep,
            valorTotal: novoValorTotal,
            valorEntrada: novaEntrada,
            qtdParcelas: novaQtd,
            juros: novoJuros,
            valorTotalComJuros: parseFloat((novaEntrada + (valorParcela * novaQtd)).toFixed(2)),
            status: status || propostas[index].status,
        };

        if (restante > 0) {
            const listaParcelas = [];
            const hoje = new Date();
            for (let i = 1; i <= novaQtd; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                listaParcelas.push({
                    numero: i,
                    vencimento: venc.toLocaleDateString('pt-BR'),
                    valor: valorParcela,
                    status: propostas[index].parcelas?.[i-1]?.status || 'PENDENTE',
                    dataPagamento: propostas[index].parcelas?.[i-1]?.dataPagamento
                });
            }
            propostas[index].parcelas = listaParcelas;
        }

        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: 'Proposta alterada com SUCESSO!' });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro: ' + e.message });
    }
});

// CONSULTAR PROPOSTA POR CPF
app.get('/api/proposta/consultar', (req, res) => {
    try {
        const cpf = (req.query.cpf || '').replace(/\D/g, '');
        const proposta = lerBanco().find(p => p.cpf.replace(/\D/g, '') === cpf);
        if (proposta) res.json({ sucesso: true, proposta });
        else res.json({ sucesso: false, mensagem: 'Proposta não localizada' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro na consulta' });
    }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`✅ FlashCred ERP rodando na porta ${PORT}`);
});
