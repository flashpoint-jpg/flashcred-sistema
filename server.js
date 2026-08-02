const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.get('/api/propostas/:cpf', async (req, res) => {
    try {
        const cpfParam = req.params.cpf;
        const queryText = "SELECT * FROM propostas WHERE regexp_replace(cpf, '\\D', '', 'g') = $1 LIMIT 1";
        const result = await pool.query(queryText, [cpfParam]);

        if (result.rows.length > 0) {
            return res.json({ success: true, data: result.rows[0] });
        } else {
            return res.json({ success: false, message: "Nenhuma proposta encontrada." });
        }
    } catch (error) {
        console.error('Erro na consulta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('*', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FlashCred | Acompanhar Proposta</title>
    <style>
        :root {
            --primary: #0A2463;
            --accent: #32BCAD;
            --accent-hover: #299e91;
            --bg-body: #F4F7FA;
            --text-main: #1E293B;
            --text-muted: #64748B;
            --border-color: #E2E8F0;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { background: var(--bg-body); color: var(--text-main); line-height: 1.5; }

        nav { 
            background: rgba(255, 255, 255, 0.95); 
            backdrop-filter: blur(10px);
            padding: 16px 24px; 
            border-bottom: 1px solid var(--border-color); 
            box-shadow: 0 4px 20px -2px rgba(10, 36, 99, 0.04); 
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .nav-conteudo { max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-weight: 700; color: var(--primary); font-size: 18px; text-decoration: none; }

        .nav-links { display: flex; gap: 12px; align-items: center; }
        .nav-links a { 
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--primary); 
            text-decoration: none; 
            font-weight: 600; 
            font-size: 13px;
            padding: 10px 18px;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 12px rgba(10, 36, 99, 0.06);
            transition: all 0.25s ease;
        }
        .nav-links a:hover { background: var(--primary); color: #ffffff; border-color: transparent; }

        main { max-width: 800px; margin: 40px auto; padding: 0 20px; }

        .card { 
            background: white; 
            padding: 35px; 
            border-radius: 24px; 
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.04); 
            border: 1px solid var(--border-color); 
            margin-bottom: 30px;
        }
        .card h2 { color: var(--primary); margin-bottom: 10px; font-size: 22px; font-weight: 700; }
        .card p { color: var(--text-muted); font-size: 14px; margin-bottom: 25px; }

        .form-group { margin-bottom: 18px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        input { 
            width: 100%; 
            padding: 14px 16px; 
            border: 1.5px solid var(--border-color); 
            border-radius: 16px; 
            font-size: 15px; 
            background: #F8FAFC;
            color: var(--text-main);
        }
        input:focus { outline: none; border-color: var(--accent); background: white; box-shadow: 0 0 0 4px rgba(50, 188, 173, 0.12); }

        .erro { color: #EF4444; font-size: 13px; font-weight: 600; margin-top: 10px; display: none; }

        .btn-consultar { 
            width: 100%; 
            padding: 16px; 
            background: linear-gradient(135deg, var(--accent) 0%, #299e91 100%); 
            color: #04203a; 
            border: none; 
            border-radius: 16px; 
            font-weight: 700; 
            font-size: 16px; 
            cursor: pointer; 
            box-shadow: 0 4px 15px rgba(50, 188, 173, 0.3);
            transition: all 0.2s ease;
        }
        .btn-consultar:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(50, 188, 173, 0.4); }

        #resultado { display: none; animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .status-box {
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 25px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .status { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 16px; display: inline-block; border-radius: 20px; }
        .status.analise { background: #FEF3C7; color: #D97706; }

        .spinner {
            width: 18px;
            height: 18px;
            border: 3px solid rgba(217, 119, 6, 0.3);
            border-top: 3px solid #D97706;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .detalhes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
        @media(max-width: 600px) { .detalhes-grid { grid-template-columns: 1fr; } }

        .detalhe-item { background: #F8FAFC; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); }
        .detalhe-item span { display: block; font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
        .detalhe-item strong { font-size: 16px; color: var(--primary); }

        .btn-whatsapp {
            display: block;
            width: 100%;
            padding: 16px;
            background: #25D366;
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 700;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
            transition: all 0.2s ease;
            margin-top: 20px;
        }
        .btn-whatsapp:hover { background: #22bf5b; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4); }

        footer { 
            background: var(--primary); 
            color: #94A3B8; 
            text-align: center; 
            padding: 30px 20px; 
            margin-top: 60px; 
            font-size: 13px; 
            border-top: 4px solid var(--accent); 
            border-radius: 24px 24px 0 0;
        }
    </style>
</head>
<body>

<nav>
    <div class="nav-conteudo">
        <a href="#" class="logo">FlashCred</a>
        <div class="nav-links">
            <a href="#">Nova Solicitação</a>
            <a href="#">Painel</a>
        </div>
    </div>
</nav>

<main>
    <div class="card">
        <h2>Acompanhe sua Proposta</h2>
        <p>Digite seu CPF cadastrado para verificar o status atual e as condições da sua linha de crédito.</p>

        <form id="formConsulta">
            <div class="form-group">
                <label>Informe seu CPF</label>
                <input type="text" id="cpf" maxlength="14" placeholder="000.000.000-00" required>
            </div>
            <button type="submit" class="btn-consultar">Consultar Proposta</button>
            <div class="erro" id="erroCpf"></div>
        </form>
    </div>

    <div class="card" id="resultado">
        <div class="status-box" id="statusBoxContainer">
            <div class="spinner"></div>
            <div id="statusTexto" class="status analise">Aguardando Análise</div>
        </div>

        <h3 style="color: var(--primary); font-size: 18px; margin-bottom: 15px;">Detalhes da Solicitação</h3>
        <div class="detalhes-grid">
            <div class="detalhe-item" style="grid-column: 1 / -1;">
                <span>Nome do Solicitante</span>
                <strong id="resNome">-</strong>
            </div>
            <div class="detalhe-item">
                <span>CPF</span>
                <strong id="resCpf">-</strong>
            </div>
            <div class="detalhe-item">
                <span>Limite Solicitado</span>
                <strong id="resValor" style="color: var(--accent-hover);">R$ 0,00</strong>
            </div>
        </div>

        <a id="btnWp" href="#" target="_blank" class="btn-whatsapp">Agilizar Análise por WhatsApp</a>
    </div>
</main>

<footer>
    <p>© 2026 FlashCred | Soluções de Pagamento e Limite no Pix. Todos os direitos reservados.</p>
</footer>

<script>
document.getElementById('cpf').addEventListener('input', e => {
    let v = e.target.value.replace(/\\D/g,'');
    if (v.length > 11) v = v.slice(0, 11);
    e.target.value = v.replace(/(\\d{3})(\\d{3})(\\d{3})(\\d{2})/, '$1.$2.$3-$4');
});

function validarCPF(cpf) {
    cpf = cpf.replace(/\\D/g,'');
    if (cpf.length !== 11 || /^(\\d)\\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for(let i=1; i<=9; i++) soma += parseInt(cpf[i-1]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for(let i=1; i<=10; i++) soma += parseInt(cpf[i-1]) * (12 - i);
    resto = (soma * 10) % 11;
    return resto === parseInt(cpf[10]);
}

document.getElementById('formConsulta').addEventListener('submit', e => {
    e.preventDefault();
    const erroEl = document.getElementById('erroCpf');
    const resultadoEl = document.getElementById('resultado');
    
    erroEl.style.display = 'none';
    resultadoEl.style.display = 'none';

    const cpfInput = document.getElementById('cpf').value;
    const cpfLimpo = cpfInput.replace(/\\D/g,'');

    if(!validarCPF(cpfInput)) {
        erroEl.textContent = "CPF inválido, verifique os números digitados.";
        erroEl.style.display = 'block';
        return;
    }

    fetch('/api/propostas/' + cpfLimpo)
    .then(res => res.json())
    .then(result => {
        if (result.success && result.data) {
            const p = result.data;
            resultadoEl.style.display = 'block';
            
            document.getElementById('resNome').textContent = p.nome;
            document.getElementById('resCpf').textContent = p.cpf;
            
            const valorNum = Number(p.valor_desejado);
            const valorFormatado = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('resValor').textContent = valorFormatado;

            const telefoneAtendimento = "5511999999999"; 
            const mensagem = encodeURIComponent("Olá! Gostaria de agilizar a análise da minha proposta. Meu nome é " + p.nome + ", CPF: " + p.cpf + ", limite solicitado: " + valorFormatado + ".");
            document.getElementById('btnWp').href = "https://wa.me/" + telefoneAtendimento + "?text=" + mensagem;

        } else {
            erroEl.textContent = "Nenhuma proposta encontrada para este CPF.";
            erroEl.style.display = 'block';
        }
    })
    .catch(err => {
        console.error('Erro ao consultar:', err);
        erroEl.textContent = "Erro de conexão ao consultar. Tente novamente.";
        erroEl.style.display = 'block';
    });
});
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});
