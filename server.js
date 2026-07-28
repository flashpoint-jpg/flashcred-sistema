// Exemplo de rota Webhook para receber confirmação automática de pagamento Pix (ex: Mercado Pago / Gateway)
app.post('/api/webhook/pix', async (req, res) => {
    try {
        const notificacao = req.body;
        
        // Identifique o ID da transação ou o CPF do cliente enviado pelo gateway de pagamento
        // (Dependendo da API do seu gateway, o campo pode variar, ex: notificacao.data.id ou external_reference)
        const idTransacao = notificacao?.data?.id || notificacao?.id;
        
        // Aqui você busca no seu banco de dados ou arquivo JSON a proposta vinculada a essa transação
        // Exemplo simulado de atualização para PAGO:
        let propostas = carregarPropostasDoBanco(); // Função que lê seus dados
        let propostaEncontrada = false;

        propostas.forEach(p => {
            if (p.cobrancaPix && p.cobrancaPix.idTransacao === idTransacao) {
                p.status = 'APROVADO';
                // Atualiza a entrada ou a parcela correspondente para PAGO
                if (p.cobrancaPix) p.cobrancaPix.status = 'PAGO';
                propostaEncontrada = true;
            }
        });

        if (propostaEncontrada) {
            salvarPropostasNoBanco(propostas); // Salva as alterações
            return res.status(200).json({ sucesso: true, mensagem: 'Pagamento confirmado e sistema atualizado automaticamente!' });
        }

        return res.status(404).json({ sucesso: false, mensagem: 'Transação não encontrada.' });
    } catch (erro) {
        console.error('Erro no webhook:', erro);
        return res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota para atualizar o status de aprovação/recusa pelo painel
app.post('/api/propostas/status', async (req, res) => {
    const { cpf, status } = req.body;
    let propostas = carregarPropostasDoBanco();
    let encontrada = false;

    propostas.forEach(p => {
        if (p.cpf === cpf) {
            p.status = status;
            encontrada = true;
        }
    });

    if (encontrada) {
        salvarPropostasNoBanco(propostas);
        return res.json({ sucesso: true });
    }
    return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
});

// Rota para editar dados da proposta pelo painel
app.post('/api/propostas/editar', async (req, res) => {
    const dados = req.body;
    let propostas = carregarPropostasDoBanco();
    let encontrada = false;

    propostas.forEach(p => {
        if (p.cpf === dados.cpfOriginal) {
            p.nome = dados.nome;
            p.cpf = dados.cpf;
            p.telefone = dados.telefone;
            p.produto = dados.produto;
            p.endereco = dados.endereco;
            if (p.cobrancaPix) {
                p.cobrancaPix.valorEntrada = dados.valorEntrada;
            }
            encontrada = true;
        }
    });

    if (encontrada) {
        salvarPropostasNoBanco(propostas);
        return res.json({ sucesso: true });
    }
    return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada' });
});
