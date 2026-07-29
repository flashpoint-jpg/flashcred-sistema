<?php
header('Content-Type: application/json');

// COLE O SEU ACCESS TOKEN DO MERCADO PAGO AQUI DENTRO DAS ASPAS:
$accessToken = 
APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471
$arquivoBanco = 'propostas.json';

function lerPropostas() {
    global $arquivoBanco;
    if (!file_exists($arquivoBanco)) return [];
    $conteudo = file_get_contents($arquivoBanco);
    return json_decode($conteudo, true) ?: [];
}

function salvarPropostas($propostas) {
    global $arquivoBanco;
    file_put_contents($arquivoBanco, json_encode(array_values($propostas), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$acao = $_GET['acao'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
if (isset($input['acao'])) {
    $acao = $input['acao'];
}

if ($acao === 'listar') {
    echo json_encode(lerPropostas());
    exit;
}

if ($acao === 'consultar') {
    $cpf = $_GET['cpf'] ?? '';
    $propostas = lerPropostas();
    $encontrada = null;
    foreach ($propostas as $p) {
        if ($p['cpf'] === $cpf) {
            $encontrada = $p;
            break;
        }
    }
    echo json_encode($encontrada);
    exit;
}

if ($acao === 'salvar_proposta') {
    $propostas = lerPropostas();
    $nova = $input['proposta'];
    // Remove anterior se já existir o CPF para atualizar
    $propostas = array_filter($propostas, function($p) use ($nova) {
        return $p['cpf'] !== $nova['cpf'];
    });
    array_unshift($propostas, $nova);
    salvarPropostas($propostas);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'atualizar_status') {
    $cpf = $input['cpf'];
    $novoStatus = $input['status'];
    $propostas = lerPropostas();
    foreach ($propostas as &$p) {
        if ($p['cpf'] === $cpf) {
            $p['status'] = $novoStatus;
        }
    }
    salvarPropostas($propostas);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'marcar_pago') {
    $cpf = $input['cpf'];
    $propostas = lerPropostas();
    foreach ($propostas as &$p) {
        if ($p['cpf'] === $cpf) {
            $p['entradaPaga'] = true;
        }
    }
    salvarPropostas($propostas);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'editar_proposta') {
    $cpf = $input['cpf'];
    $novos = $input['novosDados'];
    $propostas = lerPropostas();
    foreach ($propostas as &$p) {
        if ($p['cpf'] === $cpf) {
            $p['valorSolicitado'] = $novos['valorSolicitado'];
            $p['percEntrada'] = $novos['percEntrada'];
            $p['percJuros'] = $novos['percJuros'];
            $p['qtdParcelas'] = $novos['qtdParcelas'];
        }
    }
    salvarPropostas($propostas);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'gerar_pix') {
    $cpf = $input['cpf'];
    $dadosRequisicao = [
        'transaction_amount' => $input['transaction_amount'],
        'description' => $input['description'],
        'payment_method_id' => 'pix',
        'payer' => $input['payer']
    ];

    $ch = curl_init('https://api.mercadopago.com/v1/payments');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($dadosRequisicao));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);

    $resposta = curl_exec($ch);
    curl_close($ch);

    $resultado = json_decode($resposta, true);
    if (isset($resultado['point_of_interaction'])) {
        $qrCode = $resultado['point_of_interaction']['transaction_data']['qr_code'];
        $linkPagamento = $resultado['point_of_interaction']['transaction_data']['ticket_url'];
        
        $propostas = lerPropostas();
        foreach ($propostas as &$p) {
            if ($p['cpf'] === $cpf) {
                $p['cobrancaPix'] = [
                    'copiaECola' => $qrCode,
                    'link' => $linkPagamento,
                    'valor' => $input['transaction_amount']
                ];
            }
        }
        salvarPropostas($propostas);
    }

    echo $resposta;
    exit;
}
?>
