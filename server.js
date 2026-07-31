// --- ROTA DE WEBHOOK (NOTIFICAÇÃO AUTOMÁTICA DO MERCADO PAGO) ---
app.post('/api/webhook', async (req, res) => {
  try {
    const evento = req.body;

    if (evento.type === 'payment' || evento.action === 'payment.created' || evento.action === 'payment.updated') {
      const paymentId = evento.data?.id || evento.id;

      if (paymentId) {
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === 'approved') {
          const idDoPagamentoString = String(paymentInfo.id);

          console.log(`Pagamento APROVADO! ID: ${idDoPagamentoString}`);

          const { error: supabaseError } = await supabase
            .from('clientes')
            .update({ status: 'pago' })
            .eq('payment_id', idDoPagamentoString);

          if (supabaseError) {
            console.error('Erro ao atualizar status no Supabase via Webhook:', supabaseError);
          } else {
            console.log('Painel atualizado automaticamente: Cliente marcado como pago!');
          }
        }
      }
    }

    return res.status(200).send('OK');

  } catch (erro) {
    console.error('Erro ao processar webhook:', erro);
    return res.status(500).json({ sucesso: false, erro: erro.message });
  }
});
