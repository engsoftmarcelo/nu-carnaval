/* ==========================================================================
   js/ui.js
   Camada de Interface - ATUALIZADO (Sem Mapa, Transportes por Texto, Tickets)
   ========================================================================== */

import { isFavorito, isCheckedIn, toggleFavorito } from './storage.js';
import { getPrevisaoTempo } from './weather.js';
// O import do mapa foi removido pois não vamos mais usá-lo na tela de detalhes
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { enviarVibe, monitorarVibe } from './firebase.js';

let unsubscribeVibe = null;

/**
 * Retorna a configuração de estilo baseada no público.
 */
function getAudienceConfig(publico) {
    if (!publico) return { css: 'aud-todos', icon: 'fas fa-globe-americas', emoji: '🎉' };

    const normalize = (str) => str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const chave = normalize(publico);

    const mapa = {
        'infantil':      { css: 'aud-infantil',      icon: 'fas fa-child',          emoji: '🎈' },
        'crianca':       { css: 'aud-infantil',      icon: 'fas fa-shapes',         emoji: '🍭' },
        'familia':       { css: 'aud-familia',       icon: 'fas fa-users',          emoji: '👨‍👩‍👧‍👦' },
        'lgbt':          { css: 'aud-lgbt',          icon: 'fas fa-rainbow',        emoji: '🏳️‍🌈' },
        'gay':           { css: 'aud-lgbt',          icon: 'fas fa-transgender',    emoji: '🦄' },
        'afro':          { css: 'aud-cultural',      icon: 'fas fa-drum',           emoji: '✊🏿' },
        'cultural':      { css: 'aud-cultural',      icon: 'fas fa-theater-masks',  emoji: '🎭' },
        'rock':          { css: 'aud-rock',          icon: 'fas fa-hand-rock',      emoji: '🤘' },
        'alternativo':   { css: 'aud-rock',          icon: 'fas fa-guitar',         emoji: '🎸' },
        'universitario': { css: 'aud-universitario', icon: 'fas fa-graduation-cap', emoji: '🍻' },
        'jovem':         { css: 'aud-jovem',         icon: 'fas fa-bolt',           emoji: '⚡' },
        'terceira':      { css: 'aud-terceira',      icon: 'fas fa-heart',          emoji: '💃' },
        'idoso':         { css: 'aud-terceira',      icon: 'fas fa-star',           emoji: '🌟' },
        'religioso':     { css: 'aud-religioso',     icon: 'fas fa-praying-hands',  emoji: '🙌' },
        'torcida':       { css: 'aud-torcedores',    icon: 'fas fa-futbol',         emoji: '⚽' },
        'pet':           { css: 'aud-pet',           icon: 'fas fa-paw',            emoji: '🐶' },
        'mulheres':      { css: 'aud-mulheres',      icon: 'fas fa-venus',          emoji: '💄' },
        'adulto':        { css: 'aud-adulto',        icon: 'fas fa-wine-glass-alt', emoji: '🍸' },
        'geral':         { css: 'aud-todos',         icon: 'fas fa-globe-americas', emoji: '🎉' }
    };

    if (mapa[chave]) return mapa[chave];
    
    for (const [key, val] of Object.entries(mapa)) {
        if (chave.includes(key)) return val;
    }

    return { css: 'aud-todos', icon: 'fas fa-bullhorn', emoji: '🎊' };
}

function getPublicoDoBloco(bloco) {
    return bloco.audience || 
           bloco['Público-Alvo Principal'] || 
           bloco['Público-Alvo'] || 
           bloco['publico'] || 
           'Geral';
}

function getCountdownHTML(dataStr, horaStr) {
    if (!dataStr || !horaStr) return '';
    
    let dataIso = dataStr.includes('/') ? dataStr.split('/').reverse().join('-') : dataStr;
    const dataBloco = new Date(`${dataIso}T${horaStr}:00`);
    const agora = new Date();
    const diffMs = dataBloco - agora;

    if (diffMs < 0) {
        if (Math.abs(diffMs) < 5 * 60 * 60 * 1000) {
            return '<div class="hype-counter" style="background:var(--color-live); color:#000; border-color:#000;">🔥 TÁ ROLANDO AGORA!</div>';
        }
        return ''; 
    }

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (dias > 0) return `<div class="hype-counter">⏳ Faltam ${dias} dias e ${horas}h</div>`;
    if (horas > 0) return `<div class="hype-counter" style="background:#CCFF00; color:#000;">⚡ É HOJE! Faltam ${horas}h</div>`;
    
    return '<div class="hype-counter" style="background:#FF2A00; color:#FFF;">🚀 PREPARA! É JÁ JÁ!</div>';
}

