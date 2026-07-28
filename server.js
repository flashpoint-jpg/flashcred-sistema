const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

const CAMINHO_BANCO = './banco.json'; // Ajuste o caminho se necessário

// Funções Auxiliares de Validação
function lerBanco() {
    try {
        if (!fs.existsSync(CAMINHO_BANCO)) return [];
        const dados = fs.readFileSync(CAMINHO_BANCO, 'utf8');
        return JSON.parse(dados);
    } catch (e) {
        return [];
    }
}

function salvarBanco(dados) {
    fs.writeFileSync(CAMINHO_BANCO, JSON.stringify(dados, null, 2));
}

function validarCPF(cpf) {
    if (!cpf) return false;
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11 || /^(\d)\1{10}$/.test(limpo)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i)) * (10 - i);
    let rev = 11 - (soma % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(limpo.charAt(9))) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i)) * (11 - i);
    rev = 11 - (soma % 11);
    if (rev === 10 || rev === 11) rev = 0;
    return rev === parseInt(limpo.charAt(10));
}

function validarIdade(nascimento) {
    if (!nascimento) return true; // Se não informado, passa
    const hoje = new Date();
    const nasc = new Date(nascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade > 17;
}

// 🛠️ ROTA DE EDIÇÃO COMPLETA DA PROPOSTA
app.post('/api/propostas/editar-tudo', (req, res) => {
    try {
        const { 
            cpfOriginal, nome, cpf, nascimento, endereco, numero, cep, 
            valorTotal, valorEntrada, qtdParcelas, juros, status 
        } = req.body;

        if (!cpfOriginal) {
            return res.status(400).json({ sucesso: false, mensagem: 'O campo cpfOriginal é obrigatório!' });
        }

        let propostas = lerBanco();
        const cpfOrigLimpo = cpfOriginal.replace(/\D/g, '');
        const index = propostas.findIndex(p => p.cpf.replace(/\D/g, '') === cpfOrigLimpo);

        if (index === -1) {
            return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada!' });
        }

        const propostaAtual = propostas[index];

        if (cpf && !validarCPF(cpf)) {
            return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido!' });
        }
        if (nascimento && !validarIdade(nascimento)) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente deve ter mais de 17 anos!' });
        }

        const novoValorTotal = valorTotal !== undefined ? parseFloat(valorTotal) : propostaAtual.valorTotal;
        const novaEntrada = valorEntrada !== undefined ? parseFloat(valorEntrada) : propostaAtual.valorEntrada;
        const novaQtd = qtdParcelas !== undefined ? parseInt(qtdParcelas) : propostaAtual.qtdParcelas;
        const novoJuros = juros !== undefined ? parseFloat(juros) : propostaAtual.juros;

        const tx = novoJuros / 100;
        const restante = Math.max(0, novoValorTotal - novaEntrada);
        
        let valorParcela = 0;
        let totalComJuros = novaEntrada;

        if (novaQtd > 0 && restante > 0) {
            if (tx > 0) {
                valorParcela = parseFloat(((restante * Math.pow(1 + tx, novaQtd)) / novaQtd).toFixed(2));
            } else {
                valorParcela = parseFloat((restante / novaQtd).toFixed(2));
            }
            totalComJuros = parseFloat((novaEntrada + (valorParcela * novaQtd)).toFixed(2));
        }

        propostas[index] = {
            ...propostaAtual,
            nome: nome !== undefined ? nome : propostaAtual.nome,
            cpf: cpf !== undefined ? cpf : propostaAtual.cpf,
            nascimento: nascimento !== undefined ? nascimento : propostaAtual.nascimento,
            endereco: endereco !== undefined ? endereco : propostaAtual.endereco,
            numero: numero !== undefined ? numero : propostaAtual.numero,
            cep: cep !== undefined ? cep : propostaAtual.cep,
            valorTotal: novoValorTotal,
            valorEntrada: novaEntrada,
            qtdParcelas: novaQtd,
            juros: novoJuros,
            valorTotalComJuros: totalComJuros,
            status: status !== undefined ? status : propostaAtual.status,
        };

        if (restante > 0 && novaQtd > 0) {
            const listaParcelas = [];
            const hoje = new Date();
            for (let i = 1; i <= novaQtd; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                
                const parcelaAntiga = propostaAtual.parcelas?.[i - 1];
                
                listaParcelas.push({
                    numero: i,
                    vencimento: venc.toLocaleDateString('pt-BR'),
                    valor: valorParcela,
                    status: parcelaAntiga?.status || 'PENDENTE',
                    dataPagamento: parcelaAntiga?.dataPagamento || null
                });
            }
            propostas[index].parcelas = listaParcelas;
        } else {
            propostas[index].parcelas = [];
        }

        if (novaEntrada > 0) {
            const pixCode = '00020126580014br.gov.bcb.pix0136' + Math.random().toString(36).substring(2, 15);
            propostas[index].cobrancaPix = {
                valorEntrada: novaEntrada,
                copiaECola: pixCode,
                qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`
            };
        } else {
            propostas[index].cobrancaPix = null;
        }

        salvarBanco(propostas);
        return res.json({ sucesso: true, mensagem: 'Proposta alterada com SUCESSO! Tudo atualizado.' });
        
    } catch (e) {
        return res.status(500).json({ sucesso: false, mensagem: 'Erro: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
