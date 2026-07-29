// Servir as páginas do ERP
app.use(express.static(path.join(__dirname, 'public')));

// Rota para marcar parcela como paga/pendente
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

// Rota de notificações
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

// Rota para editar tudo
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
