/* ==========================================================================
   js/ui.js
   Camada de Interface - ATUALIZADO (Com Personalização por Público e Detalhes Turbinados)
   ========================================================================== */

import { isFavorito, isCheckedIn } from './storage.js';
import { getPrevisaoTempo } from './weather.js';
import { renderDetalheMap } from './map.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { enviarVibe, monitorarVibe } from './firebase.js';

// Variável para controlar o listener do Vibe Check (evita duplicação)
let unsubscribeVibe = null;

/**
 * Retorna a configuração de estilo (classe, ícone, cor) baseada no público.
 */
function getAudienceConfig(publico) {
    // Normaliza a string para evitar erros de digitação/espaços
    const chave = publico ? publico.trim() : 'Todos';

    const mapa = {
        'Adulto':            { css: 'aud-adulto',       icon: 'fas fa-wine-glass-alt' },
        'Cultural':          { css: 'aud-cultural',     icon: 'fas fa-theater-masks' },
        'Família':           { css: 'aud-familia',      icon: 'fas fa-users' },
        'Infantil':          { css: 'aud-infantil',     icon: 'fas fa-child' },
        'Jovem':             { css: 'aud-jovem',        icon: 'fas fa-bolt' },
        'LGBTQIA+':          { css: 'aud-lgbt',         icon: 'fas fa-rainbow' },
        'Mulheres':          { css: 'aud-mulheres',     icon: 'fas fa-venus' },
        'Social':            { css: 'aud-social',       icon: 'fas fa-hands-helping' },
        'Terceira Idade':    { css: 'aud-terceira',     icon: 'fas fa-blind' },
        'Todos os Públicos': { css: 'aud-todos',        icon: 'fas fa-globe-americas' },
        'Torcedores':        { css: 'aud-torcedores',   icon: 'fas fa-futbol' },
        'Universitário':     { css: 'aud-universitario', icon: 'fas fa-graduation-cap' }
    };

    // Retorna a config específica ou o padrão 'Todos' se não encontrar
    return mapa[chave] || mapa['Todos os Públicos'];
}

/**
 * Renderiza a lista de blocos padrão (Grid de Cards).
 */
export function renderBlocos(listaBlocos, containerId = 'lista-blocos') {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!listaBlocos || listaBlocos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-sad-tear" style="font-size: 3rem; margin-bottom: 16px; color: #ccc;"></i>
                <p>Nu! O trem sumiu.</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Não achamos nenhum bloco com esse nome.</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    listaBlocos.forEach(bloco => {
        const article = document.createElement('article');
        
        // 1. Pega a configuração do público
        const audienceConfig = getAudienceConfig(bloco.audience);
        
        // 2. Adiciona a classe de cor ao card principal
        article.className = `bloco-card ${audienceConfig.css}`;
        
        article.onclick = (e) => {
            if (e.target.closest('.fav-btn')) return;
            mostrarDetalhes(bloco);
        };

        const favoritoClass = isFavorito(bloco.id) ? 'favorited' : '';
        const iconHeart = isFavorito(bloco.id) ? 'fas fa-heart' : 'far fa-heart';
        const statusHTML = getStatusHTML(bloco);
        
        const estilos = Array.isArray(bloco.musical_style) ? bloco.musical_style : [];
        const estilosTags = estilos.map(style => `<span class="tag">${style}</span>`).join(' ');
        const bairro = bloco.neighborhood || "BH";

        // 3. Monta o HTML com a nova etiqueta (audience-tag)
        article.innerHTML = `
            <div class="card-header">
                <h3>${bloco.name}</h3>
                <button class="fav-btn ${favoritoClass}" data-id="${bloco.id}">
                    <i class="${iconHeart}"></i>
                </button>
            </div>
            <div class="card-body">
                
                <div class="audience-tag">
                    <i class="${audienceConfig.icon}"></i>
                    <span>${bloco.audience || 'Geral'}</span>
                </div>

                ${statusHTML}
                <div class="card-info weather-placeholder" id="weather-${bloco.id}"></div>
                <div class="card-info"><i class="fas fa-map-marker-alt"></i><span>${bairro}</span></div>
                <div class="card-tags">${estilosTags}</div>
            </div>
        `;

        fragment.appendChild(article);
    });

    container.appendChild(fragment);
    atualizarClimaDosCards(listaBlocos);
}

