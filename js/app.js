/* ==========================================================================
   js/app.js
   Ponto de entrada da aplicação - VERSÃO FINAL COM PWA, FILTROS, FIREBASE & STORIES
   Inclui: Filtros, Mapa, Detalhes, Timeline, Notificações, Sincronização e Gerador de Stories.
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
    // 1. Impede o Chrome <= 67 de mostrar o prompt automaticamente
    e.preventDefault();
    // 2. Guarda o evento para ser disparado depois
    deferredPrompt = e;
    // 3. Atualiza a UI para mostrar o botão de instalação
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
        // 0. Inicializa detector de offline
        setupOfflineIndicator();

        // 1. Carrega e corrige os dados
        appState.todosBlocos = await carregarDados();
        appState.blocosFiltrados = [...appState.todosBlocos];
        
        // --- PONTE PARA O MAPA ---
        // Cria a função global que o popup do Leaflet vai chamar ao clicar em "+ Detalhes"
        window.abrirDetalhesDoMapa = (id) => {
            const bloco = appState.todosBlocos.find(b => b.id === id);
            if (bloco) {
                mostrarDetalhes(bloco);
            } else {
                console.error("Bloco não encontrado:", id);
            }
        };

        // 2. Inicializa a UI de Filtros Avançados
        inicializarFiltrosUI();

        // 3. Inicializa o Mapa
        initMap(appState.todosBlocos); 

        // 4. Renderiza a lista inicial
        aplicarFiltros();

        // 5. Reagendar notificações dos favoritos existentes
        const favoritosSalvos = getFavoritos();
        favoritosSalvos.forEach(id => {
            const bloco = appState.todosBlocos.find(b => b.id === id);
            if (bloco) {
                NotificationManager.agendar(bloco);
            }
        });

        // 6. Verifica se há um roteiro compartilhado na URL
        verificarRoteiroCompartilhado();

        // 7. Verifica se o app foi aberto via App Shortcuts (Botão SOS, Banheiros, etc)
        verificarAcoesDeAtalho();

        // 8. Monitora Auth para atualizar UI do botão de login
        monitorarAuth((logado, user) => {
            const btn = document.getElementById('btn-login');
            const msg = document.getElementById('msg-login');
            
            if (btn && logado) {
                btn.classList.add('logado');
                btn.style.backgroundColor = '#e8f0fe';
                btn.style.borderColor = '#00C853'; // Verde
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
    
    // 1. Busca por Texto
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
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
            } else {
                appState.filtros.apenasFavoritos = false;
                const viewId = link.dataset.target; 
                mudarVisualizacao(viewId);
                
                // Hack para corrigir renderização do Leaflet
                if (targetId === 'mapa') {
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                }
            }
            aplicarFiltros();
        });
    });

    // Lógica dos Cards de Utilidade (Metrô e Saúde)
    const cardMetro = document.getElementById('card-metro');
    if (cardMetro) {
        cardMetro.addEventListener('click', () => {
            navegarParaMapaEFiltrar('metro');
        });
    }

    const cardSocorro = document.getElementById('card-socorro');
    if (cardSocorro) {
        cardSocorro.addEventListener('click', () => {
            navegarParaMapaEFiltrar('socorro');
        });
    }

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
                if (ehFavorito) {
                    NotificationManager.agendar(blocoAlvo);
                } else {
                    NotificationManager.cancelar(blocoId);
                }
            }
            
            if (appState.filtros.apenasFavoritos) {
                aplicarFiltros();
            }
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
                navigator.clipboard.writeText(urlFinal).then(() => {
                    alert('🔗 Link copiado! Mande no Zap.');
                }).catch(() => {
                    prompt("Copie o link abaixo:", urlFinal);
                });
            }
        });
    }

    // 7. Botão Check-in (Eu Fui)
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
            console.log(`Usuário escolheu: ${outcome}`);
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
                if(confirm("Deseja desconectar sua conta? Os dados no celular serão mantidos.")) {
                    logout();
                }
            } else {
                loginGoogle();
            }
        });
    }

    // 10. Botão "Manda pro Insta" (Stories) - VERSÃO DARK MODE & HD
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
            
            // Feedback de carregamento
            btnStories.disabled = true;
            btnIcon.className = 'fas fa-spinner fa-spin';
            
            try {
                // 1. Pega os dados dos blocos favoritos
                const blocosFavoritos = appState.todosBlocos
                    .filter(b => favoritosIds.includes(b.id))
                    .sort((a, b) => {
                        // Ordena por Data e Hora
                        const dateA = new Date(`${a.date}T${a.time}`);
                        const dateB = new Date(`${b.date}T${b.time}`);
                        return dateA - dateB;
                    });

                // 2. Renderiza o HTML oculto (O ui.js vai aplicar as classes base)
                renderPoster(blocosFavoritos);

                // Pequeno delay para garantir renderização do DOM/Fontes
                await new Promise(r => setTimeout(r, 500));

                const posterElement = document.getElementById('poster-stories');

                // 3. Gera o Canvas via html2canvas (CONFIGURAÇÃO DARK MODE)
                const canvas = await html2canvas(posterElement, {
                    scale: 3, // Alta Resolução (HD)
                    useCORS: true,
                    backgroundColor: '#000000', // FUNDO PRETO
                    logging: false,
                    onclone: (docClonado) => {
                        // FORÇA BRUTA DE ESTILO: Garante que nada fique ilegível
                        const el = docClonado.getElementById('poster-stories');
                        if (el) {
                            // Força container principal
                            el.style.backgroundColor = '#000000';
                            el.style.color = '#FFFFFF';
                            
                            // Força cor BRANCA nos Títulos (h3)
                            const titulos = el.querySelectorAll('h3');
                            titulos.forEach(t => {
                                t.style.color = '#FFFFFF';
                                t.style.webkitTextFillColor = '#FFFFFF'; // Importante p/ iOS
                            });

                            // Força cor CINZA CLARO nos textos auxiliares
                            const infos = el.querySelectorAll('p, span, div');
                            infos.forEach(i => {
                                // Não mexe no bloco de hora (que tem fundo colorido) nem no título principal
                                if (!i.classList.contains('poster-time') && !i.classList.contains('poster-title')) {
                                    i.style.color = '#EEEEEE';
                                }
                            });
                        }
                    }
                });

                // 4. Converte para Blob e Compartilha
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], 'meu-roteiro-nu.png', { type: 'image/png' });

                    // Tenta usar API de Compartilhamento Nativa (Mobile)
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'Meu Roteiro Nu! Carnaval',
                                text: 'Se liga no meu roteiro de Carnaval em BH! 🎉'
                            });
                        } catch (err) {
                            if (err.name !== 'AbortError') console.error(err);
                        }
                    } else {
                        // Fallback: Download direto (Desktop)
                        const link = document.createElement('a');
                        link.download = 'meu-roteiro-nu.png';
                        link.href = canvas.toDataURL();
                        link.click();
                        alert('Imagem salva! Agora é só postar nos Stories.');
                    }

                    // Restaura botão
                    btnStories.disabled = false;
                    btnIcon.className = originalIconClass;
                }, 'image/png');

            } catch (err) {
                console.error('Erro ao gerar stories:', err);
                alert('Opa, deu ruim ao gerar a imagem. Tente de novo.');
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
    // 1. Renderizar Dias (Dinâmico)
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
            } catch (e) {
                console.warn('Data inválida encontrada:', dataStr);
            }
        });
    }

    // 2. Renderizar Estilos (Dinâmico)
    const estilosUnicos = new Set();
    appState.todosBlocos.forEach(b => {
        if (b.musical_style) {
            b.musical_style.forEach(s => {
                if(s) estilosUnicos.add(s.trim());
            });
        }
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

    // 3. Listeners Globais para os Chips de Filtro
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

    // 4. Botão Toggle do Painel
    const btnToggle = document.getElementById('filter-toggle');
    const panel = document.getElementById('filters-panel');
    if (btnToggle && panel) {
        btnToggle.addEventListener('click', () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            btnToggle.style.color = isHidden ? 'var(--color-primary)' : 'var(--color-asphalt)';
        });
    }

    // 5. Botão Limpar Filtros
    const btnClean = document.getElementById('btn-clean-filters');
    if (btnClean) {
        btnClean.addEventListener('click', () => {
            appState.filtros.dia = null;
            appState.filtros.turno = null;
            appState.filtros.estilo = null;
            
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
        if (filtros.termoBusca) {
            const termo = filtros.termoBusca;
            const nomeMatch = bloco.normalized_name.includes(termo);
            const bairroMatch = bloco.neighborhood ? bloco.neighborhood.toLowerCase().includes(termo) : false;
            
            if (!nomeMatch && !bairroMatch) return false;
        }

        if (filtros.apenasFavoritos) {
            if (!favoritosIds.includes(bloco.id)) return false;
        }

        if (filtros.dia) {
            if (bloco.date !== filtros.dia) return false;
        }

        if (filtros.estilo) {
            if (!bloco.musical_style) return false;
            const estilosBloco = bloco.musical_style.map(s => s.toLowerCase());
            if (!estilosBloco.includes(filtros.estilo)) return false;
        }

        if (filtros.turno && bloco.time) {
            const hora = parseInt(bloco.time.split(':')[0], 10);
            if (filtros.turno === 'manha') {
                if (hora >= 12) return false;
            } else if (filtros.turno === 'tarde') {
                if (hora < 12 || hora >= 18) return false;
            } else if (filtros.turno === 'noite') {
                if (hora < 18) return false;
            }
        }

        return true;
    });

    const viewAtiva = document.querySelector('.active-view');
    if (viewAtiva && viewAtiva.id === 'view-mapa') {
        atualizarMarcadores(appState.blocosFiltrados);
    } 
    
    if (appState.filtros.apenasFavoritos) {
        renderTimeline(appState.blocosFiltrados, 'lista-favoritos');
    } else {
        renderBlocos(appState.blocosFiltrados, 'lista-blocos');
    }
}

function verificarRoteiroCompartilhado() {
    const params = new URLSearchParams(window.location.search);
    const roteiroCodificado = params.get('roteiro');

    if (roteiroCodificado) {
        const idsImportados = roteiroCodificado.split(',');
        const idsValidos = idsImportados.filter(id => 
            appState.todosBlocos.some(bloco => bloco.id === id)
        );

        if (idsValidos.length > 0) {
            setTimeout(() => {
                const aceitou = confirm(
                    `🎭 Roteiro Compartilhado Encontrado!\n\n` +
                    `Alguém te mandou uma lista com ${idsValidos.length} blocos.\n` +
                    `Deseja adicionar estes blocos aos seus favoritos?`
                );
                
                if (aceitou) {
                    const novosCount = importarFavoritos(idsValidos);
                    idsValidos.forEach(id => {
                        const bloco = appState.todosBlocos.find(b => b.id === id);
                        if(bloco) NotificationManager.agendar(bloco);
                    });

                    alert(`✅ Sucesso! ${novosCount} novos blocos foram adicionados ao seu roteiro.`);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    const btnMeusTrens = document.querySelector('a[href="#roteiro"]');
                    if(btnMeusTrens) btnMeusTrens.click();
                }
            }, 500);
        }
    }
}

// --- FUNÇÃO PARA PROCESSAR ATALHOS (APP SHORTCUTS) [NOVO] ---
function verificarAcoesDeAtalho() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (!action) return;

    console.log(`🚀 App iniciado via atalho: ${action}`);

    // Limpa a URL para evitar re-execução ao recarregar
    const novaUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, novaUrl);

    // Pequeno delay para garantir que a UI e o Mapa carregaram
    setTimeout(() => {
        // Reseta estados de navegação
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));

        switch (action) {
            case 'banheiros':
                // Abre o mapa e foca nos banheiros
                navegarParaMapaEFiltrar('wc');
                break;

            case 'sos':
                // Vai para a tela de guia/ajuda
                mudarVisualizacao('view-guia');
                document.querySelector('a[href="#guia"]').classList.add('active');
                break;

            case 'agora':
                // Vai para a lista principal
                mudarVisualizacao('view-explorar');
                document.querySelector('a[href="#explorar"]').classList.add('active');
                break;
        }
    }, 600); // 600ms para garantir renderização do DOM
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