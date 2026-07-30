<?php
// =========================================================================
// SISTEMA INTEGRADO ÚNICO - DISTRIBUIDORA FLASH POINT (2026)
// Inclui: Formulário (index), Acompanhamento (acompanhar), Painel (painel),
// Edição (editar), Bloqueio de CPF Duplicado e Exclusão de Propostas.
// =========================================================================

// Simulação de Banco de Dados em Sessão (para testes locais sem MySQL)
session_start();
if (!isset($_SESSION['propostas'])) {
    $_SESSION['propostas'] = [
        [
            'id' => 'PIX-984210',
            'nome' => 'João da Silva',
            'cpf' => '123.456.789-00',
            'whatsapp' => '5511973294235',
            'whatsapp_fmt' => '(11) 97329-4235',
            'valor_total' => 1902.00,
            'valor_parcela' => 158.50,
            'qtd_parcelas' => 12,
            'percentual_entrada' => 20,
            'status_pagamento' => 'amarelo', // amarelo, verde, vermelho
            'data' => '29/07/2026'
        ]
    ];
}

$acao = $_GET['action'] ?? 'index';

// -------------------------------------------------------------------------
// 1. PROCESSAMENTO DE CADASTRO (POST DO FORMULÁRIO)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['cadastrar'])) {
    $nome = trim($_POST['nome'] ?? '');
    $cpf = trim($_POST['cpf'] ?? '');
    $whatsapp = trim($_POST['whatsapp'] ?? '');
    $valor = floatval($_POST['valor'] ?? 0);
    $parcelas = intval($_POST['parcelas'] ?? 12);

    // Validação Anti-CPF Duplicado
    foreach ($_SESSION['propostas'] as $p) {
        if ($p['cpf'] === $cpf) {
            echo "<script>alert('Este CPF já possui uma proposta cadastrada! Utilize o acompanhamento ou aguarde a liberação.'); window.location.href='?action=index';</script>";
            exit;
        }
    }

    $novo_id = "PIX-" . rand(100000, 999999);
    $vlr_parcela = $valor > 0 ? $valor / $parcelas : 158.50;

    $_SESSION['propostas'][] = [
        'id' => $novo_id,
        'nome' => $nome,
        'cpf' => $cpf,
        'whatsapp' => preg_replace('/\D/', '', $whatsapp),
        'whatsapp_fmt' => $whatsapp,
        'valor_total' => $valor,
        'valor_parcela' => $vlr_parcela,
        'qtd_parcelas' => $parcelas,
        'percentual_entrada' => 20,
        'status_pagamento' => 'amarelo',
        'data' => date('d/m/Y')
    ];

    echo "<script>alert('Proposta enviada com sucesso! Protocolo: {$novo_id}'); window.location.href='?action=acompanhar&id={$novo_id}';</script>";
    exit;
}

// -------------------------------------------------------------------------
// 2. AÇÕES DO PAINEL (APROVAR, BAIXA, EXCLUIR, EDITAR)
// -------------------------------------------------------------------------
if (isset($_GET['do'])) {
    $id_alvo = $_GET['id'] ?? '';
    foreach ($_SESSION['propostas'] as $key => $p) {
        if ($p['id'] === $id_alvo) {
            if ($_GET['do'] === 'baixar') $_SESSION['propostas'][$key]['status_pagamento'] = 'verde';
            if ($_GET['do'] === 'aprovar') $_SESSION['propostas'][$key]['status_pagamento'] = 'verde';
            if ($_GET['do'] === 'recusar') $_SESSION['propostas'][$key]['status_pagamento'] = 'vermelho';
            if ($_GET['do'] === 'excluir') {
                unset($_SESSION['propostas'][$key]);
                $_SESSION['propostas'] = array_values($_SESSION['propostas']);
                echo "<script>alert('Proposta excluída e CPF liberado!'); window.location.href='?action=painel';</script>";
                exit;
            }
        }
    }
    if ($_GET['do'] !== 'excluir') {
        echo "<script>alert('Ação executada com sucesso!'); window.location.href='?action=painel';</script>";
        exit;
    }
}

