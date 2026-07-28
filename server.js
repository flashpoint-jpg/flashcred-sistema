app.post('/api/proposta/criar', upload.single('comprovante'), async (req, res) => {
    try {
        const { nome, cpf, nascimento, endereco, numero, cep, valorSolicitado } = req.body;
        
        if (!nome || !cpf || !valorSolicitado) {
            return res.status(400).json({ sucesso: false, mensagem: 'Preencha os campos obrigatórios.' });
        }

        const propostaExistente = await Proposta.findOne({ cpf: cpf.trim() });
        if (propostaExistente) {
            return res.status(400).json({ sucesso: false, mensagem: 'Já existe uma proposta para este CPF.' });
        }

        const novaPropostaData = {
            nome: nome.trim(),
            cpf: cpf.trim(),
            nascimento,
            endereco,
            numero,
            cep,
            valorSolicitado: parseFloat(valorSolicitado),
            status: 'ANALISE'
        };

        if (req.file) {
            novaPropostaData.comprovanteRenda = {
                nomeArquivo: req.file.originalname,
                dados: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        const novaProposta = new Proposta(novaPropostaData);
        await novaProposta.save();
        
        res.json({ sucesso: true, mensagem: 'Proposta enviada com sucesso!' });
    } catch (err) {
        console.error('Erro ao criar proposta:', err);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }
});
