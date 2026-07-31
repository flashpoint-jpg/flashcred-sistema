<?php
// Configuração de Produção do Mercado Pago para o Flashcred
$access_token = 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

function gerarPixMercadoPago($valor, $emailCliente, $descricao) {
    global $access_token;
    
    $url = 'https://api.mercadopago.com/v1/payments';
    
    $dados = array(
        "transaction_amount" => floatval($valor),
        "description" => $descricao,
        "payment_method_id" => "pix",
        "payer" => array(
            "email" => $emailCliente
        )
    );

    $payload = json_encode($dados);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "Authorization: Bearer " . $access_token,
        "Content-Type: application/json"
    ));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300) {
        $resData = json_decode($response, true);
        return array(
            "sucesso" => true,
            "payment_id" => $resData['id'],
            "qr_code" => $resData['point_of_interaction']['transaction_data']['qr_code'],
            "qr_code_base64" => $resData['point_of_interaction']['transaction_data']['qr_code_base64']
        );
    } else {
        return array(
            "sucesso" => false,
            "erro" => $response
        );
    }
}
?>
