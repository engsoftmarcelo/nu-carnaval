/* ==========================================================================
   js/ui.js
   Camada de Interface - VERSÃO CORRIGIDA (Rota GPS -> Concentração)
   ========================================================================== */

import { isFavorito, isCheckedIn } from './storage.js';
import { getPrevisaoTempo } from './weather.js';
import { renderDetalheMap } from './map.js'; 

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
        article.className = 'bloco-card';
        
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

        article.innerHTML = `
            <div class="card-header">
                <h3>${bloco.name}</h3>
                <button class="fav-btn ${favoritoClass}" data-id="${bloco.id}">
                    <i class="${iconHeart}"></i>
                </button>
            </div>
            <div class="card-body">
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
 * Exibe a tela de detalhes.
 * CORREÇÃO: Link do Google Maps agora traça rota "Minha Localização -> Bloco".
 */
export function mostrarDetalhes(bloco) {
    const container = document.getElementById('detalhes-conteudo');
    const estilos = Array.isArray(bloco.musical_style) ? bloco.musical_style.join(', ') : 'Diversos';
    
    // Check-in logic
    const jaFui = isCheckedIn(bloco.id);
    const checkinClass = jaFui ? 'checked' : '';
    const checkinText = jaFui ? 'Fui e sobrevivi!' : 'Marcar presença ("Eu fui!")';
    const checkinIcon = jaFui ? 'fas fa-check-circle' : 'far fa-circle';

    // --- CORREÇÃO DO LINK DO MAPA ---
    let mapsUrl;
    if (bloco.lat && bloco.lng) {
        // Usa a API universal "dir" (Directions). 
        // Sem o parâmetro "origin", ele assume a localização atual do GPS.
        mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${bloco.lat},${bloco.lng}&travelmode=walking`;
    } else {
        // Fallback para busca textual se não tiver coordenadas
        const query = encodeURIComponent((bloco.location || bloco.name) + " Belo Horizonte");
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    container.innerHTML = `
        <div class="detalhe-hero">
            <h1 class="detalhe-titulo">${bloco.name}</h1>
            <p style="font-size: 1.1rem; color: #666;">${estilos}</p>
            
            <div class="detalhe-meta">
                <div class="meta-box">
                    <span class="meta-label">Data</span>
                    <div class="meta-valor">${bloco.date.split('-').reverse().join('/')}</div>
                </div>
                <div class="meta-box">
                    <span class="meta-label">Horário</span>
                    <div class="meta-valor">${bloco.time}</div>
                </div>
            </div>

            <button id="btn-checkin-action" class="btn-checkin ${checkinClass}" data-id="${bloco.id}">
                <i class="${checkinIcon}"></i> <span>${checkinText}</span>
            </button>
        </div>

        <div class="utility-card">
            <h3><i class="fas fa-map-signs"></i> Trajeto</h3>
            
            <div id="detalhe-mapa-interno" style="height: 250px; width: 100%; border-radius: 8px; border: 2px solid #1A1A1A; margin-top: 10px; z-index: 1; background-color: #e0e0e0;"></div>
            
            <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:0.85rem; font-weight:700; color:#1A1A1A;">
                 <span style="display:flex; align-items:center; gap:6px;">
                    <div style="width:12px; height:12px; background:#00C853; border-radius:50%; border:2px solid #1A1A1A;"></div> 
                    Concentração
                 </span>
                 <span style="display:flex; align-items:center; gap:6px;">
                    <div style="width:12px; height:12px; background:#FF2A00; border-radius:50%; border:2px solid #1A1A1A;"></div> 
                    Dispersão
                 </span>
            </div>
            
            <div style="margin-top: 16px; border-top: 1px dashed #ccc; padding-top: 12px;">
                <p style="font-size: 0.9rem; margin-bottom:4px;"><strong>Início:</strong> ${bloco.location}</p>
                ${bloco.locationEnd ? `<p style="font-size: 0.9rem;"><strong>Fim:</strong> ${bloco.locationEnd}</p>` : ''}
            </div>

            <a href="${mapsUrl}" target="_blank" class="detalhe-mapa-btn">
               <i class="fas fa-location-arrow"></i> Como chegar (GPS)
            </a>
        </div>
        
        <div style="height: 100px;"></div>`;

    mudarVisualizacao('view-detalhes');

    setTimeout(() => {
        renderDetalheMap(bloco);
    }, 100);
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
        mainContent.style.paddingTop = 'calc(var(--header-height) + 20px)';
    }

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('view-hidden');
        target.classList.add('active-view');
        window.scrollTo({ top: 0, behavior: 'auto' });
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