<?php
header('Content-Type: application/json');

// COLE O SEU ACCESS TOKEN DO MERCADO PAGO AQUI DENTRO DAS ASPAS:
$accessToken = 'COLE_SEU_ACCESS_TOKEN_AQUI';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['message' => 'Dados inválidos']);
    exit;
}

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
$erro = curl_error($ch);
curl_close($ch);

if ($erro) {
    echo json_encode(['message' => 'Erro de conexão com Mercado Pago: ' . $erro]);
} else {
    echo $resposta;
}
?>
