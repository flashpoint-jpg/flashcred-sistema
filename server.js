const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ CONFIGURAÇÕES GERAIS
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// ✅ PÁGINA INICIAL AUTOMÁTICA
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ✅ SUPABASE
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g5Tcimge2aiMX8JE3ml1dg_6zbR3uXi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO — VERSÃO NOVA CORRIGIDA
const mpConfig = new MercadoPagoConfig({
    accessToken: 'APP_USR-8158139097874832-072720-d200da044f05a1dd8eb75f90e0551431-18499471'
});
const pagamentoServico = new Payment(mpConfig);

// ✅ ROTA DE GERA PIX — LIMPEZA DE VALOR E TUDO
app.post('/api/gerar-pix', async (req, res) => {
    try {
        const valorLimpo = Number(
            String(req.body.valor)
            .replace(/[^0-9,.]/g, '')
            .replace(',', '.')
        );

        if(isNaN(valorLimpo) || valorLimpo <= 0) {
            return res.json({sucesso: false, mensagem: 'Valor inválido'});
        }

        // ✅ Identifica a que proposta/parcela esse Pix pertence.
        // Isso é o que o webhook vai usar depois para saber o que atualizar no Supabase.
        const propostaId = req.body.proposta_id || null;
        const tipo = req.body.tipo || 'entrada'; // 'entrada' ou 'parcela'
        const numeroParcela = req.body.numero_parcela || null;

        let externalReference = null;
        if(propostaId) {
            externalReference = tipo === 'parcela'
                ? `parcela:${propostaId}:${numeroParcela || ''}`
                : `entrada:${propostaId}`;
        }

        // ✅ URL pública deste servidor, montada a partir da própria requisição.
        // Assim funciona em qualquer domínio/deploy sem precisar hardcodar nada.
        const notificationUrl = `${req.protocol}://${req.get('host')}/api/webhook-mercadopago`;

        const pagamento = await pagamentoServico.create({
            body: {
                transaction_amount: valorLimpo,
                description: req.body.descricao || 'Pagamento FlashCred',
                payment_method_id: 'pix',
                payer: { email: 'flashcred@suporte.com.br' },
                notification_url: notificationUrl,
                ...(externalReference ? { external_reference: externalReference } : {})
            }
        });

        res.json({
            sucesso: true,
            qr_code: pagamento.point_of_interaction.transaction_data.qr_code
        });

    } catch (erro) {
        console.error('ERRO:', erro);
        res.json({sucesso: false, mensagem: erro.message});
    }
});

// ✅ WEBHOOK DO MERCADO PAGO — recebe a notificação de pagamento e dá baixa na proposta
// Aceita GET e POST porque o Mercado Pago pode chamar de formas diferentes dependendo da config.
app.all('/api/webhook-mercadopago', async (req, res) => {
    try {
        // O ID do pagamento pode vir no corpo (notificação nova) ou na query (formato antigo/IPN)
        const paymentId =
            req.body?.data?.id ||
            req.body?.id ||
            req.query['data.id'] ||
            req.query.id;

        const tipoNotificacao = req.body?.type || req.body?.topic || req.query.type || req.query.topic;

        // Só nos interessa notificação de pagamento
        if(!paymentId || (tipoNotificacao && tipoNotificacao !== 'payment')) {
            return res.sendStatus(200);
        }

        // ✅ Busca o pagamento completo direto na API do Mercado Pago (nunca confiar só no payload recebido)
        const pagamento = await pagamentoServico.get({ id: paymentId });

        if(pagamento.status !== 'approved') {
            // Pix pendente, rejeitado, cancelado etc — não faz nada ainda
            return res.sendStatus(200);
        }

        const referencia = pagamento.external_reference || '';
        const partes = referencia.split(':');
        const tipo = partes[0];
        const propostaId = partes[1];
        const numeroParcela = partes[2] ? Number(partes[2]) : null;

        if(!propostaId) {
            console.warn('⚠️ Pagamento aprovado sem external_reference reconhecível:', paymentId);
            return res.sendStatus(200);
        }

        if(tipo === 'entrada') {

            const { error } = await supabase
                .from('propostas')
                .update({
                    entrada_paga: true,
                    data_pagamento_entrada: new Date().toISOString()
                })
                .eq('id', propostaId);

            if(error) {
                console.error('❌ Erro ao atualizar entrada da proposta', propostaId, error);
            } else {
                console.log(`✅ Entrada da proposta ${propostaId} confirmada via Pix.`);
            }

        } else if(tipo === 'parcela' && numeroParcela) {

            // Busca o valor atual de parcelas_pagas para não sobrescrever com um número menor
            const { data: propostaAtual, error: erroBusca } = await supabase
                .from('propostas')
                .select('parcelas_pagas')
                .eq('id', propostaId)
                .maybeSingle();

            if(erroBusca) {
                console.error('❌ Erro ao buscar proposta', propostaId, erroBusca);
                return res.sendStatus(200);
            }

            const parcelasPagasAtual = Number(propostaAtual?.parcelas_pagas || 0);
            const novoValor = Math.max(parcelasPagasAtual, numeroParcela);

            const { error: erroUpdate } = await supabase
                .from('propostas')
                .update({ parcelas_pagas: novoValor })
                .eq('id', propostaId);

            if(erroUpdate) {
                console.error('❌ Erro ao atualizar parcela da proposta', propostaId, erroUpdate);
            } else {
                console.log(`✅ Parcela ${numeroParcela} da proposta ${propostaId} confirmada via Pix.`);
            }
        }

        res.sendStatus(200);

    } catch (erro) {
        // Sempre responde 200 para o Mercado Pago não ficar reenviando em loop —
        // o erro real fica registrado no log do servidor para investigação.
        console.error('ERRO NO WEBHOOK:', erro);
        res.sendStatus(200);
    }
});

app.listen(PORTA, () => {
    console.log('✅ FlashCred rodando perfeitamente!');
});
