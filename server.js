const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

// Banco de dados em memória temporário
const bancoDeDados = {};

// Rota principal para abrir o site diretamente
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FlashCred - Crédito Facilitado</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Roboto, sans-serif; }
            body { background: linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%); padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .container { width: 100%; max-width: 480px; background: #FFFFFF; padding: 24px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
            .cabecalho { text-align: center; margin-bottom: 20px; }
            .logo-icone { width: 56px; height: 56px; background: #F5A623; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 24px; font-weight: bold; color: #FFF; }
            h1 { color: #1A1A1A; font-size: 24px; margin-bottom: 4px; }
            p { color: #666; font-size: 14px; margin-bottom: 20px; text-align: center; }
            .campo { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; color: #333; }
            input { width: 100%; padding: 12px; border: 1.5px solid #E0E0E0; border-radius: 10px; font-size: 15px; }
            button { width: 100%; padding: 14px; background: #F5A623; color: #FFF; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px; }
            button:hover { background: #E69500; }
            .resultado { margin-top: 15px; padding: 15px; border-radius: 10px; display: none; text-align: center; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="cabecalho">
                <div class="logo-icone">FC</div>
                <h1>FlashCred</h1>
                <p>Crédito simples, rápido e seguro</p>
            </div>
            <form id="formCliente">
                <div class="campo"><label>Nome Completo</label><input type="text" id="nome" required placeholder="Seu nome"></div>
                <div class="campo"><label>CPF</label><input type="text" id="cpf" required placeholder="000.000.000-00"></div>
                <div class="campo"><label>Valor Desejado (R$)</label><input type="number" id="valorCredito" required placeholder="Ex: 1500"></div>
                <button type="submit">Enviar Solicitação</button>
            </form>
            <div id="resultado" class="resultado"></div>
        </div>
        <script>
            document.getElementById('formCliente').addEventListener('submit', async e => {
                e.preventDefault();
                const dados = {
                    nome: document.getElementById('nome').value,
                    cpf: document.getElementById('cpf').value,
                    valorCredito: parseFloat(document.getElementById('valorCredito').value)
                };
                const res = await fetch('/api/solicitacoes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                if(res.ok) {
                    alert('✅ Solicitação enviada com sucesso!');
                    e.target.reset();
                } else {
                    alert('Erro ao enviar.');
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Rotas da API
app.post('/api/solicitacoes', (req, res) => {
    const dados = req.body;
    if (!dados.cpf || !dados.nome) return res.status(400).json({ erro: 'Dados incompletos' });
    const cpfLimpo = dados.cpf.replace(/\D/g, '');
    bancoDeDados[cpfLimpo] = { ...dados, status: 'em_analise', data: new Date().toLocaleDateString('pt-BR') };
    res.status(201).json({ sucesso: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