// Salvar Edição
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['salvar_edicao'])) {
    $id_ed = $_POST['id_pedido'] ?? '';
    foreach ($_SESSION['propostas'] as $key => $p) {
        if ($p['id'] === $id_ed) {
            $_SESSION['propostas'][$key]['valor_total'] = floatval($_POST['valor_total']);
            $_SESSION['propostas'][$key]['percentual_entrada'] = intval($_POST['percentual_entrada']);
            $_SESSION['propostas'][$key]['qtd_parcelas'] = intval($_POST['qtd_parcelas']);
        }
    }
    echo "<script>alert('Proposta atualizada com sucesso!'); window.location.href='?action=painel';</script>";
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Distribuidora Flash Point - Pix Parcelado</title>
    <style>
        :root {
            --primary: #10B981;
            --primary-dark: #059669;
            --bg-color: #F8FAFC;
            --card-bg: #FFFFFF;
            --text-main: #1E293B;
            --text-muted: #64748B;
            --border-color: #E2E8F0;
            --danger: #EF4444;
            --warning: #F59E0B;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
        body { background-color: var(--bg-color); color: var(--text-main); padding: 20px; }
        .container { max-width: 950px; margin: 0 auto; }
        .card { background: var(--card-bg); border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid var(--border-color); }
        .nav-top { display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; }
        .nav-top a { padding: 8px 16px; background: #E2E8F0; color: var(--text-main); text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }
        .nav-top a.active { background: var(--primary); color: white; }
        .btn { background: var(--primary); color: white; border: none; padding: 10px 20px; font-weight: 600; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; }
        .btn:hover { background: var(--primary-dark); }
        .form-group { margin-bottom: 16px; }
        label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; }
        input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: #F8FAFC; }
        input:focus, select:focus { outline: none; border-color: var(--primary); background: #FFF; }
        .badge-fabrica { background: #EFF6FF; border: 1px solid #BFDBFE; padding: 12px; border-radius: 8px; color: #1E40AF; font-size: 0.85rem; margin-bottom: 16px; line-height: 1.4; }
        .badge-entrada { background: #FFFBEB; border: 1px solid #FDE68A; padding: 12px; border-radius: 8px; color: #92400E; font-size: 0.85rem; margin-bottom: 16px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
        th { background: #F8FAFC; color: var(--text-muted); }
        .semaforo { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
        .semaforo.amarelo { background: #F59E0B; animation: piscar 1.2s infinite ease-in-out; }
        .semaforo.verde { background: #10B981; }
        .semaforo.vermelho { background: #EF4444; }
        @keyframes piscar { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .btn-group { display: flex; flex-wrap: wrap; gap: 5px; }
        .btn-sm { padding: 6px 10px; font-size: 0.75rem; border-radius: 4px; }
        .btn-warning { background: var(--warning); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-manual { background: #3B82F6; color: white; }
        .btn-whats { background: #25D366; color: white; text-decoration: none; }
    </style>
</head>
<body>

<div class="container">
    <div class="nav-top">
        <a href="?action=index" class="<?php echo $acao == 'index' ? 'active' : ''; ?>">Solicitar Pix</a>
        <a href="?action=acompanhar" class="<?php echo $acao == 'acompanhar' ? 'active' : ''; ?>">Acompanhar Pedido</a>
        <a href="?action=painel" class="<?php echo $acao == 'painel' ? 'active' : ''; ?>">Painel Admin</a>
    </div>

    <?php if ($acao === 'index'): ?>
        <!-- ================= TELA 1: FORMULÁRIO ================= -->
        <div class="card">
            <h1 style="font-size: 1.4rem; margin-bottom: 4px;">DISTRIBUIDORA FLASH POINT</h1>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">Compre seus móveis no Pix Parcelado • Atendimento 100% Online Direto da Fábrica</p>

            <div class="badge-fabrica">
                📦 <strong>Atendimento 100% Online:</strong> Sem lojas físicas ou parceiros intermediários. Acompanhe pelo nosso Catálogo Digital, Facebook e Instagram.
            </div>

            <div class="badge-entrada">
                ℹ️ <strong>Condição Flexível:</strong> Não exigimos entrada fixa. O percentual varia de <strong>10% a 75%</strong> conforme análise da proposta.
            </div>

            <form method="POST">
                <div class="form-group">
                    <label>NOME COMPLETO</label>
                    <input type="text" name="nome" required placeholder="Digite seu nome completo">
                </div>
                <div class="form-group">
                    <label>CPF (VALIDAÇÃO AUTOMÁTICA - BLOQUEIA DUPLICADOS)</label>
                    <input type="text" name="cpf" required placeholder="000.000.000-00">
                </div>
                <div class="form-group">
                    <label>WHATSAPP</label>
                    <input type="text" name="whatsapp" required placeholder="(11) 00000-0000">
                </div>
                <div class="form-group">
                    <label>VALOR DESEJADO PARA COMPRA (R$)</label>
                    <input type="number" step="0.01" name="valor" required placeholder="1902.00">
                </div>
                <div class="form-group">
                    <label>QUANTIDADE DE PARCELAS NO PIX</label>
                    <select name="parcelas">
                        <option value="6">6x</option>
                        <option value="10">10x</option>
                        <option value="12" selected>12x</option>
                        <option value="18">18x</option>
                    </select>
                </div>
                <button type="submit" name="cadastrar" class="btn" style="width: 100%; justify-content: center;">Enviar Solicitação</button>
            </form>
        </div>

    <?php elseif ($acao === 'acompanhar'): 
        $pedido_atual = $_SESSION['propostas'][0] ?? null;
        if(isset($_GET['id'])) {
            foreach($_SESSION['propostas'] as $p) {
                if($p['id'] === $_GET['id']) $pedido_atual = $p;
            }
        }
    ?>
        <!-- ================= TELA 2: ACOMPANHAR ================= -->
        <div class="card">
            <h1 style="font-size: 1.4rem; margin-bottom: 4px;">Detalhes da Solicitação</h1>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">Pedido #<?php echo $pedido_atual['id'] ?? 'N/A'; ?> • Cliente: <?php echo $pedido_atual['nome'] ?? 'N/A'; ?></p>

            <div class="badge-fabrica">
                📦 Atendimento 100% online direto da fábrica. Entrada flexível entre 10% e 75% definida após análise.
            </div>

            <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong>Status Atual:</strong> 
                <?php if(($pedido_atual['status_pagamento']??'') == 'amarelo'): ?>
                    <span style="color: #D97706; font-weight: bold;">Aguardando Análise / Pagamento da Entrada</span>
                <?php elseif(($pedido_atual['status_pagamento']??'') == 'verde'): ?>
                    <span style="color: #059669; font-weight: bold;">Entrada Aprovada / Pedido Liberado!</span>
                <?php else: ?>
                    <span style="color: #DC2626; font-weight: bold;">Proposta Recusada</span>
                <?php endif; ?>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="https://wa.me/55<?php echo $pedido_atual['whatsapp'] ?? '11973294235'; ?>?text=Olá,%20gostaria%20de%20enviar%20o%20comprovante%20do%20pedido%20<?php echo $pedido_atual['id'] ?? ''; ?>" target="_blank" class="btn" style="background: #25D366;">💬 Enviar Comprovante WhatsApp</a>
                <a href="?action=index" class="btn" style="background: #64748B;">Novo Cadastro</a>
            </div>
        </div>

    <?php elseif ($acao === 'painel'): ?>
        <!-- ================= TELA 3: PAINEL ADMINISTRATIVO ================= -->
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h1 style="font-size: 1.3rem;">Painel de Controle do Gestor</h1>
                <span style="background: #E0F2FE; color: #0369A1; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Modo Manual Ativo</span>
            </div>

            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Pedido / Cliente / CPF</th>
                            <th>Valores (Total / Parcela)</th>
                            <th>Status (Semáforo)</th>
                            <th>Ações Administrativas</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if(empty($_SESSION['propostas'])): ?>
                            <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma proposta cadastrada.</td></tr>
                        <?php else: foreach($_SESSION['propostas'] as $p): ?>
                            <tr>
                                <td>
                                    <strong>#<?php echo $p['id']; ?></strong><br>
                                    <span style="font-size: 0.8rem;"><?php echo $p['nome']; ?></span><br>
                                    <span style="font-size: 0.75rem; color: var(--text-muted);">CPF: <?php echo $p['cpf']; ?></span>
                                </td>
                                <td>
                                    Total: R$ <?php echo number_format($p['valor_total'], 2, ',', '.'); ?><br>
                                    <span style="color: var(--primary-dark); font-weight: 600;">Parcela: R$ <?php echo number_format($p['valor_parcela'], 2, ',', '.'); ?></span>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: bold;">
                                        <span class="semaforo <?php echo $p['status_pagamento']; ?>"></span>
                                        <?php 
                                            if($p['status_pagamento']=='amarelo') echo 'Aguardando';
                                            elseif($p['status_pagamento']=='verde') echo 'Recebido/Aprovado';
                                            else echo 'Recusado';
                                        ?>
                                    </div>
                                </td>
                                <td>
                                    <div class="btn-group">
                                        <a href="?action=painel&do=baixar&id=<?php echo $p['id']; ?>" class="btn btn-sm btn-manual" title="Dar baixa na entrada">💰 Baixar</a>
                                        <a href="?action=painel&do=aprovar&id=<?php echo $p['id']; ?>" class="btn btn-sm" title="Aprovar pedido">✅ Aprovar</a>
                                        <a href="?action=editar&id=<?php echo $p['id']; ?>" class="btn btn-sm btn-warning">✏️ Editar</a>
                                        <a href="https://wa.me/55<?php echo $p['whatsapp']; ?>" target="_blank" class="btn btn-sm btn-whats">💬 WhatsApp</a>
                                        <a href="?action=painel&do=recusar&id=<?php echo $p['id']; ?>" class="btn btn-sm btn-danger">❌ Recusar</a>
                                        <a href="?action=painel&do=excluir&id=<?php echo $p['id']; ?>" class="btn btn-sm" style="background: #475569;" onclick="return confirm('Tem certeza que deseja excluir e liberar o CPF?');">🗑️ Excluir</a>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

    <?php elseif ($acao === 'editar'): 
        $id_ed = $_GET['id'] ?? '';
        $prop_edit = null;
        foreach($_SESSION['propostas'] as $p) { if($p['id'] === $id_ed) $prop_edit = $p; }
    ?>
        <!-- ================= TELA 4: EDITAR PROPOSTA ================= -->
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h1 style="font-size: 1.2rem; margin-bottom: 4px;">Editar Proposta #<?php echo $prop_edit['id'] ?? ''; ?></h1>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Cliente: <?php echo $prop_edit['nome'] ?? ''; ?></p>

            <form method="POST">
                <input type="hidden" name="id_pedido" value="<?php echo $prop_edit['id'] ?? ''; ?>">
                <div class="form-group">
                    <label>Valor Total da Compra (R$)</label>
                    <input type="text" name="valor_total" value="<?php echo $prop_edit['valor_total'] ?? ''; ?>">
                </div>
                <div class="form-group">
                    <label>Percentual da Entrada (%) [10% a 75%]</label>
                    <input type="number" min="10" max="75" name="percentual_entrada" value="<?php echo $prop_edit['percentual_entrada'] ?? 20; ?>">
                </div>
                <div class="form-group">
                    <label>Quantidade de Parcelas</label>
                    <select name="qtd_parcelas">
                        <option value="6" <?php if(($prop_edit['qtd_parcelas']??12)==6) echo 'selected'; ?>>6x</option>
                        <option value="12" <?php if(($prop_edit['qtd_parcelas']??12)==12) echo 'selected'; ?>>12x</option>
                        <option value="18" <?php if(($prop_edit['qtd_parcelas']??12)==18) echo 'selected'; ?>>18x</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <a href="?action=painel" class="btn" style="background: #E2E8F0; color: #1E293B; flex: 1; justify-content: center;">Cancelar</a>
                    <button type="submit" name="salvar_edicao" class="btn" style="flex: 1; justify-content: center;">Salvar Alterações</button>
                </div>
            </form>
        </div>
    <?php endif; ?>

</div>

</body>
</html>