async function atualizarClimaDosCards(blocos) {
    for (const bloco of blocos) {
        if (bloco.lat && bloco.lng && bloco.date) {
            const clima = await getPrevisaoTempo(bloco.lat, bloco.lng, bloco.date);
            if (clima) {
                const el = document.getElementById(`weather-${bloco.id}`);
                if (el) {
                    el.innerHTML = `
                        <i class="fas ${clima.icone}" title="Máx: ${clima.tempMax}°C"></i>
                        <span>${clima.tempMax}°C</span>
                    `;
                    el.classList.add(clima.icone.includes('rain') || clima.icone.includes('bolt') ? 'clima-chuva' : 'clima-sol');
                }
            }
        }
    }
}

/**
 * Exibe a tela de detalhes (Versão Melhorada com Identidade Visual).
 */
export async function mostrarDetalhes(bloco) {
    // 1. Limpa listener anterior (Vibe Check)
    if (unsubscribeVibe) {
        unsubscribeVibe();
        unsubscribeVibe = null;
    }

    const container = document.getElementById('detalhes-conteudo');
    
    // 2. Configurações de Público e Estilo
    const audConfig = getAudienceConfig(bloco.audience); 
    const estilosMusicais = Array.isArray(bloco.musical_style) ? bloco.musical_style.join(' • ') : 'Diversos';
    
    // 3. Status e Check-in
    const jaFui = isCheckedIn(bloco.id);
    const checkinClass = jaFui ? 'checked' : '';
    const checkinText = jaFui ? 'Fui e sobrevivi!' : 'Marcar presença';
    const checkinIcon = jaFui ? 'fas fa-check-circle' : 'far fa-circle';

    // 4. Links Externos (Maps e Uber)
    let mapsUrl, btnUberHtml = '';
    if (bloco.lat && bloco.lng) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bloco.lat},${bloco.lng}&travelmode=walking`;
        
        const nickname = encodeURIComponent(bloco.name);
        // Botão Uber com estilo "Noturno" fixo para contraste
        const uberUrl = `https://m.uber.com/ul/?action=setPickup&client_id=nu_carnaval&pickup=my_location&dropoff[latitude]=${bloco.lat}&dropoff[longitude]=${bloco.lng}&dropoff[nickname]=${nickname}`;
        btnUberHtml = `
            <a href="${uberUrl}" class="btn-uber">
               <i class="fab fa-uber"></i> Chamar Uber
            </a>
        `;
    } else {
        const query = encodeURIComponent((bloco.location || bloco.name) + " Belo Horizonte");
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    // 5. Previsão do Tempo (Lógica Assíncrona Rápida para o Detalhe)
    let weatherHtml = '';
    if (bloco.lat && bloco.lng && bloco.date) {
        // Tenta pegar do cache ou busca rápido
        const clima = await getPrevisaoTempo(bloco.lat, bloco.lng, bloco.date);
        if (clima) {
            weatherHtml = `
                <div class="detalhe-clima ${clima.icone.includes('rain') ? 'chuva' : 'sol'}">
                    <i class="fas ${clima.icone}"></i>
                    <span>Previsão: <strong>${clima.tempMax}°C</strong> (${clima.resumo || 'Sem chuva'})</span>
                </div>
            `;
        }
    }

    // 6. Montagem do HTML
    // Adicionamos a classe do público (audConfig.css) no container pai para liberar a variável --aud-color
    container.innerHTML = `
        <div class="detalhe-wrapper ${audConfig.css}">
            
            <div class="detalhe-hero">
                <div class="detalhe-header-top">
                    <span class="audience-pill" style="background-color: var(--aud-color);">
                        <i class="${audConfig.icon}" style="color: #000;"></i> ${bloco.audience || 'Geral'}
                    </span>
                    ${getStatusPill(bloco)}
                </div>

                <h1 class="detalhe-titulo">${bloco.name}</h1>
                <p class="detalhe-subtitulo">${estilosMusicais}</p>

                ${weatherHtml}
                
                ${bloco.description ? `<div class="detalhe-descricao">"${bloco.description}"</div>` : ''}
                
                <div class="detalhe-grid-info">
                    <div class="info-item">
                        <i class="far fa-calendar-alt"></i>
                        <div>
                            <span class="label">Data</span>
                            <span class="valor">${bloco.date.split('-').reverse().join('/')}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="far fa-clock"></i>
                        <div>
                            <span class="label">Início</span>
                            <span class="valor">${bloco.time}</span>
                        </div>
                    </div>
                </div>

                <button id="btn-checkin-action" class="btn-checkin ${checkinClass}" data-id="${bloco.id}">
                    <i class="${checkinIcon}"></i> <span>${checkinText}</span>
                </button>
            </div>

            <div class="utility-card">
                <h3><i class="fas fa-map-marked-alt"></i> Onde é o trem?</h3>
                
                <div class="localizacao-box">
                    <div class="loc-row">
                        <div class="dot start"></div>
                        <p><strong>Concentração:</strong> ${bloco.location}</p>
                    </div>
                    ${bloco.locationEnd ? `
                    <div class="loc-connector"></div>
                    <div class="loc-row">
                        <div class="dot end"></div>
                        <p><strong>Dispersão:</strong> ${bloco.locationEnd}</p>
                    </div>` : ''}
                </div>

                <div id="detalhe-mapa-interno" class="mapa-preview"></div>

                <div class="botoes-mapa-grid">
                    <a href="${mapsUrl}" target="_blank" class="detalhe-mapa-btn">
                        <i class="fas fa-location-arrow"></i> Abrir GPS
                    </a>
                    ${btnUberHtml}
                </div>
            </div>

            <div class="vibe-section utility-card">
                <h3 style="color: var(--color-primary);"><i class="fas fa-satellite-dish"></i> Vibe Check (Ao Vivo)</h3>
                <p style="font-size: 0.9rem; margin-bottom: 12px; color: #666;">O que tá rolando agora?</p>
                
                <div id="vibe-display" class="vibe-display loading">
                    <span class="vibe-status">Carregando...</span>
                    <div class="vibe-badges"></div>
                </div>

                <div id="vibe-controls" class="vibe-controls">
                    ${ getAuth().currentUser ? `
                        <button class="btn-vibe btn-fogo" data-tipo="fogo">🔥<br>Fervendo</button>
                        <button class="btn-vibe btn-morto" data-tipo="morto">💀<br>Morgado</button>
                        <button class="btn-vibe btn-policia" data-tipo="policia">👮<br>Polícia</button>
                    ` : `
                        <div class="login-lock">
                            <i class="fas fa-lock"></i> <span>Faça login para avisar a galera!</span>
                        </div>
                    `}
                </div>
            </div>
            
            <div style="height: 100px;"></div>
        </div>`;

    mudarVisualizacao('view-detalhes');

    setTimeout(() => {
        renderDetalheMap(bloco);
    }, 100);

    // Inicia lógica do Vibe Check separada para organização
    iniciarVibeCheck(bloco);
}

