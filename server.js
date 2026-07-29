<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FlashCred ERP v2.0 - Painel de Controle</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#d40000',
                        secondary: '#1e293b',
                        sucesso: '#10b981',
                        alerta: '#f59e0b',
                        perigo: '#ef4444',
                        neutro: '#64748b'
                    },
                    fontFamily: {
                        sans: ['Arial', 'sans-serif']
                    }
                }
            }
        }
    </script>

    <style type="text/tailwindcss">
        @layer utilities {
            .sidebar-link {
                @apply flex items-center gap-3 p-3 rounded-lg text-gray-300 hover:bg-primary/10 hover:text-white transition-all;
            }
            .sidebar-link.ativo {
                @apply bg-primary text-white font-medium;
            }
            .card {
                @apply bg-white rounded-xl shadow-sm p-5 border border-gray-100;
            }
            .card-indicador {
                @apply rounded-xl p-5 text-white;
            }
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-800 min-h-screen">
    <div class="flex flex-col md:flex-row">
        <!-- MENU LATERAL -->
        <aside id="sidebar" class="w-full md:w-64 bg-secondary min-h-screen p-4 transition-all">
            <div class="mb-8 text-center">
                <h1 class="text-xl font-bold text-white">🛋️ FLASHCRED ERP</h1>
                <p class="text-xs text-gray-400">Flashpoint Distribuidora</p>
                <p class="text-[10px] text-gray-500">CNPJ: 35.560.220/0001-54</p>
            </div>

            <nav class="space-y-1">
                <a href="#" class="sidebar-link ativo">
                    <i class="fa fa-home w-5"></i>
                    <span>Dashboard</span>
                </a>
                <a href="clientes.html" class="sidebar-link">
                    <i class="fa fa-users w-5"></i>
                    <span>Clientes</span>
                </a>
                <a href="propostas.html" class="sidebar-link">
                    <i class="fa fa-file-text w-5"></i>
                    <span>Propostas</span>
                </a>
                <a href="financeiro.html" class="sidebar-link">
                    <i class="fa fa-money w-5"></i>
                    <span>Financeiro</span>
                </a>
                <a href="relatorios.html" class="sidebar-link">
                    <i class="fa fa-bar-chart w-5"></i>
                    <span>Relatórios</span>
                </a>
                <hr class="border-gray-700 my-4">
                <a href="#" class="sidebar-link text-perigo hover:bg-perigo/10 hover:text-perigo">
                    <i class="fa fa-sign-out w-5"></i>
                    <span>Sair</span>
                </a>
            </nav>
        </aside>

        <!-- CONTEÚDO PRINCIPAL -->
        <main class="flex-1 p-4 md:p-6">
            <header class="mb-6 flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-bold">Visão Geral</h2>
                    <p class="text-sm text-gray-500">Resumo do seu crediário</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm hidden md:block">Olá, Felipe</span>
                    <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">F</div>
                </div>
            </header>

            <!-- CARDS DE INDICADORES -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="card-indicador bg-primary">
                    <h3 class="text-sm opacity-90">Total Propostas</h3>
                    <p class="text-2xl font-bold" id="qtdPropostas">0</p>
                </div>
                <div class="card-indicador bg-sucesso">
                    <h3 class="text-sm opacity-90">Aprovadas</h3>
                    <p class="text-2xl font-bold" id="qtdAprovadas">0</p>
                </div>
                <div class="card-indicador bg-alerta">
                    <h3 class="text-sm opacity-90">A Receber</h3>
                    <p class="text-2xl font-bold" id="valorReceber">R$ 0,00</p>
                </div>
                <div class="card-indicador bg-perigo">
                    <h3 class="text-sm opacity-90">Inadimplência</h3>
                    <p class="text-2xl font-bold" id="valorAtraso">R$ 0,00</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- GRÁFICO -->
                <div class="lg:col-span-2 card">
                    <h3 class="font-semibold mb-4">Vendas e Pagamentos</h3>
                    <canvas height="250" id="grafico"></canvas>
                </div>

                <!-- NOTIFICAÇÕES -->
                <div class="card">
                    <h3 class="font-semibold mb-4 flex items-center gap-2">
                        <i class="fa fa-bell text-primary"></i>
                        Avisos Recentes
                    </h3>
                    <div id="listaAvisos" class="space-y-3 text-sm">
                        <p class="text-gray-500">Carregando...</p>
                    </div>
                </div>
            </div>

            <!-- ÚLTIMAS PROPOSTAS -->
            <div class="card mt-6">
                <h3 class="font-semibold mb-4">Últimas Propostas</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 text-left">
                            <tr>
                                <th class="p-3">Cliente</th>
                                <th class="p-3">CPF</th>
                                <th class="p-3">Valor</th>
                                <th class="p-3">Status</th>
                                <th class="p-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="tabelaPropostas">
                            <tr>
                                <td colspan="5" class="p-4 text-center text-gray-500">Carregando dados...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script>
        let grafico;

        // CARREGAR DADOS DO SISTEMA
        async function carregarDados() {
            try {
                const res = await fetch('/api/propostas');
                const dados = await res.json();
                const propostas = dados.propostas || [];

                // ATUALIZAR INDICADORES
                document.getElementById('qtdPropostas').innerText = propostas.length;
                const aprovadas = propostas.filter(p => p.status === 'APROVADO');
                document.getElementById('qtdAprovadas').innerText = aprovadas.length;

                let totalReceber = 0, totalAtraso = 0;
                aprovadas.forEach(p => {
                    p.parcelas?.forEach(parc => {
                        if(parc.status === 'PENDENTE') totalReceber += parc.valor;
                    });
                });
                document.getElementById('valorReceber').innerText = `R$ ${totalReceber.toFixed(2).replace('.', ',')}`;
                document.getElementById('valorAtraso').innerText = `R$ ${totalAtraso.toFixed(2).replace('.', ',')}`;

                // TABELA DE ÚLTIMAS PROPOSTAS
                const tabela = document.getElementById('tabelaPropostas');
                tabela.innerHTML = '';
                propostas.slice(-5).reverse().forEach(p => {
                    const statusCor = {
                        'EM_ANALISE': 'text-alerta bg-alerta/10',
                        'APROVADO': 'text-sucesso bg-sucesso/10',
                        'REPROVADO': 'text-perigo bg-perigo/10'
                    };
                    const statusTexto = {
                        'EM_ANALISE': 'Em Análise',
                        'APROVADO': 'Aprovado',
                        'REPROVADO': 'Reprovado'
                    };

                    tabela.innerHTML += `
                    <tr class="border-t border-gray-100">
                        <td class="p-3">${p.nome}</td>
                        <td class="p-3">${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</td>
                        <td class="p-3">R$ ${p.valorTotal?.toFixed(2).replace('.', ',') || '0,00'}</td>
                        <td class="p-3"><span class="px-2 py-1 rounded text-xs font-medium ${statusCor[p.status]}">${statusTexto[p.status]}</span></td>
                        <td class="p-3"><button class="text-primary hover:underline">Ver</button></td>
                    </tr>
                    `;
                });

                // GRÁFICO SIMPLES
                if(grafico) grafico.destroy();
                const ctx = document.getElementById('grafico').getContext('2d');
                grafico = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Propostas', 'Aprovadas', 'Pendentes'],
                        datasets: [{
                            label: 'Quantidade',
                            data: [propostas.length, aprovadas.length, propostas.length - aprovadas.length],
                            backgroundColor: ['#d40000', '#10b981', '#f59e0b']
                        }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false } } }
                });

                // AVISOS
                const avisos = document.getElementById('listaAvisos');
                avisos.innerHTML = `
                    <div class="p-2 bg-gray-50 rounded">✅ Sistema atualizado</div>
                    <div class="p-2 bg-gray-50 rounded">📋 ${aprovadas.length} propostas aprovadas</div>
                `;

            } catch (erro) {
                document.getElementById('listaAvisos').innerHTML = `<p class="text-perigo">Erro ao carregar dados: ${erro.message}</p>`;
            }
        }

        // INICIAR
        carregarDados();
        setInterval(carregarDados, 30000); // Atualiza a cada 30 segundos
    </script>
</body>
</html>
