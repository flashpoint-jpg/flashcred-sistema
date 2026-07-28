// Rota para marcar uma parcela específica como PAGA ou PENDENTE manualmente (Admin)
app.post('/api/parcelas/status', (req, res) => {
    try {
        const { cpf, numeroParcela, status } = req.body; // status: 'PAGO' ou 'PENDENTE'
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

        parcela.status = status; // 'PAGO' ou 'PENDENTE'
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

// Endpoint de Polling / Notificações em Tempo Real para o Admin checar pagamentos recentes
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