export function renderBlocos(listaBlocos, containerId = 'lista-blocos') {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!listaBlocos || listaBlocos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-sad-tear" style="font-size: 3rem; margin-bottom: 16px; color: #ccc;"></i>
                <p>Nu! O trem sumiu.</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Não achamos nenhum bloco com esse filtro.</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    listaBlocos.forEach(bloco => {
        const article = document.createElement('article');
        
        const publicoTexto = getPublicoDoBloco(bloco);
        const config = getAudienceConfig(publicoTexto);
        
        article.className = `bloco-card ${config.css}`;
        
        article.onclick = (e) => {
            if (e.target.closest('.fav-btn')) return;
            mostrarDetalhes(bloco);
        };

        const favoritoClass = isFavorito(bloco.id) ? 'favorited' : '';
        const iconHeart = isFavorito(bloco.id) ? 'fas fa-heart' : 'far fa-heart';
        const statusHTML = getStatusHTML(bloco);
        
        const estilos = Array.isArray(bloco.musical_style) ? bloco.musical_style : (bloco['Estilo Musical'] ? [bloco['Estilo Musical']] : []);
        const estilosTags = estilos.map(style => `<span class="tag">${style}</span>`).join(' ');
        
        const bairro = bloco.neighborhood || bloco['bairro'] || "Belo Horizonte";

        article.innerHTML = `
            <div class="card-header">
                <div class="card-emoji-badge">${config.emoji}</div>
                <h3>${bloco.name || bloco['Nome do Bloco']}</h3>
                <button class="fav-btn ${favoritoClass}" data-id="${bloco.id}">
                    <i class="${iconHeart}"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="audience-tag">
                    <i class="${config.icon}"></i>
                    <span>${publicoTexto}</span>
                </div>
                ${statusHTML}
                <div class="card-info weather-placeholder" id="weather-${bloco.id}"></div>
                <div class="card-info" style="color: var(--color-text); opacity: 0.9;">
                    <i class="fas fa-map-marker-alt" style="color: var(--aud-color);"></i>
                    <span>${bairro}</span>
                </div>
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
        const lat = bloco.lat || bloco['Latitude Local de Concentração'];
        const lng = bloco.lng || bloco['Longitude Local de Concentração'];
        const data = bloco.date || bloco['Data']; 

        if (lat && lng && data) {
            let dataFormatada = data;
            if (data.includes('/')) {
                dataFormatada = data.split('/').reverse().join('-');
            }

            const clima = await getPrevisaoTempo(lat, lng, dataFormatada);
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

// --- FUNÇÃO PRINCIPAL DE DETALHES (ATUALIZADA) ---
export async function mostrarDetalhes(bloco) {
    if (unsubscribeVibe) {
        unsubscribeVibe();
        unsubscribeVibe = null;
    }

    const container = document.getElementById('detalhes-conteudo');
    
    // 1. Configurações Visuais
    const publicoTexto = getPublicoDoBloco(bloco);
    const audConfig = getAudienceConfig(publicoTexto);
    const estilosMusicais = Array.isArray(bloco.musical_style) ? bloco.musical_style.join(' • ') : (bloco['Estilo Musical'] || 'Diversos');

    // 2. Lógica do Header (Botão Favorito)
    const btnFavHeader = document.getElementById('btn-fav-detalhe');
    if (btnFavHeader) {
        const updateFavState = () => {
            const isFav = isFavorito(bloco.id);
            if(isFav) {
                btnFavHeader.classList.add('favorited');
                btnFavHeader.innerHTML = '<i class="fas fa-heart"></i>';
            } else {
                btnFavHeader.classList.remove('favorited');
                btnFavHeader.innerHTML = '<i class="far fa-heart"></i>';
            }
        };
        updateFavState();
        
        // Clone para limpar eventos anteriores
        const newBtnFav = btnFavHeader.cloneNode(true);
        btnFavHeader.parentNode.replaceChild(newBtnFav, btnFavHeader);
        
        newBtnFav.addEventListener('click', () => {
            toggleFavorito(bloco.id);
            updateFavState();
            if(navigator.vibrate) navigator.vibrate(50);
        });
    }

    // 3. Dados do Bloco
    const nome = bloco.name || bloco['Nome do Bloco'];
    const bairro = bloco.neighborhood || bloco['bairro'] || 'Belo Horizonte';
    const local = bloco.location || bloco['Local de Concentração'] || 'Local a definir';
    const horario = bloco.time || bloco['Horário'];
    const dataOriginal = bloco.date || bloco['Data'];
    const dataExibicao = dataOriginal.split('-').reverse().join('/'); // Ex: 15/02/2026
    
    // Pega apenas "15/02" para o visual do ticket
    const diaMesTicket = dataExibicao.substring(0, 5); 
    const descricao = bloco.description || bloco['descrisao'] || '';

    // 4. Countdown
    const countdownHTML = getCountdownHTML(dataOriginal, horario);

    // 5. LÓGICA DE TRANSPORTE (POR TEXTO - SEM COORDENADAS)
    // Isso garante que os botões sempre apareçam
    const enderecoBusca = encodeURIComponent(`${local}, ${bairro}, Belo Horizonte, MG`);
    const apelidoLocal = encodeURIComponent(nome);

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${enderecoBusca}`;
    // Tenta usar formatted_address para ajudar o Uber a encontrar o local
    const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${enderecoBusca}&dropoff[nickname]=${apelidoLocal}`;
    const url99 = `https://d.99app.com/`; // Link genérico pois deep link da 99 é instável com busca de texto

    // 6. Renderização HTML
    container.innerHTML = `
        <div class="detalhe-wrapper ${audConfig.css}">
            
            <div class="detalhe-hero">
                <div class="detalhe-header-top">
                    <span class="audience-pill" style="background-color: var(--aud-color);">
                        <i class="${audConfig.icon}"></i> ${publicoTexto}
                    </span>
                    ${getStatusPill(bloco)}
                </div>

                <h1 class="detalhe-titulo">${nome}</h1>
                <p class="detalhe-subtitulo" style="font-size: 1.1rem; color: #555;">${estilosMusicais}</p>
                
                ${countdownHTML}

                <div class="detalhe-grid-info">
                    <div class="info-item">
                        <i class="far fa-calendar-alt"></i>
                        <span class="label">Dia</span>
                        <span class="valor">${diaMesTicket}</span>
                    </div>
                    <div class="info-item">
                        <i class="far fa-clock"></i>
                        <span class="label">Hora</span>
                        <span class="valor">${horario}</span>
                    </div>
                </div>

                <div id="weather-slot" style="margin-top: 8px;"></div>
                
                ${descricao ? `<div class="detalhe-descricao">"${descricao}"</div>` : ''}

                <button id="btn-checkin-action" class="btn-checkin ${isCheckedIn(bloco.id) ? 'checked' : ''}" data-id="${bloco.id}">
                    <i class="${isCheckedIn(bloco.id) ? 'fas fa-check-circle' : 'far fa-circle'}"></i> 
                    <span>${isCheckedIn(bloco.id) ? 'Fui e sobrevivi!' : 'Marcar presença'}</span>
                </button>
            </div>

            <div class="utility-card">
                <h3><i class="fas fa-map-marked-alt"></i> Como Chegar</h3>
                
                <div class="card-local-texto">
                    <h4 style="margin-bottom:4px; color:#1A1A1A; font-size:1.1rem;">${local}</h4>
                    <p style="color:#666; font-weight:bold;">${bairro}</p>
                </div>

                <p style="font-size:0.9rem; color:#888; margin-bottom:12px; text-align:center;">
                    Escolha seu app preferido para ir:
                </p>

                <div class="botoes-mapa-grid">
                    <a href="${uberUrl}" class="btn-transport btn-uber">
                        <i class="fab fa-uber"></i> Chamar Uber
                    </a>
                    <a href="${url99}" target="_blank" class="btn-transport btn-99">
                        <span class="icon-99">99</span> Chamar 99
                    </a>
                    <a href="${mapsUrl}" target="_blank" class="btn-transport btn-maps">
                        <i class="fas fa-location-arrow"></i> Ver no Maps
                    </a>
                </div>
            </div>

            <div class="vibe-section utility-card">
                <h3 style="color: var(--color-primary);"><i class="fas fa-satellite-dish"></i> Vibe Check</h3>
                <p style="font-size: 0.9rem; margin-bottom: 12px; color: #666;">Como tá o bloco agora?</p>

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
                        <div class="login-lock"><i class="fas fa-lock"></i> Faça login para votar!</div>
                    `}
                </div>
            </div>

            <div style="height: 100px;"></div>
        </div>`;

    // 7. Transição
    mudarVisualizacao('view-detalhes');

    // 8. Pós-Render
    requestAnimationFrame(() => {
        // Renderiza Clima apenas se tiver coords (mantivemos essa verificação p/ clima pois precisa de precisão)
        // Se quiser clima genérico de BH, teríamos que mudar a lógica do weather.js
        if (bloco.lat && bloco.lng) {
            const dataFormatada = dataOriginal.split('/').reverse().join('-');
            getPrevisaoTempo(bloco.lat, bloco.lng, dataFormatada).then(clima => {
                const el = document.getElementById('weather-slot');
                if (el && clima) {
                    el.innerHTML = `
                        <div class="detalhe-clima ${clima.icone.includes('rain') ? 'chuva' : 'sol'}">
                            <i class="fas ${clima.icone}"></i>
                            <span>Previsão: <strong>${clima.tempMax}°C</strong> (${clima.resumo || 'Sem chuva'})</span>
                        </div>`;
                }
            });
        }
        
        iniciarVibeCheck(bloco);
    });
}

function getStatusPill(bloco) {
    const data = bloco.date || bloco['Data'];
    const hora = bloco.time || bloco['Horário'];
    
    if (!data || !hora) return '';

    let dataIso = data;
    if (data.includes('/')) dataIso = data.split('/').reverse().join('-');

    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'); 
    const agora = new Date().getHours();
    const horaBloco = parseInt(hora.split(':')[0]);
    
    if (dataIso === hoje && agora >= horaBloco && agora < horaBloco + 5) {
        return `<span class="status-live-pill">AO VIVO 🔥</span>`;
    }
    return '';
}

function iniciarVibeCheck(bloco) {
    const displayEl = document.getElementById('vibe-display');
    const statusEl = displayEl.querySelector('.vibe-status');
    const badgesEl = displayEl.querySelector('.vibe-badges');
    const botoes = document.querySelectorAll('.btn-vibe');

    unsubscribeVibe = monitorarVibe(bloco.id, (data) => {
        if (!displayEl) return;
        
        displayEl.classList.remove('loading');
        statusEl.textContent = data.statusTexto;
        
        displayEl.className = 'vibe-display'; 
        if (data.score > 3) displayEl.classList.add('vibe-hot');
        else if (data.score < -1) displayEl.classList.add('vibe-dead');
        else displayEl.classList.add('vibe-neutral');

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

export function mudarVisualizacao(viewId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active-view');
        section.classList.add('view-hidden');
    });

    const appHeader = document.querySelector('.app-header');
    const bottomNav = document.querySelector('.bottom-nav');
    const mainContent = document.getElementById('main-content');

    if (viewId === 'view-detalhes') {
        appHeader.style.display = 'none';
        bottomNav.style.display = 'none';
        mainContent.style.paddingTop = '0';
    } else {
        appHeader.style.display = 'flex';
        bottomNav.style.display = 'flex';
        mainContent.style.paddingTop = ''; 
    }

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('view-hidden');
        target.classList.add('active-view');
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (viewId === 'view-guia') {
        renderBotaoNotificacao();
    }

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
    const data = bloco.date || bloco['Data'];
    const hora = bloco.time || bloco['Horário'];

    if (!data || !hora) return '';
    
    let dataIso = data;
    if (data.includes('/')) dataIso = data.split('/').reverse().join('-');

    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-'); 
    const agora = new Date().getHours();
    const horaBloco = parseInt(hora.split(':')[0]);
    
    const isHoje = dataIso === hoje; 
    const isRolando = isHoje && (agora >= horaBloco && agora < horaBloco + 5);

    if (isRolando) {
        return `<div class="status-live" style="background:var(--color-cta); color:black; border:2px solid black; padding:2px 6px; font-weight:800; transform:rotate(-1deg);">TÁ ROLANDO!</div>`;
    } else {
        const diaMes = data.includes('-') ? data.split('-').reverse().slice(0, 2).join('/') : data.substring(0, 5);
        return `<div class="card-info"><i class="far fa-clock"></i><span style="font-weight:700; color: var(--color-asphalt);">${diaMes} às ${hora}</span></div>`;
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
        const data = bloco.date || bloco['Data'];
        let dataKey = data;
        if (data.includes('/')) dataKey = data.split('/').reverse().join('-');

        if (!gruposPorData[dataKey]) gruposPorData[dataKey] = [];
        gruposPorData[dataKey].push(bloco);
    });

    const datasOrdenadas = Object.keys(gruposPorData).sort();
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-container';

    datasOrdenadas.forEach(data => {
        const blocosDoDia = gruposPorData[data];
        blocosDoDia.sort((a, b) => {
            const horaA = a.time || a['Horário'];
            const horaB = b.time || b['Horário'];
            return horaA.localeCompare(horaB);
        });

        const dayGroup = document.createElement('div');
        dayGroup.className = 'timeline-day-group';
        const dateObj = new Date(data + 'T12:00:00'); 
        const diaFormatado = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'long' });
        dayGroup.innerHTML = `<div class="timeline-date-header">${diaFormatado}</div>`;

        let ultimoHorarioFim = -1;

        blocosDoDia.forEach((bloco, index) => {
            const horaStr = bloco.time || bloco['Horário'];
            const [hora, min] = horaStr.split(':').map(Number);
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
    // Consistência visual com os cards principais
    const publicoTexto = getPublicoDoBloco(bloco);
    const config = getAudienceConfig(publicoTexto);
    
    article.className = `bloco-card ${config.css}`;
    article.onclick = (e) => {
        if (e.target.closest('.fav-btn')) return;
        mostrarDetalhes(bloco); 
    };

    const nome = bloco.name || bloco['Nome do Bloco'];
    const hora = bloco.time || bloco['Horário'];
    const bairro = bloco.neighborhood || bloco['bairro'] || 'BH';

    article.innerHTML = `
        <div class="card-header" style="padding: 12px;">
            <div class="card-emoji-badge" style="font-size: 1.2rem; margin-right:6px;">${config.emoji}</div>
            <h3 style="font-size: 1.1rem;">${nome}</h3>
            <button class="fav-btn favorited" data-id="${bloco.id}">
                <i class="fas fa-heart"></i>
            </button>
        </div>
        <div class="card-body" style="padding: 0 12px 12px 12px;">
            <div class="card-info">
                <i class="far fa-clock"></i>
                <span style="font-weight:800; color: var(--color-primary);">${hora}</span>
                <span style="margin: 0 8px; color:#ccc;">|</span>
                <i class="fas fa-map-marker-alt"></i>
                <span>${bairro}</span>
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
    const params = new URLSearchParams(window.location.search);
    if (!params.has('demo')) return;

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

export function renderPoster(blocos) {
    const container = document.getElementById('poster-stories');
    if (!container) return;

    let html = `
        <div class="poster-header">
            <div class="poster-title">MEU ROTEIRO</div>
            <div class="poster-subtitle">Nu! Carnaval 2026 🎉</div>
        </div>
        <div class="poster-list">
    `;

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
            const data = bloco.date || bloco['Data'];
            const hora = bloco.time || bloco['Horário'];
            const nome = bloco.name || bloco['Nome do Bloco'];
            const bairro = bloco.neighborhood || bloco['bairro'] || 'BH';

            let diaMes = '';
            if (data) {
                diaMes = data.includes('-') ? data.split('-').reverse().slice(0, 2).join('/') : data.substring(0, 5);
            }
            
            html += `
                <div class="poster-item" style="background-color: #1A1A1A !important; color: #FFFFFF !important; border: 6px solid #FFFFFF !important;">
                    <div class="poster-time" style="background-color: #CCFF00 !important; color: #1A1A1A !important; border: 4px solid #FFFFFF !important;">${hora}</div>
                    <div class="poster-info" style="color: #FFFFFF !important;">
                        <h3 style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; margin-bottom: 8px;">${nome}</h3>
                        <p style="color: #DDDDDD !important; font-weight: 700;">
                            <i class="fas fa-calendar-alt" style="color: #FF2A00 !important;"></i> ${diaMes} • 
                            <i class="fas fa-map-marker-alt" style="color: #FF2A00 !important;"></i> ${bairro}
                        </p>
                    </div>
                </div>
            `;
        });
    }

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