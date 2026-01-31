/* ==========================================================================
   js/app.js
   Ponto de entrada da aplicação - VERSÃO BAIRROS (POLÍGONOS)
   Inclui: Filtros (Dia, Público, Turno, Estilo), Mapa Interativo, Detalhes.
   ========================================================================== */

import { carregarDados } from './data.js';
import { renderBlocos, mudarVisualizacao, atualizarBotaoFavorito, renderTimeline, renderStats, mostrarDetalhes, renderPoster } from './ui.js';
import { initMap, atualizarMarcadores, focarCategoriaNoMapa } from './map.js';
import { getFavoritos, toggleFavorito, importarFavoritos, toggleCheckin, getCheckinCount } from './storage.js';
import { NotificationManager } from './notifications.js';
import { loginGoogle, logout, monitorarAuth } from './firebase.js';

// --- Lógica PWA (Instalação) ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    mostrarBotaoInstalar();
});

window.addEventListener('appinstalled', () => {
    console.log('Nu! Carnaval foi instalado.');
    esconderBotaoInstalar();
    deferredPrompt = null;
});

function mostrarBotaoInstalar() {
    const container = document.getElementById('install-container');
    if (container) container.classList.remove('view-hidden');
}

function esconderBotaoInstalar() {
    const container = document.getElementById('install-container');
    if (container) container.classList.add('view-hidden');
}