/**
 * Helper para retornar a Pill de Status "AO VIVO" no detalhe
 */
function getStatusPill(bloco) {
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'); 
    const agora = new Date().getHours();
    const horaBloco = parseInt(bloco.time.split(':')[0]);
    
    if (bloco.date === hoje && agora >= horaBloco && agora < horaBloco + 5) {
        return `<span class="status-live-pill">AO VIVO 🔥</span>`;
    }
    return '';
}

/**
 * Lógica do Vibe Check extraída para limpar a função principal
 */
function iniciarVibeCheck(bloco) {
    const displayEl = document.getElementById('vibe-display');
    const statusEl = displayEl.querySelector('.vibe-status');
    const badgesEl = displayEl.querySelector('.vibe-badges');
    const botoes = document.querySelectorAll('.btn-vibe');

    unsubscribeVibe = monitorarVibe(bloco.id, (data) => {
        displayEl.classList.remove('loading');
        statusEl.textContent = data.statusTexto;
        
        // Cores do Card
        displayEl.className = 'vibe-display'; 
        if (data.score > 3) displayEl.classList.add('vibe-hot');
        else if (data.score < -1) displayEl.classList.add('vibe-dead');
        else displayEl.classList.add('vibe-neutral');

        // Badges
        badgesEl.innerHTML = '';
        if (data.temPolicia) {
            badgesEl.innerHTML += `<span class="badge-policia">👮 Policiamento</span>`;
        }
        if (data.total > 0) {
            badgesEl.innerHTML += `<span class="badge-count">${data.total} votos</span>`;
        }
    });

    botoes.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tipo = btn.dataset.tipo;
            btn.classList.add('sending');
            
            const sucesso = await enviarVibe(bloco.id, tipo);
            
            if (sucesso) {
                botoes.forEach(b => b.disabled = true);
                setTimeout(() => botoes.forEach(b => b.disabled = false), 5000);
            }
            btn.classList.remove('sending');
        });
    });
}

