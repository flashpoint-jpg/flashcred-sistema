app.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = data.id;
            
            // Busca os detalhes do pagamento no Mercado Pago
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${process.env.MP_TOKEN.trim()}` }
            });
            const pag = await response.json();

            if (pag.status === 'approved') {
                const ref = pag.external_reference; // Ex: "12_entrada" ou "12_parcela_1"
                
                if (ref) {
                    const partes = ref.split('_');
                    const propostaId = partes[0];

                    if (ref.includes('entrada')) {
                        // Dá baixa na entrada
                        await supabase.from('propostas').update({ entrada_paga: true }).eq('id', propostaId);
                    } else if (ref.includes('parcela')) {
                        const numParcela = parseInt(partes[2]);
                        // Atualiza a contagem de parcelas pagas no Supabase
                        await supabase.from('propostas').update({ parcelas_pagas: numParcela }).eq('id', propostaId);
                    }
                }
            }
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.sendStatus(500);
    }
});