// --- Estado Global da Aplicação ---
const appState = {
    todosBlocos: [],      
    blocosFiltrados: [],  
    filtros: {
        termoBusca: "",
        estilo: null,
        dia: null,    // Formato: 'YYYY-MM-DD'
        turno: null,  // Valores: 'manha', 'tarde', 'noite'
        publico: null, 
        apenasFavoritos: false
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Créditos no Console
    console.log(
        "%c Nu! Carnaval 2026 %c Por @engsoftmarcelo ",
        "background:#FF2A00; color:#fff; font-weight:bold; padding: 5px; border: 1px solid #000;",
        "background:#1A1A1A; color:#CCFF00; font-weight:bold; padding: 5px; border: 1px solid #000;"
    );

    console.log('App iniciado: Nu! Carnaval 2026');

    try {
        setupOfflineIndicator();

        // 1. Carrega e corrige os dados
        appState.todosBlocos = await carregarDados();
        appState.blocosFiltrados = [...appState.todosBlocos];
        
        // --- PONTE PARA O MAPA ---
        // Cria a função global para abrir detalhes (caso ainda usado em popups de utilidade)
        window.abrirDetalhesDoMapa = (id) => {
            const bloco = appState.todosBlocos.find(b => b.id === id);
            if (bloco) mostrarDetalhes(bloco);
        };

        // 2. Inicializa a UI de Filtros Avançados
        inicializarFiltrosUI();

        // 3. Inicializa o Mapa (Passando os dados para o cache do mapa)
        initMap(appState.todosBlocos); 

        // 4. Renderiza a lista inicial
        aplicarFiltros();

        // 5. Reagendar notificações dos favoritos existentes
        const favoritosSalvos = getFavoritos();
        favoritosSalvos.forEach(id => {
            const bloco = appState.todosBlocos.find(b => b.id === id);
            if (bloco) NotificationManager.agendar(bloco);
        });

        // 6. Verifica funcionalidades extras
        verificarRoteiroCompartilhado();
        verificarAcoesDeAtalho();

        // 7. Monitora Auth
        monitorarAuth((logado, user) => {
            const btn = document.getElementById('btn-login');
            const msg = document.getElementById('msg-login');
            
            if (btn && logado) {
                btn.classList.add('logado');
                btn.style.backgroundColor = '#e8f0fe';
                btn.style.borderColor = '#00C853';
                btn.innerHTML = `<i class="fas fa-user-check" style="color:#00C853"></i> <span>${user.displayName.split(' ')[0]}</span>`;
                if(msg) msg.textContent = "Sincronização ativada! ✅";
            } else if (btn) {
                btn.classList.remove('logado');
                btn.style.backgroundColor = '';
                btn.style.borderColor = '#1A1A1A';
                btn.innerHTML = `<i class="fab fa-google"></i> <span>Entrar com Google</span>`;
                if(msg) msg.textContent = "Salvar meus trens na nuvem ☁️";
            }
        });

    } catch (erro) {
        console.error("Erro fatal ao carregar o app:", erro);
        const container = document.getElementById('lista-blocos');
        if(container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Nu! Deu ruim ao carregar os dados.</p>
                </div>`;
        }
    }

    setupEventListeners();
});

// --- Configuração dos Eventos Gerais ---
function setupEventListeners() {
    
    // 0. NOVO: Escuta o evento de clique no bairro (Vindo do map.js)
    window.addEventListener('bairroSelecionado', (e) => {
        const { bairro, blocos } = e.detail;

        // Feedback se não houver blocos
        if (!blocos || blocos.length === 0) {
            alert(`Nenhum bloco encontrado no bairro ${bairro} na nossa base.`);
            return;
        }

        // 1. Muda para a visualização de lista ("Explorar")
        mudarVisualizacao('view-explorar');
        
        // 2. Atualiza visualmente a aba ativa
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        const navExplorar = document.querySelector('a[href="#explorar"]');
        if(navExplorar) navExplorar.classList.add('active');

        // 3. Sobrescreve a lista atual com os blocos do bairro
        // Nota: Não alteramos 'appState.filtros' para permitir que o usuário limpe fácil depois
        appState.blocosFiltrados = blocos;
        renderBlocos(blocos, 'lista-blocos');

        // 4. Feedback visual no campo de busca
        const searchInput = document.getElementById('search-input');
        if(searchInput) {
            searchInput.value = `📍 Bairro: ${bairro}`;
            // Limpa o campo quando o usuário clicar para buscar outra coisa
            searchInput.addEventListener('focus', function clearOnce() {
                this.value = '';
                this.removeEventListener('focus', clearOnce);
            }, { once: true });
        }
    });

    // 1. Busca por Texto
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // Se o usuário digitar, limpamos qualquer filtro visual de bairro anterior
            if(e.target.value.includes('📍 Bairro:')) {
                e.target.value = ''; 
            }
            appState.filtros.termoBusca = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            aplicarFiltros();
        });
    }

    // 2. Navegação Inferior (Abas)
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active'); 
            
            const targetId = link.getAttribute('href').substring(1); 

            if (targetId === 'roteiro') {
                appState.filtros.apenasFavoritos = true;
                mudarVisualizacao('view-favoritos');
                renderStats(getCheckinCount());
                aplicarFiltros();
            } else {
                appState.filtros.apenasFavoritos = false;
                const viewId = link.dataset.target; 
                mudarVisualizacao(viewId);
                
                // Se voltar para explorar, reseta a lista completa (remove filtro de bairro anterior)
                if (targetId === 'explorar') {
                    aplicarFiltros();
                }

                if (targetId === 'mapa') {
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }
            }
        });
    });

    // Cards de Utilidade (Metrô e Saúde)
    const cardMetro = document.getElementById('card-metro');
    if (cardMetro) cardMetro.addEventListener('click', () => navegarParaMapaEFiltrar('metro'));

    const cardSocorro = document.getElementById('card-socorro');
    if (cardSocorro) cardSocorro.addEventListener('click', () => navegarParaMapaEFiltrar('socorro'));

    // 3. Botão Favoritar
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.fav-btn');
        if (btn) {
            e.stopPropagation();
            const blocoId = btn.dataset.id;
            const ehFavorito = toggleFavorito(blocoId);
            atualizarBotaoFavorito(btn, ehFavorito);
            
            const blocoAlvo = appState.todosBlocos.find(b => b.id === blocoId);
            if (blocoAlvo) {
                ehFavorito ? NotificationManager.agendar(blocoAlvo) : NotificationManager.cancelar(blocoId);
            }
            
            if (appState.filtros.apenasFavoritos) aplicarFiltros();
        }
    });

    // 4. Navegação da Tela de Detalhes
    const btnVoltar = document.getElementById('btn-voltar');
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            mudarVisualizacao('view-explorar');
            document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
            document.querySelector('a[href="#explorar"]').classList.add('active');
            document.querySelector('.app-header').style.display = 'flex';
            document.querySelector('.bottom-nav').style.display = 'flex';
        });
    }

    // 5. Compartilhar (App Geral)
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Nu! Carnaval',
                    text: 'Bora caçar bloco em BH! Olha esse app:',
                    url: window.location.href
                }).catch(console.error);
            } else {
                alert('Link copiado! Mande pra galera.');
            }
        });
    }

    // 6. Compartilhar Roteiro (Link)
    const btnShareRoteiro = document.getElementById('btn-share-roteiro');
    if (btnShareRoteiro) {
        btnShareRoteiro.addEventListener('click', () => {
            const favoritos = getFavoritos();
            if (favoritos.length === 0) {
                alert('Seu roteiro está vazio! Favorite alguns blocos antes de compartilhar.');
                return;
            }
            const idsString = favoritos.join(',');
            const urlBase = window.location.origin + window.location.pathname;
            const urlFinal = `${urlBase}?roteiro=${idsString}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'Meu Roteiro - Nu! Carnaval 2026',
                    text: 'Se liga nos blocos que eu separei pra gente ir em BH!',
                    url: urlFinal
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(urlFinal).then(() => alert('🔗 Link copiado!')).catch(() => prompt("Copie:", urlFinal));
            }
        });
    }

    // 7. Botão Check-in
    document.addEventListener('click', (e) => {
        const btnCheckin = e.target.closest('#btn-checkin-action');
        if (btnCheckin) {
            const id = btnCheckin.dataset.id;
            const marcado = toggleCheckin(id);
            if (marcado) {
                btnCheckin.classList.add('checked');
                btnCheckin.querySelector('span').textContent = 'Fui e sobrevivi!';
                btnCheckin.querySelector('i').className = 'fas fa-check-circle';
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                btnCheckin.classList.remove('checked');
                btnCheckin.querySelector('span').textContent = 'Marcar presença ("Eu fui!")';
                btnCheckin.querySelector('i').className = 'far fa-circle';
            }
        }
    });

    // 8. Botão de Instalar PWA
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            esconderBotaoInstalar();
        });
    }

    // 9. Botão de Login Google
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            const isLogado = btnLogin.classList.contains('logado');
            if (isLogado) {
                if(confirm("Deseja desconectar sua conta?")) logout();
            } else {
                loginGoogle();
            }
        });
    }

    // 10. Botão "Manda pro Insta" (Stories)
    const btnStories = document.getElementById('btn-stories');
    if (btnStories) {
        btnStories.addEventListener('click', async () => {
            const favoritosIds = getFavoritos();
            if (favoritosIds.length === 0) {
                alert('Adicione blocos aos favoritos primeiro!');
                return;
            }

            const btnIcon = btnStories.querySelector('i');
            const originalIconClass = btnIcon.className;
            btnStories.disabled = true;
            btnIcon.className = 'fas fa-spinner fa-spin';
            
            try {
                const blocosFavoritos = appState.todosBlocos
                    .filter(b => favoritosIds.includes(b.id))
                    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

                renderPoster(blocosFavoritos);
                await new Promise(r => setTimeout(r, 500));

                const posterElement = document.getElementById('poster-stories');
                const canvas = await html2canvas(posterElement, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#000000',
                    onclone: (docClonado) => {
                        const el = docClonado.getElementById('poster-stories');
                        if (el) {
                            el.style.backgroundColor = '#000000';
                            el.style.color = '#FFFFFF';
                            el.querySelectorAll('h3').forEach(t => t.style.color = '#FFFFFF');
                            el.querySelectorAll('p, span, div').forEach(i => {
                                if (!i.classList.contains('poster-time') && !i.classList.contains('poster-title')) {
                                    i.style.color = '#EEEEEE';
                                }
                            });
                        }
                    }
                });

                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'meu-roteiro-nu.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({ files: [file], title: 'Meu Roteiro Nu!', text: 'Se liga no meu roteiro!' });
                        } catch (err) {}
                    } else {
                        const link = document.createElement('a');
                        link.download = 'meu-roteiro-nu.png';
                        link.href = canvas.toDataURL();
                        link.click();
                        alert('Imagem salva!');
                    }
                    btnStories.disabled = false;
                    btnIcon.className = originalIconClass;
                }, 'image/png');

            } catch (err) {
                console.error('Erro ao gerar stories:', err);
                alert('Erro ao gerar imagem. Tente novamente.');
                btnStories.disabled = false;
                btnIcon.className = originalIconClass;
            }
        });
    }
}