/**
 * Gerencia a troca de visualização (Abas) e Visibilidade da Barra de Pesquisa
 */
export function mudarVisualizacao(viewId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active-view');
        section.classList.add('view-hidden');
    });

    const appHeader = document.querySelector('.app-header');
    const bottomNav = document.querySelector('.bottom-nav');
    const mainContent = document.getElementById('main-content');

    // Lógica de exibição do Header/Nav e Padding
    if (viewId === 'view-detalhes') {
        appHeader.style.display = 'none';
        bottomNav.style.display = 'none';
        mainContent.style.paddingTop = '0';
    } else {
        appHeader.style.display = 'flex';
        bottomNav.style.display = 'flex';
        mainContent.style.paddingTop = ''; 
    }

    // Ativa a view alvo
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('view-hidden');
        target.classList.add('active-view');
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (viewId === 'view-guia') {
        renderBotaoNotificacao();
    }

    // --- CONTROLE DE VISIBILIDADE DA BUSCA ---
    const searchContainer = document.querySelector('.search-container');
    const filterChips = document.querySelector('.filter-chips');
    const filterToggle = document.getElementById('filter-toggle');

    if (searchContainer) {
        if (viewId === 'view-guia') {
            searchContainer.style.display = 'none';
            if (filterChips) filterChips.style.display = 'none';
            if (filterToggle) filterToggle.style.display = 'none';
        } else {
            searchContainer.style.display = 'block';
            if (filterChips) filterChips.style.display = 'flex';
            if (filterToggle) filterToggle.style.display = 'block';
        }
    }
}

export function atualizarBotaoFavorito(btnElement, isFav) {
    const icon = btnElement.querySelector('i');
    if (isFav) {
        btnElement.classList.add('favorited');
        icon.classList.remove('far');
        icon.classList.add('fas');
    } else {
        btnElement.classList.remove('favorited');
        icon.classList.remove('fas');
        icon.classList.add('far');
    }
}

export function renderCategorias(categorias, onClick) {
    const container = document.querySelector('.filter-chips');
    if (!container) return;
    container.innerHTML = '';

    const fixos = [{ id: 'todos', label: 'Todos' }, { id: 'hoje', label: 'Hoje' }];
    const listaFinal = [...fixos];
    
    categorias.sort().forEach(cat => {
        if(cat && cat.length > 1) listaFinal.push({ id: cat.toLowerCase(), label: cat });
    });

    listaFinal.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        if (item.id === 'todos') btn.classList.add('active');
        btn.dataset.filter = item.id;
        btn.textContent = item.label;
        btn.onclick = () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            onClick(item.id);
        };
        container.appendChild(btn);
    });
}

function getStatusHTML(bloco) {
    if (!bloco.date || !bloco.time) return '';
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'); 
    
    const agora = new Date().getHours();
    const horaBloco = parseInt(bloco.time.split(':')[0]);
    const isHoje = bloco.date === hoje; 
    const isRolando = isHoje && (agora >= horaBloco && agora < horaBloco + 5);

    if (isRolando) {
        return `<div class="status-live" style="background:var(--color-cta); color:black; border:2px solid black; padding:2px 6px; font-weight:800; transform:rotate(-1deg);">TÁ ROLANDO!</div>`;
    } else {
        const diaMes = bloco.date.split('-').reverse().slice(0, 2).join('/');
        return `<div class="card-info"><i class="far fa-clock"></i><span style="font-weight:700; color: var(--color-asphalt);">${diaMes} às ${bloco.time}</span></div>`;
    }
}

