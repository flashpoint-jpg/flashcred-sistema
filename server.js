// 🛠️ EDIÇÃO COMPLETA DA PROPOSTA (CORRIGIDA E OTIMIZADA)
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

        // Validações se alterar CPF ou data de nascimento
        if (cpf && !validarCPF(cpf)) {
            return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido!' });
        }
        if (nascimento && !validarIdade(nascimento)) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente deve ter mais de 17 anos!' });
        }

        // Tratamento correto para permitir valores iguais a 0 (zero)
        const novoValorTotal = valorTotal !== undefined ? parseFloat(valorTotal) : propostaAtual.valorTotal;
        const novaEntrada = valorEntrada !== undefined ? parseFloat(valorEntrada) : propostaAtual.valorEntrada;
        const novaQtd = qtdParcelas !== undefined ? parseInt(qtdParcelas) : propostaAtual.qtdParcelas;
        const novoJuros = juros !== undefined ? parseFloat(juros) : propostaAtual.juros;

        // Recálculo financeiro
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

        // Atualiza TODOS os dados base
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

        // Atualiza parcelas se houver saldo devedor e quantidade
        if (restante > 0 && novaQtd > 0) {
            const listaParcelas = [];
            const hoje = new Date();
            for (let i = 1; i <= novaQtd; i++) {
                let venc = new Date(hoje);
                venc.setMonth(venc.getMonth() + i);
                
                // Mantém o status e data de pagamento da parcela antiga se ela já existir
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

        // Atualiza Pix da entrada (apenas se houver valor de entrada)
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
