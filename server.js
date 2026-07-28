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

// 1. Rota de Login
app.post('/api/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

app.post('/api/admin/login', (req, res) => {
    res.json({ sucesso: true, mensagem: 'Acesso liberado.' });
});

// 2. Criar Proposta
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

// 3. Listar todas as propostas
app.get('/api/propostas', (req, res) => {
    try {
        const propostas = lerBanco();
        res.json({ sucesso: true, propostas });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar propostas.' });
    }
});

// 4. Atualizar Proposta (Resolve o erro ao clicar em Salvar Alterações)
app.put('/api/propostas/:cpf', (req, res) => {
    try {
        const cpfAlvo = req.params.cpf.trim();
        let propostas = lerBanco();
        const index = propostas.findIndex(p => p.cpf === cpfAlvo);

        if (index === -1) {
            return res.status(404).json({ sucesso: false, mensagem: 'Proposta não encontrada para atualização.' });
        }

        // Atualiza os dados enviados pelo painel mantendo o ID e CPF
        propostas[index] = {
            ...propostas[index],
            ...req.body,
            cpf: cpfAlvo
        };

        salvarBanco(propostas);
        res.json({ sucesso: true, mensagem: 'Proposta atualizada com sucesso!' });
    } catch (err) {
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar proposta.' });
    }
});

// 5. Consultar por CPF (Query)
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

// 6. Consultar por CPF (Parâmetro)
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
