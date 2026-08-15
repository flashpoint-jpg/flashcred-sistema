const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const app = express();
const PORTA = process.env.PORT || 3000;

// ✅ CONFIGURAÇÕES GERAIS
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// ✅ PÁGINA INICIAL AUTOMÁTICA
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ✅ SUPABASE — a URL do projeto não é sensível (já aparece em todo o site),
// mas a chave usada aqui é a chave de SERVIÇO (privilegiada) — só o servidor deve ter acesso a ela.
const SUPABASE_URL = 'https://rgcclordmqjmwuzrrfbd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICO_CHAVE;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ MERCADO PAGO — VERSÃO NOVA CORRIGIDA
const mpConfig = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_TOKEN
});
const pagamentoServico = new Payment(mpConfig);

// ✅ NOTIFICAÇÕES PUSH (funcionam mesmo com o app fechado)
// As chaves VAPID identificam o SEU servidor perante os navegadores/celulares.
// Ficam nas variáveis de ambiente — nunca hardcoded no código.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:flashcred@suporte.com.br',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
} else {
    console.warn('⚠️ VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — notificações push desativadas.');
}

// Envia uma notificação push para todas as inscrições de um papel/referência.
// Remove automaticamente inscrições que não existem mais (usuário desinstalou o app etc).
async function enviarPushPara(papel, referencia, titulo, corpo, dadosExtras) {
    if(!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    const { data: inscricoes, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('papel', papel)
        .eq('referencia', String(referencia));

    if(error || !inscricoes || !inscricoes.length) return;

    const payload = JSON.stringify({
        title: titulo,
        body: corpo,
        data: dadosExtras || {}
    });

    for(const inscricao of inscricoes) {
        try {
            await webpush.sendNotification(
                {
                    endpoint: inscricao.endpoint,
                    keys: { p256dh: inscricao.p256dh, auth: inscricao.auth }
                },
                payload
            );
        } catch(erroEnvio) {
            // 404/410 = inscrição expirada/inválida — remove do banco.
            if(erroEnvio.statusCode === 404 || erroEnvio.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', inscricao.id);
            } else {
                console.warn('⚠️ Erro ao enviar push:', erroEnvio.message);
            }
        }
    }
}

// ✅ REGISTRAR/REMOVER INSCRIÇÃO DE NOTIFICAÇÃO PUSH
app.post('/api/push/registrar', async (req, res) => {
    try {
        const { papel, referencia, subscription } = req.body;

        if(!papel || !referencia || !subscription?.endpoint) {
            return res.json({ sucesso: false, mensagem: 'Dados incompletos.' });
        }

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                papel,
                referencia: String(referencia),
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            }, { onConflict: 'endpoint' });

        if(error) throw error;

        res.json({ sucesso: true });

    } catch(erro) {
        console.error('ERRO AO REGISTRAR PUSH:', erro);
        res.json({ sucesso: false, mensagem: erro.message });
    }
});

app.post('/api/push/remover', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if(endpoint) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
        res.json({ sucesso: true });
    } catch(erro) {
        res.json({ sucesso: false, mensagem: erro.message });
    }
});

// Expõe a chave pública pro front-end (não é segredo, é feita pra ser pública).
app.get('/api/push/chave-publica', (req, res) => {
    res.json({ chave: VAPID_PUBLIC_KEY || null });
});

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

                enviarPushPara('cliente', propostaId, '✅ Entrada confirmada!', 'Seu pagamento foi recebido. Acompanhe o andamento pelo app.', { url: '/consultar.html' });
                enviarPushPara('admin', 'admin', '💰 Entrada Pix confirmada', `Proposta #${propostaId} — entrada recebida.`, { url: '/painel.html' });

                // Gera a comissão do funcionário (se ainda não existir) agora que a entrada foi confirmada.
                try {
                    const { data: proposta } = await supabase
                        .from('propostas')
                        .select('funcionario_id, valor_desejado')
                        .eq('id', propostaId)
                        .maybeSingle();

                    if(proposta?.funcionario_id) {

                        const { data: existente } = await supabase
                            .from('comissoes')
                            .select('id')
                            .eq('proposta_id', propostaId)
                            .maybeSingle();

                        if(!existente) {

                            const { data: func } = await supabase
                                .from('funcionarios')
                                .select('percentual_comissao')
                                .eq('id', proposta.funcionario_id)
                                .maybeSingle();

                            const percentual = Number(func?.percentual_comissao) || 0;

                            if(percentual > 0) {

                                const valorComissao = (Number(proposta.valor_desejado) || 0) * percentual / 100;

                                await supabase.from('comissoes').insert([{
                                    proposta_id: propostaId,
                                    funcionario_id: proposta.funcionario_id,
                                    porcentagem: percentual,
                                    valor_comissao: valorComissao,
                                    status: 'disponivel'
                                }]);

                                console.log(`✅ Comissão gerada para o funcionário da proposta ${propostaId}.`);
                            }
                        }
                    }
                } catch(erroComissao) {
                    console.warn('⚠️ Não foi possível gerar a comissão do funcionário:', erroComissao);
                }
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
                enviarPushPara('cliente', propostaId, '✅ Parcela paga!', `Sua ${numeroParcela}ª parcela foi confirmada. Seu limite já foi atualizado.`, { url: '/consultar.html' });
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