// --- FUNÇÃO AUXILIAR DE NAVEGAÇÃO PARA MAPA ---
function navegarParaMapaEFiltrar(categoria) {
    mudarVisualizacao('view-mapa');
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    document.querySelector('a[href="#mapa"]').classList.add('active');
    setTimeout(() => {
        window.dispatchEvent(new Event('resize')); 
        focarCategoriaNoMapa(categoria); 
    }, 200);
}

// --- FUNÇÕES DE SUPORTE AOS FILTROS ---
function inicializarFiltrosUI() {
    // 1. Renderizar Dias
    const diasUnicos = [...new Set(appState.todosBlocos.map(b => b.date))].filter(Boolean).sort();
    const containerDias = document.getElementById('filter-dias');
    if (containerDias) {
        containerDias.innerHTML = '';
        diasUnicos.forEach(dataStr => {
            try {
                const [ano, mes, dia] = dataStr.split('-');
                const dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                const label = `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} ${dia}/${mes}`;
                const btn = document.createElement('button');
                btn.className = 'chip filter-chip';
                btn.textContent = label;
                btn.dataset.type = 'dia';
                btn.dataset.value = dataStr;
                containerDias.appendChild(btn);
            } catch (e) {}
        });
    }

    // 2. Renderizar Públicos
    const publicosUnicos = new Set();
    appState.todosBlocos.forEach(b => { if (b.audience) publicosUnicos.add(b.audience.trim()); });
    const containerPublico = document.getElementById('filter-publico');
    if (containerPublico) {
        containerPublico.innerHTML = '';
        Array.from(publicosUnicos).sort().forEach(pub => {
            const btn = document.createElement('button');
            btn.className = 'chip filter-chip';
            btn.textContent = pub;
            btn.dataset.type = 'publico'; 
            btn.dataset.value = pub;
            containerPublico.appendChild(btn);
        });
    }

    // 3. Renderizar Estilos
    const estilosUnicos = new Set();
    appState.todosBlocos.forEach(b => {
        if (b.musical_style) b.musical_style.forEach(s => { if(s) estilosUnicos.add(s.trim()); });
    });
    const containerEstilos = document.getElementById('filter-estilos');
    if (containerEstilos) {
        containerEstilos.innerHTML = '';
        Array.from(estilosUnicos).sort().forEach(estilo => {
            const btn = document.createElement('button');
            btn.className = 'chip filter-chip';
            btn.textContent = estilo;
            btn.dataset.type = 'estilo';
            btn.dataset.value = estilo.toLowerCase();
            containerEstilos.appendChild(btn);
        });
    }

    // 4. Listeners Globais para os Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const tipo = e.target.dataset.type;
            const valor = e.target.dataset.value;
            const grupo = e.target.parentElement;
            const jaEstavaAtivo = e.target.classList.contains('active');

            grupo.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));

            if (!jaEstavaAtivo) {
                e.target.classList.add('active');
                appState.filtros[tipo] = valor;
            } else {
                appState.filtros[tipo] = null;
            }
            aplicarFiltros();
        });
    });

    // 5. Botão Toggle do Painel
    const btnToggle = document.getElementById('filter-toggle');
    const panel = document.getElementById('filters-panel');
    if (btnToggle && panel) {
        btnToggle.addEventListener('click', () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            btnToggle.style.color = isHidden ? 'var(--color-primary)' : 'var(--color-asphalt)';
        });
    }

    // 6. Botão Limpar Filtros
    const btnClean = document.getElementById('btn-clean-filters');
    if (btnClean) {
        btnClean.addEventListener('click', () => {
            appState.filtros.dia = null;
            appState.filtros.turno = null;
            appState.filtros.estilo = null;
            appState.filtros.publico = null;
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            aplicarFiltros();
        });
    }
}

