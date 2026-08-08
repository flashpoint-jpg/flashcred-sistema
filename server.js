const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do Supabase no Backend
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
// Dica: Utilize a chave service_role do Supabase nas variáveis de ambiente do Render para ter permissão total de update
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rota para gerar o Pix (Entrada ou Parcelas)
app.post('/gerar-pix', async (req, res) => {
    try {
        // Usa o seu token fixo ou busca da variável de ambiente (já deixamos configurado com o seu)
        const token = process.env.MP_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';
        if (!token) {
            return res.status(400).json({ message: "authorization value not present" });
        }

        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.trim()}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": "ID-" + Date.now()
            },
            body: JSON.stringify(req.body)
        });

        const dados = await respostaMP.json();
        
        if (!respostaMP.ok) {
            return res.status(respostaMP.status).json({ message: dados.message || "Erro ao gerar pagamento" });
        }

        // Retorna os dados do Pix formatados para o frontend exibir o QR Code e o Copia e Cola
        return res.status(200).json({
            sucesso: true,
            qrcode: dados.point_of_interaction.transaction_data.qr_code_base64,
            copia_cola: dados.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error("Erro interno ao gerar Pix:", erro);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
});

// Rota de Webhook (Baixa Automática em Tempo Real)
app.post('/api/webhook-pix', async (req, res) => {
    try {
        const evento = req.body;
        const token = process.env.MP_TOKEN || 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471';

        if (evento.type === 'payment' || (evento.action && evento.action.includes('payment'))) {
            const paymentId = evento.data?.id;

            if (paymentId) {
                const respPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: { 'Authorization': `Bearer ${token.trim()}` }
                });
                const pagamento = await respPagamento.json();

                if (pagamento.status === 'approved') {
                    const propostaId = pagamento.external_reference;

                    if (propostaId) {
                        // DA A BAIXA AUTOMÁTICA NO SUPABASE
                        await supabase.from('propostas')
                            .update({ 
                                entrada_paga: true, 
                                status: 'Em Andamento' 
                            })
                            .eq('id', propostaId);
                        
                        console.log(`✅ Proposta ${propostaId} paga e atualizada automaticamente!`);
                    }
                }
            }
        }

        return res.status(200).send('OK');
    } catch (erro) {
        console.error('Erro no Webhook:', erro);
        return res.status(500).send('Erro interno');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