// ✅ VERIFICAÇÃO DE SENHA DO PAINEL ADMIN
// A senha fica só aqui no servidor (variável de ambiente), nunca no código do navegador.
app.post('/api/verificar-senha-admin', (req, res) => {
    const senhaEnviada = String(req.body.senha || '');
    const senhaCorreta = process.env.ADMIN_PASSWORD || '';

    if(!senhaCorreta) {
        console.error('⚠️ ADMIN_PASSWORD não está configurada no servidor.');
        return res.json({ ok: false, mensagem: 'Senha de admin não configurada no servidor.' });
    }

    res.json({ ok: senhaEnviada === senhaCorreta });
});

// ✅ CHECAGEM DIÁRIA DE VENCIMENTO DE PARCELAS
// Avisa por push (mesmo com o app fechado) quem tem parcela vencendo em até
// 3 dias ou já vencida. Roda de duas formas:
//   1) Sozinha, a cada 6h, enquanto o servidor estiver de pé.
//   2) Sob demanda, chamando esta rota via um cron externo (recomendado —
//      veja a explicação depois do código). Isso garante que rode mesmo se
//      o servidor "dormir" no plano gratuito do Render.
async function checarVencimentosEAvisar() {
    try {
        const { data: propostas, error } = await supabase
            .from('propostas')
            .select('id, cpf, entrada_paga, parcelas_pagas, quantidade_parcelas, qtd_parcelas_escolhida, datas_parcelas')
            .eq('entrada_paga', true);

        if(error) {
            console.error('❌ Erro ao buscar propostas para checagem de vencimento:', error);
            return;
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        for(const proposta of (propostas || [])) {

            const quantidade = Number(proposta.qtd_parcelas_escolhida || proposta.quantidade_parcelas) || 0;
            const pagas = Number(proposta.parcelas_pagas) || 0;
            const datas = Array.isArray(proposta.datas_parcelas) ? proposta.datas_parcelas : [];

            if(pagas >= quantidade || !datas[pagas]) continue;

            const vencimento = new Date(datas[pagas] + 'T00:00:00');
            const diasRestantes = Math.round((vencimento - hoje) / 86400000);

            if(diasRestantes > 3) continue;

            const numeroParcela = pagas + 1;

            // Evita avisar duas vezes no mesmo dia pela mesma parcela.
            const { error: erroLog } = await supabase
                .from('push_avisos_vencimento')
                .insert({ proposta_id: proposta.id, numero_parcela: numeroParcela });

            if(erroLog) continue; // já foi avisado hoje (violação da constraint única) — pula

            let titulo, corpo;
            if(diasRestantes < 0) {
                titulo = '⚠️ Parcela em atraso';
                corpo = `Sua ${numeroParcela}ª parcela venceu — regularize para manter seu limite liberado.`;
            } else if(diasRestantes === 0) {
                titulo = '📅 Parcela vence hoje!';
                corpo = `Sua ${numeroParcela}ª parcela vence hoje. Não esqueça de pagar.`;
            } else {
                titulo = '📅 Parcela vencendo em breve';
                corpo = `Sua ${numeroParcela}ª parcela vence em ${diasRestantes} dia(s).`;
            }

            await enviarPushPara('cliente', proposta.cpf, titulo, corpo, { url: '/consultar.html' });
        }

    } catch(erro) {
        console.error('❌ Erro na checagem de vencimentos:', erro);
    }
}

// Rota que um cron externo pode chamar (ex: cron-job.org, grátis) uma vez por dia.
app.post('/api/push/checar-vencimentos', async (req, res) => {
    await checarVencimentosEAvisar();
    res.json({ sucesso: true });
});

// Roda sozinho a cada 6h enquanto o servidor estiver ativo (rede de segurança —
// não substitui o cron externo no plano gratuito, que "dorme" o servidor).
setInterval(checarVencimentosEAvisar, 6 * 60 * 60 * 1000);

app.listen(PORTA, () => {
    console.log('✅ FlashCred rodando perfeitamente!');
});