export function renderTimeline(listaBlocos, containerId = 'lista-favoritos') {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 
    
    if (!listaBlocos || listaBlocos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <p>Sua agenda tá vazia!</p>
                <p style="font-size: 0.9rem;">Favorite uns blocos pra montar seu roteiro.</p>
            </div>
        `;
        return;
    }

    const gruposPorData = {};
    listaBlocos.forEach(bloco => {
        if (!gruposPorData[bloco.date]) gruposPorData[bloco.date] = [];
        gruposPorData[bloco.date].push(bloco);
    });

    const datasOrdenadas = Object.keys(gruposPorData).sort();
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-container';

    datasOrdenadas.forEach(data => {
        const blocosDoDia = gruposPorData[data];
        blocosDoDia.sort((a, b) => a.time.localeCompare(b.time));

        const dayGroup = document.createElement('div');
        dayGroup.className = 'timeline-day-group';
        const dateObj = new Date(data + 'T12:00:00'); 
        const diaFormatado = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'long' });
        dayGroup.innerHTML = `<div class="timeline-date-header">${diaFormatado}</div>`;

        let ultimoHorarioFim = -1;

        blocosDoDia.forEach((bloco, index) => {
            const [hora, min] = bloco.time.split(':').map(Number);
            const inicioMinutos = hora * 60 + min;
            const duracaoEstimada = 240; 
            const fimMinutos = inicioMinutos + duracaoEstimada;

            const temConflito = index > 0 && inicioMinutos < (ultimoHorarioFim - 30);

            if (temConflito) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'conflict-alert';
                alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Choque de Horário!`;
                dayGroup.appendChild(alertDiv);
            }

            const itemDiv = document.createElement('div');
            itemDiv.className = `timeline-item ${temConflito ? 'conflict' : ''}`;
            itemDiv.innerHTML = `<div class="timeline-marker"></div>`;
            itemDiv.appendChild(criarCardTimeline(bloco));
            dayGroup.appendChild(itemDiv);

            ultimoHorarioFim = fimMinutos;
        });

        timelineWrapper.appendChild(dayGroup);
    });

    container.appendChild(timelineWrapper);
}

function criarCardTimeline(bloco) {
    const article = document.createElement('article');
    article.className = 'bloco-card';
    article.onclick = (e) => {
        if (e.target.closest('.fav-btn')) return;
        mostrarDetalhes(bloco); 
    };

    article.innerHTML = `
        <div class="card-header" style="padding: 12px;">
            <h3 style="font-size: 1.1rem;">${bloco.name}</h3>
            <button class="fav-btn favorited" data-id="${bloco.id}">
                <i class="fas fa-heart"></i>
            </button>
        </div>
        <div class="card-body" style="padding: 0 12px 12px 12px;">
            <div class="card-info">
                <i class="far fa-clock"></i>
                <span style="font-weight:800; color: var(--color-primary);">${bloco.time}</span>
                <span style="margin: 0 8px; color:#ccc;">|</span>
                <i class="fas fa-map-marker-alt"></i>
                <span>${bloco.neighborhood || "BH"}</span>
            </div>
        </div>
    `;
    return article;
}

export function renderStats(count, containerId = 'stats-container') {
    const container = document.getElementById(containerId);
    if(!container) return;

    if (count === 0) {
        container.innerHTML = '';
        return;
    }

    let titulo = "Iniciante";
    if (count > 0) titulo = "Folião";
    if (count > 5) titulo = "Guerreiro(a)";
    if (count > 10) titulo = "Inimigo do Fim";
    if (count > 20) titulo = "Lenda do Carnaval";

    container.innerHTML = `
        <div class="stats-card">
            <div class="stats-info">
                <h3>Nível: ${titulo}</h3>
                <p style="font-size: 0.9rem; color: #666;">Blocos sobrevividos</p>
            </div>
            <div class="stats-count">${count}</div>
            <div class="stats-icon"><i class="fas fa-medal"></i></div>
        </div>
    `;
}

