<?php
// Arquivo de Edição Manual de Proposta - Distribuidora Flash Point
// Permite ajustar valores, parcelas e percentual de entrada (10% a 75%)

$id_pedido = $_GET['id'] ?? "PIX-984210";
$cliente_nome = "João da Silva";
$valor_total = "1902.00";
$qtd_parcelas = "12";
$percentual_entrada = "20"; // Exemplo: 20%
$valor_entrada = "380.40";
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editar Proposta - #<?php echo $id_pedido; ?></title>
    <style>
        :root {
            --primary: #10B981;
            --primary-dark: #059669;
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
            max-width: 600px;
            margin: 0 auto;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border: 1px solid var(--border-color);
        }

        h2 {
            font-size: 1.25rem;
            margin-bottom: 6px;
        }

        p.sub {
            color: var(--text-muted);
            font-size: 0.85rem;
            margin-bottom: 20px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        label {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--text-main);
        }

        input, select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 0.9rem;
            background: #F8FAFC;
        }

        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            background: #FFFFFF;
        }

        .info-aviso {
            background: #FFFBEB;
            border: 1px solid #FDE68A;
            padding: 10px 14px;
            border-radius: 6px;
            color: #92400E;
            font-size: 0.8rem;
            margin-bottom: 16px;
        }

        .btn-group {
            display: flex;
            gap: 10px;
            margin-top: 24px;
        }

        .btn {
            flex: 1;
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            font-size: 0.9rem;
        }

        .btn:hover { background: var(--primary-dark); }
        .btn-secondary { background: #E2E8F0; color: var(--text-main); }
        .btn-secondary:hover { background: #CBD5E1; }
    </style>
</head>
<body>

<div class="container">
    <div class="card">
        <h2>Editar Proposta #<?php echo $id_pedido; ?></h2>
        <p class="sub">Cliente: <strong><?php echo $cliente_nome; ?></strong></p>

        <div class="info-aviso">
            ⚙️ <strong>Controle Manual:</strong> Aqui você ajusta livremente os valores da compra e define o percentual de entrada ideal (entre 10% e 75%).
        </div>

        <form onsubmit="event.preventDefault(); alert('Proposta atualizada com sucesso!'); window.location.href='painel.php';">
            <div class="form-group">
                <label>Valor Total da Compra (R$)</label>
                <input type="text" value="<?php echo $valor_total; ?>">
            </div>

            <div class="form-group">
                <label>Percentual da Entrada (%) - Varia de 10% a 75%</label>
                <input type="number" min="10" max="75" value="<?php echo $percentual_entrada; ?>">
            </div>

            <div class="form-group">
                <label>Quantidade de Parcelas</label>
                <select>
                    <option value="6" <?php if($qtd_parcelas == '6') echo 'selected'; ?>>6x</option>
                    <option value="10" <?php if($qtd_parcelas == '10') echo 'selected'; ?>>10x</option>
                    <option value="12" <?php if($qtd_parcelas == '12') echo 'selected'; ?>>12x</option>
                    <option value="18" <?php if($qtd_parcelas == '18') echo 'selected'; ?>>18x</option>
                </select>
            </div>

            <div class="btn-group">
                <a href="painel.php" class="btn btn-secondary">Cancelar</a>
                <button type="submit" class="btn">💾 Salvar Alterações</button>
            </div>
        </form>
    </div>
</div>

</body>
</html>