// --- FUNÇÃO DE FILTRAGEM ---
function aplicarFiltros() {
    const filtros = appState.filtros;
    const favoritosIds = getFavoritos();

    appState.blocosFiltrados = appState.todosBlocos.filter(bloco => {
        // Busca
        if (filtros.termoBusca) {
            const termo = filtros.termoBusca;
            const nomeMatch = bloco.normalized_name.includes(termo);
            const bairroMatch = bloco.neighborhood ? bloco.neighborhood.toLowerCase().includes(termo) : false;
            if (!nomeMatch && !bairroMatch) return false;
        }
        // Favoritos
        if (filtros.apenasFavoritos && !favoritosIds.includes(bloco.id)) return false;
        // Dia
        if (filtros.dia && bloco.date !== filtros.dia) return false;
        // Público
        if (filtros.publico && bloco.audience !== filtros.publico) return false;
        // Estilo
        if (filtros.estilo) {
            if (!bloco.musical_style) return false;
            const estilosBloco = bloco.musical_style.map(s => s.toLowerCase());
            if (!estilosBloco.includes(filtros.estilo)) return false;
        }
        // Turno
        if (filtros.turno && bloco.time) {
            const hora = parseInt(bloco.time.split(':')[0], 10);
            if (filtros.turno === 'manha' && hora >= 12) return false;
            if (filtros.turno === 'tarde' && (hora < 12 || hora >= 18)) return false;
            if (filtros.turno === 'noite' && hora < 18) return false;
        }
        return true;
    });

    // --- ATUALIZAÇÃO VISUAL ---
    const viewAtiva = document.querySelector('.active-view');
    
    // 1. Se estiver no Mapa
    if (viewAtiva && viewAtiva.id === 'view-mapa') {
        // atualizarMarcadores() -> REMOVIDO: Map agora usa Bairros Fixos (Polígonos)
        // Se precisar filtrar bairros por cor no futuro, a lógica entraria aqui.
    } 
    
    // 2. Se estiver nos Favoritos
    if (appState.filtros.apenasFavoritos) {
        renderTimeline(appState.blocosFiltrados, 'lista-favoritos');
    } else {
        // 3. Padrão: Explorar
        renderBlocos(appState.blocosFiltrados, 'lista-blocos');
    }
}

