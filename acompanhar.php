<?php
// Dados do pedido
$id_pedido = "PIX-984210";
$data_pedido = "29/07/2026";
$valor_parcela = "R$ 158,50";
$whatsapp_numero = "5511973294235";
$whatsapp_formatado = "(11) 97329-4235";
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acompanhar Pedido - PIX Parcelado</title>
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
            max-width: 900px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 24px;
        }

        header h1 {
            font-size: 1.5rem;
            color: var(--text-main);
            margin-bottom: 4px;
        }

        header p {
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }

        .badge-instant {
            background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
            border: 1px solid #A7F3D0;
            color: #065F46;
            padding: 12px 16px;
            border-radius: 8px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }

        .badge-instant svg {
            width: 24px;
            height: 24px;
            fill: var(--primary);
            flex-shrink: 0;
        }

        .status-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
            margin-bottom: 20px;
        }

        .status-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            color: var(--text-muted);
            letter-spacing: 0.5px;
        }

        .status-value {
            font-weight: 700;
            color: #D97706;
            background: #FEF3C7;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
        }

        .pix-container {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 20px;
            align-items: center;
        }

        @media (max-width: 600px) {
            .pix-container {
                grid-template-columns: 1fr;
                text-align: center;
            }
            .pix-qrcode {
                margin: 0 auto;
            }
        }

        .pix-qrcode {
            width: 180px;
            height: 180px;
            background: #F1F5F9;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-size: 0.8rem;
        }

        .pix-details h3 {
            margin-bottom: 8px;
            font-size: 1.1rem;
        }

        .pix-details p {
            color: var(--text-muted);
            font-size: 0.9rem;
            margin-bottom: 16px;
        }

        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 10px 20px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            text-decoration: none;
        }

        .btn:hover {
            background: var(--primary-dark);
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-main);
        }

        .btn-outline:hover {
            background: #F8FAFC;
        }

        .section-title {
            font-size: 1.1rem;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
            margin-bottom: 16px;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            color: var(--text-muted);
            font-weight: 600;
            background: #F8FAFC;
        }

        .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 16px;
        }

        .parecer-box {
            background: #F0FDF4;
            border: 1px solid #BBF7D0;
            padding: 12px 16px;
            border-radius: 8px;
            color: #166534;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .info-fabrica {
            background: #EFF6FF;
            border: 1px solid #BFDBFE;
            padding: 12px 16px;
            border-radius: 8px;
            color: #1E40AF;
            font-size: 0.9rem;
            margin-bottom: 16px;
            line-height: 1.5;
        }

        .info-entrada {
            background: #FFFBEB;
            border: 1px solid #FDE68A;
            padding: 12px 16px;
            border-radius: 8px;
            color: #92400E;
            font-size: 0.85rem;
            margin-bottom: 16px;
            font-weight: 600;
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>Detalhes da Solicitação</h1>
        <p>Pedido #<?php echo $id_pedido; ?> • Realizado em <?php echo $data_pedido; ?></p>
    </header>

    <!-- Aviso de Pix Parcelado -->
    <div class="badge-instant">
        <svg viewBox="0 0 24 24"><path d="M13,2L3,14H12L11,22L21,10H12L13,2Z"/></svg>
        <div>
            <span>PIX Parcelado Direto da Fábrica:</span> Envie sua proposta e nossa equipe fará a liberação após a análise.
        </div>
    </div>

    <!-- Informação de Compra 100% Online / Fábrica -->
    <div class="info-fabrica">
        📦 <strong>Atendimento 100% Online:</strong> Não trabalhamos com lojas físicas ou parceiros intermediários. Sua compra é feita diretamente da fábrica com total segurança. Acompanhe nossas novidades pelo nosso <strong>Catálogo Digital</strong>, <strong>Facebook</strong> e <strong>Instagram</strong>.
    </div>

    <!-- Aviso Claro sobre a Entrada (Variável de 10% a 75%) -->
    <div class="info-entrada">
        ℹ️ <strong>Condição de Entrada Flexível:</strong> Não exigimos entrada fixa obrigatória. O percentual de entrada varia de <strong>10% a 75%</strong>, conforme a análise detalhada da proposta e perfil de crédito.
    </div>

    <!-- Status e Pagamento Pix -->
    <div class="card">
        <div class="status-box">
            <span class="status-title">Status da Solicitação</span>
            <span class="status-value">Aguardando Análise da Proposta</span>
        </div>

        <div class="pix-container">
            <div class="pix-qrcode">
                [QR CODE PIX]
            </div>
            <div class="pix-details">
                <h3>Definição da Entrada (10% a 75%)</h3>
                <p>O valor da entrada é flexível e definido na análise da proposta (entre 10% e 75%). Após a definição, utilize o QR Code ou copia e cola para efetuar o pagamento.</p>
                <button class="btn" onclick="alert('Código PIX copiado com sucesso!')">
                    📋 Copiar Código PIX
                </button>
            </div>
        </div>
    </div>

    <!-- Detalhamento das Parcelas -->
    <div class="card">
        <div class="section-title">
            <span>Cronograma de Parcelas</span>
            <button class="btn btn-outline" style="font-size: 0.8rem; padding: 6px 12px;" onclick="alert('Gerando PDF de todas as parcelas...')">🖨️ Imprimir Parcelas</button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>01 / 12</td>
                    <td>29/07/2026</td>
                    <td><?php echo $valor_parcela; ?></td>
                    <td><strong style="color: #D97706;">Aguardando Análise</strong></td>
                </tr>
                <tr>
                    <td>02 / 12</td>
                    <td>29/08/2026</td>
                    <td><?php echo $valor_parcela; ?></td>
                    <td>A vencer</td>
                </tr>
                <tr>
                    <td>03 / 12</td>
                    <td>29/09/2026</td>
                    <td><?php echo $valor_parcela; ?></td>
                    <td>A vencer</td>
                </tr>
            </tbody>
        </table>

        <div class="actions-grid">
            <button class="btn btn-outline" onclick="alert('Abrindo simulador de antecipação...')">
                🚀 Adiantar Parcelas (Desconto)
            </button>
        </div>
    </div>

    <!-- Parecer, Contrato e Suporte WhatsApp -->
    <div class="card">
        <div class="section-title"><span>Documentação e Canais Oficiais</span></div>
        <div class="parecer-box" style="margin-bottom: 16px;">
            <span>✨ <strong>Parecer da Análise:</strong> Avaliando o percentual de entrada ideal (10% a 75%).</span>
            <span style="font-weight: 600; color: #D97706;">Em Análise</span>
        </div>
        <div class="actions-grid">
            <button class="btn btn-outline" onclick="alert('Baixando contrato em PDF...')">
                📄 Baixar Contrato Assinado
            </button>
            <a href="https://wa.me/<?php echo $whatsapp_numero; ?>?text=Olá,%20acabei%20de%20enviar%20a%20solicitação%20do%20pedido%20<?php echo $id_pedido; ?>%20e%20gostaria%20de%20tirar%20dúvidas%20sobre%20a%20entrada." target="_blank" class="btn" style="background: #25D366; text-decoration: none; justify-content: center;">
                💬 Suporte WhatsApp (<?php echo $whatsapp_formatado; ?>)
            </a>
        </div>
    </div>
</div>

</body>
</html>
