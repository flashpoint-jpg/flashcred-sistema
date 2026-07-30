<?php
// Painel Administrativo / Controle - Distribuidora Flash Point
// 2026 - Controle Manual, Baixa de Entrada e Status em Tempo Real (Estilo Semáforo)
$id_pedido = "PIX-984210";
$cliente_nome = "João da Silva";
$cliente_whats = "5511973294235";
$valor_total = "R$ 1.902,00";
$valor_parcela = "R$ 158,50";

// Exemplo de Status do Banco/Pagamento em Tempo Real (Simulando o semáforo)
// "amarelo" = Aguardando / Pendente
// "verde" = Pago com Sucesso / Recebido em Tempo Real
// "vermelho" = Reprovado / Cancelado
$status_pagamento = "amarelo"; // Altere para "verde" quando o banco confirmar ou se clicar em dar baixa manual
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Controle - Gestão e Semáforo de Pagamentos</title>
    <style>
        :root {
            --primary: #10B981;
            --primary-dark: #059669;
            --danger: #EF4444;
            --danger-dark: #DC2626;
            --warning: #F59E0B;
            --bg-color: #F8FAFC;
            --card-bg: #FFFFFF;
            --text-main: #1E293B;
            --text-muted: #64748B;
            --border-color: #E2E8F0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            padding: 20px;
        }

        .container {
            max-width: 1150px;
            margin: 0 auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        header h1 {
            font-size: 1.3rem;
            color: var(--text-main);
        }

        header p {
            color: var(--text-muted);
            font-size: 0.85rem;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }

        .section-title {
            font-size: 1.1rem;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 700;
        }

        .table-responsive {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
            margin-bottom: 16px;
        }

        th, td {
            padding: 14px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
            vertical-align: middle;
        }

        th {
            color: var(--text-muted);
            font-weight: 600;
            background: #F8FAFC;
        }

        /* Estilo do Semáforo em Tempo Real */
        .semaforo-box {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 0.85rem;
        }

        .lampada {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 8px rgba(0,0,0,0.2);
        }

        /* Cores do Semáforo com efeito de piscar quando amarelo/aguardando */
        .lampada.amarelo {
            background-color: #F59E0B;
            animation: piscar 1.2s infinite ease-in-out;
        }

        .lampada.verde {
            background-color: #10B981;
        }

        .lampada.vermelho {
            background-color: #EF4444;
        }

        @keyframes piscar {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
        }

        .btn-group {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 8px 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 0.8rem;
            text-decoration: none;
        }

        .btn:hover { background: var(--primary-dark); }
        .btn-warning { background: var(--warning); color: white; }
        .btn-warning:hover { background: #D97706; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-danger:hover { background: var(--danger-dark); }
        .btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); }
        .btn-outline:hover { background: #F8FAFC; }
        .btn-whatsapp { background: #25D366; color: white; text-decoration: none; }
        .btn-whatsapp:hover { background: #20BA5A; }
        .btn-manual { background: #3B82F6; color: white; }
        .btn-manual:hover { background: #2563EB; }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <h1>Painel de Controle e Notificações</h1>
            <p>Monitoramento bancário em tempo real e controle de aprovação manual.</p>
        </div>
        <div>
            <span style="font-size: 0.85rem; background: #E0F2FE; color: #0369A1; padding: 6px 12px; border-radius: 20px; font-weight: 600;">
                🟢 Sistema Bancário Sincronizado
            </span>
        </div>
    </header>

    <!-- Tabela de Gestão com Semáforo e Botão de Pagamento Manual -->
    <div class="card">
        <div class="section-title">
            <span>Monitoramento de Entradas e Propostas</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">Entrada Flexível: 10% a 75%</span>
        </div>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Pedido / Cliente</th>
                        <th>Valor Total / Entrada</th>
                        <th>Status Bancário (Tempo Real)</th>
                        <th>Ações Administrativas & Baixa Manual</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>#<?php echo $id_pedido; ?></strong><br>
                            <span style="color: var(--text-muted); font-size: 0.8rem;"><?php echo $cliente_nome; ?></span>
                        </td>
                        <td>
                            Total: <?php echo $valor_total; ?><br>
                            <span style="color: var(--primary-dark); font-weight: 600; font-size: 0.85rem;">Entrada: <?php echo $valor_parcela; ?> (Pendente)</span>
                        </td>
                        <td>
                            <!-- Indicador Estilo Semáforo em Tempo Real -->
                            <?php if($status_pagamento == 'amarelo'): ?>
                                <div class="semaforo-box" style="color: #D97706;">
                                    <span class="lampada amarelo"></span> Aguardando Banco
                                </div>
                            <?php elseif($status_pagamento == 'verde'): ?>
                                <div class="semaforo-box" style="color: #059669;">
                                    <span class="lampada verde"></span> Entrada Recebida!
                                </div>
                            <?php else: ?>
                                <div class="semaforo-box" style="color: #DC2626;">
                                    <span class="lampada vermelho"></span> Pagamento Recusado
                                </div>
                            <?php endif; ?>
                        </td>
                        <td>
                            <div class="btn-group">
                                <!-- Botão de Pagar / Dar Baixa Manual na Entrada -->
                                <button class="btn btn-manual" onclick="alert('Baixa manual da entrada efetuada com sucesso! O status mudou para Recebido.')">
                                    💰 Pagar Manual (Baixa)
                                </button>

                                <!-- Botão de Aprovar -->
                                <button class="btn" onclick="alert('Pedido #<?php echo $id_pedido; ?> aprovado com sucesso por você!')">
                                    ✅ Aprovar
                                </button>

                                <!-- Editar Proposta -->
                                <button class="btn btn-warning" onclick="alert('Abrindo opções para editar valores, parcelas ou percentual de entrada da proposta...')">
                                    ✏️ Editar
                                </button>

                                <!-- Ver Parcelas -->
                                <button class="btn btn-outline" onclick="alert('Visualizando o cronograma completo e valores pendentes...')">
                                    📅 Parcelas
                                </button>

                                <!-- WhatsApp -->
                                <a href="https://wa.me/<?php echo $cliente_whats; ?>?text=Olá%20<?php echo urlencode($cliente_nome); ?>,%20verificamos%20a%20sua%20solicitação%20do%20pedido%20<?php echo $id_pedido; ?>." target="_blank" class="btn btn-whatsapp">
                                    💬 WhatsApp
                                </a>

                                <!-- Recusar -->
                                <button class="btn btn-danger" onclick="alert('Proposta recusada.')">
                                    ❌ Recusar
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

</body>
</html>
