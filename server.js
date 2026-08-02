// FUNÇÃO DE ENVIAR FORMULÁRIO CORRIGIDA
async function enviarFormulario() {
    const btnEnviar = document.getElementById('btnEnviar');
    const textoBtn = btnEnviar.innerHTML;
    
    // Pegar valores
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const valor_desejado = parseFloat(document.getElementById('valor_desejado').value) || 0;

    // Validação simples
    if(!nome || !cpf || !telefone || valor_desejado <= 0) {
        alert('Preencha todos os campos corretamente!');
        return;
    }

    // Mostra carregando
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
        const resposta = await fetch('/api/propostas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome,
                cpf,
                telefone,
                valor_desejado
            })
        });

        const resultado = await resposta.json();

        if(resultado.success) {
            alert('✅ Solicitação enviada com sucesso!');
            // Limpar formulário
            document.getElementById('formProposta').reset();
            // Recarregar lista no painel
            if(typeof carregarPropostas === 'function') carregarPropostas();
        } else {
            alert('❌ Erro: ' + (resultado.error || 'Não foi possível enviar'));
        }

    } catch (erro) {
        console.error(erro);
        alert('❌ Falha de conexão com o servidor');
    } finally {
        // Volta botão ao normal
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = textoBtn;
    }
}