function renderBotaoNotificacao() {
    const container = document.querySelector('.utility-list');
    
    // --- PROTEÇÃO DE MODO DEMO ---
    const params = new URLSearchParams(window.location.search);
    if (!params.has('demo')) return;
    // -----------------------------

    // Evita duplicar se já existir
    if (!container || document.getElementById('btn-ativar-push')) return;

    const btn = document.createElement('article');
    btn.id = 'btn-ativar-push';
    btn.className = 'utility-card';
    btn.style.cursor = 'pointer';
    btn.style.border = '2px solid var(--color-primary)';
    
    btn.innerHTML = `
        <h3 style="color: var(--color-primary); display:flex; align-items:center; gap:10px;">
            <i class="fas fa-bell"></i> Testar Alertas de Crise
        </h3>
        <p>MODO DEMO: Simulação para apresentação.</p>
    `;

    btn.onclick = async () => {
        const { NotificationManager } = await import('./notifications.js');
        const permitido = await NotificationManager.solicitarPermissao();
        
        if (permitido) {
            btn.style.borderColor = 'var(--color-success)';
            btn.style.cursor = 'default';
            btn.onclick = null;

            btn.innerHTML = `
                <h3 style="color: var(--color-success);">
                    <i class="fas fa-check-circle"></i> Alertas Ativados (Demo)
                </h3>
                <p>Clique abaixo para simular uma crise.</p>
                <button id="btn-simular-agora" style="
                    margin-top:12px; 
                    width:100%; 
                    background:var(--color-primary); 
                    color:white; 
                    border:2px solid black; 
                    padding:12px; 
                    font-weight:bold; 
                    text-transform:uppercase; 
                    cursor:pointer; 
                    box-shadow: 4px 4px 0px black;
                ">
                    <i class="fas fa-exclamation-triangle"></i> Disparar Alerta Agora
                </button>
            `;

            document.getElementById('btn-simular-agora').onclick = (e) => {
                e.stopPropagation();
                NotificationManager.simularAlertaCrise();
            };
        } else {
            alert('Você precisa permitir as notificações no navegador.');
        }
    };

    container.insertBefore(btn, container.firstChild);
}

/**
 * Renderiza o cartaz para o Instagram Stories (HTML oculto)
 * @param {Array} blocos - Lista de blocos favoritos
 */
export function renderPoster(blocos) {
    const container = document.getElementById('poster-stories');
    if (!container) return;

    // Cabeçalho
    let html = `
        <div class="poster-header">
            <div class="poster-title">MEU ROTEIRO</div>
            <div class="poster-subtitle">Nu! Carnaval 2026 🎉</div>
        </div>
        <div class="poster-list">
    `;

    // Limite de itens para caber na imagem
    const MAX_ITEMS = 6;
    const blocosParaExibir = blocos.slice(0, MAX_ITEMS);

    if (blocos.length === 0) {
        html += `
            <div class="poster-item" style="justify-content:center;">
                <h3 style="font-size:2rem; text-align:center;">Ainda não escolhi meus trens! 🤷‍♂️</h3>
            </div>
        `;
    } else {
        blocosParaExibir.forEach(bloco => {
            // Formata data simples (31/01)
            const diaMes = bloco.date ? bloco.date.split('-').reverse().slice(0,2).join('/') : '';
            
            // FIX: Card Fundo PRETO e Texto/Bordas BRANCAS para contraste na imagem gerada
            html += `
                <div class="poster-item" style="background-color: #1A1A1A !important; color: #FFFFFF !important; border: 6px solid #FFFFFF !important;">
                    <div class="poster-time" style="background-color: #CCFF00 !important; color: #1A1A1A !important; border: 4px solid #FFFFFF !important;">${bloco.time}</div>
                    <div class="poster-info" style="color: #FFFFFF !important;">
                        <h3 style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; margin-bottom: 8px;">${bloco.name}</h3>
                        <p style="color: #DDDDDD !important; font-weight: 700;">
                            <i class="fas fa-calendar-alt" style="color: #FF2A00 !important;"></i> ${diaMes} • 
                            <i class="fas fa-map-marker-alt" style="color: #FF2A00 !important;"></i> ${bloco.neighborhood || 'BH'}
                        </p>
                    </div>
                </div>
            `;
        });
    }

    // Se tiver mais blocos que o limite
    if (blocos.length > MAX_ITEMS) {
        html += `
            <div class="poster-item" style="background:#FF2A00 !important; color:white !important; justify-content:center;">
                <h3 style="font-size:2rem; color: white !important;">+ ${blocos.length - MAX_ITEMS} outros blocos...</h3>
            </div>
        `;
    }

    html += `
        </div>
        <div class="poster-footer">
            <p>Monte o seu em <span>nu-carnaval.vercel.app</span></p>
        </div>
    `;

    container.innerHTML = html;
}