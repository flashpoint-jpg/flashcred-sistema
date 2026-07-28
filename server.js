app.post('/api/admin/atualizar', async (req, res) => {
    const { id, nome, cpf, telefone, email, status, pagamentoEntradaStatus, valorSolicitado, qtdParcelas, percentualEntrada, taxaJuros } = req.body;
    const proposta = propostas.find(p => p.id == id);
    
    if (proposta) {
        if (nome) proposta.nome = nome;
        if (cpf) proposta.cpf = cpf;
        if (telefone) proposta.telefone = telefone;
        if (email) proposta.email = email;
        if (status) proposta.status = status;
        if (pagamentoEntradaStatus) proposta.pagamentoEntradaStatus = pagamentoEntradaStatus;
        if (valorSolicitado) proposta.valorSolicitado = valorSolicitado;
        if (qtdParcelas) proposta.qtdParcelas = qtdParcelas;
        if (percentualEntrada) proposta.percentualEntrada = percentualEntrada;
        if (taxaJuros) proposta.taxaJuros = taxaJuros;

        if (proposta.status === 'APROVADO') {
            const valorTotalMercadoria = parseFloat(proposta.valorSolicitado.toString().replace(',', '.'));
            const pEntrada = parseFloat(proposta.percentualEntrada || '20');
            const numParcelas = parseInt(proposta.qtdParcelas || '12');
            const jurosMensal = parseFloat(proposta.taxaJuros || '8.0') / 100;

            const valorEntrada = (valorTotalMercadoria * (pEntrada / 100)).toFixed(2);
            const valorFinanciado = valorTotalMercadoria - valorEntrada;
            const fator = Math.pow(1 + jurosMensal, numParcelas);
            const valorParcelaMensal = ((valorFinanciado * jurosMensal * fator) / (fator - 1)).toFixed(2);

            let copiaEColaPix = proposta.cobrancaPix?.copiaECola || `00020126580014br.gov.bcb.pix0136suporte@flashpointdistribuidora.com.br5204000053039865802BR5925FLASHPOINT DISTRIBUIDORA6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;
            let paymentId = proposta.cobrancaPix?.paymentId || null;

            try {
                const payment = new Payment(client);
                const result = await payment.create({
                    body: {
                        transaction_amount: parseFloat(valorEntrada),
                        description: `Entrada Flashpoint - ${proposta.nome}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: proposta.email || 'cliente@flashpoint.com',
                            first_name: proposta.nome.split(' ')[0],
                            last_name: proposta.nome.split(' ').slice(1).join(' ') || 'Cliente',
                            identification: { type: 'CPF', number: proposta.cpf.replace(/\D/g, '') }
                        }
                    }
                });
                if (result && result.point_of_interaction && result.point_of_interaction.transaction_data) {
                    copiaEColaPix = result.point_of_interaction.transaction_data.qr_code;
                    paymentId = result.id;
                }
            } catch (mpErr) {}

            proposta.cobrancaPix = {
                valorEntrada: valorEntrada,
                percentualEntrada: pEntrada,
                valorParcelaMensal: valorParcelaMensal,
                copiaECola: copiaEColaPix,
                paymentId: paymentId
            };

            proposta.parcelas = [];
            for (let i = 1; i <= numParcelas; i++) {
                let dataVenc = new Date();
                dataVenc.setMonth(dataVenc.getMonth() + i);
                proposta.parcelas.push({
                    numero: i,
                    valor: valorParcelaMensal,
                    vencimento: dataVenc.toLocaleDateString('pt-BR'),
                    status: 'PENDENTE'
                });
            }
        }
        res.json({ sucesso: true });
    } else {
        res.status(404).json({ sucesso: false, erro: 'Proposta não encontrada' });
    }
});
