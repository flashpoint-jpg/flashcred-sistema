// --- ROTA DE WEBHOOK (NOTIFICAÇÃO AUTOMÁTICA DO MERCADO PAGO) ---
app.post('/api/webhook', async (req, res) => {
  try {
    const evento = req.body;

    // Verifica se a notificação é referente a um pagamento
    if (evento.type === 'payment' || evento.action === 'payment.created' || evento.action === 'payment.updated') {
      const paymentId = evento.data?.id || evento.id;

      if (paymentId) {
        // Consulta os detalhes do pagamento lá no Mercado Pago para ter certeza que foi aprovado
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === 'approved') {
          const idDoPagamentoString = String(paymentInfo.id);

          console.log(`Pagamento APROVADO! ID: ${idDoPagamentoString}`);

          // Atualiza o status do cliente para 'pago' ou 'aprovado' direto no Supabase usando o payment_id
          const { error: supabaseError } = await supabase
            .from('clientes')
            .update({ status: 'pago' })
            .eq('payment_id', idDoPagamentoString);

          if (supabaseError) {
            console.error('Erro ao atualizar status no Supabase via Webhook:', supabaseError);
          } else {
            console.log('Painel atualizado automaticamente: Cliente marcado como pago!');
            // Opcional: Aqui você também pode colocar um código para disparar uma mensagem (WhatsApp/E-mail)
          }
        }
      }
    }

    // Responde ao Mercado Pago que a notificação foi recebida com sucesso
    return res.status(200).send('OK');

  } catch (erro) {
    console.error('Erro ao processar webhook:', erro);
    return.status(500).json({ sucesso: false, erro: erro.message });
  }
});