function verificarRoteiroCompartilhado() {
    const params = new URLSearchParams(window.location.search);
    const roteiroCodificado = params.get('roteiro');

    if (roteiroCodificado) {
        const idsImportados = roteiroCodificado.split(',');
        const idsValidos = idsImportados.filter(id => appState.todosBlocos.some(bloco => bloco.id === id));

        if (idsValidos.length > 0) {
            setTimeout(() => {
                if (confirm(`🎭 Roteiro Compartilhado!\n\nAdicionar ${idsValidos.length} blocos aos favoritos?`)) {
                    importarFavoritos(idsValidos);
                    idsValidos.forEach(id => {
                        const bloco = appState.todosBlocos.find(b => b.id === id);
                        if(bloco) NotificationManager.agendar(bloco);
                    });
                    alert(`✅ Blocos adicionados!`);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    const btnMeusTrens = document.querySelector('a[href="#roteiro"]');
                    if(btnMeusTrens) btnMeusTrens.click();
                }
            }, 500);
        }
    }
}

function verificarAcoesDeAtalho() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;

    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    setTimeout(() => {
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        switch (action) {
            case 'banheiros': navegarParaMapaEFiltrar('wc'); break;
            case 'sos': 
                mudarVisualizacao('view-guia');
                document.querySelector('a[href="#guia"]').classList.add('active');
                break;
            case 'agora':
                mudarVisualizacao('view-explorar');
                document.querySelector('a[href="#explorar"]').classList.add('active');
                break;
        }
    }, 600);
}

function setupOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if(!indicator) return;
    const updateStatus = () => {
        if (navigator.onLine) {
            indicator.classList.add('view-hidden');
            indicator.style.visibility = 'hidden'; 
        } else {
            indicator.classList.remove('view-hidden');
            indicator.style.visibility = 'visible';
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}