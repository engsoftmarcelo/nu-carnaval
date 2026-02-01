/* ==========================================================================
   js/ui.js
   Camada de Interface - COMPLETO (Turnos, Clima Corrigido & Neo-Brutalismo)
   ========================================================================== */

import { isFavorito, isCheckedIn, toggleFavorito } from './storage.js';
import { getPrevisaoTempo } from './weather.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { enviarVibe, monitorarVibe } from './firebase.js';

let unsubscribeVibe = null;

// --- CONFIGURAÇÃO DE TURNOS (Personalização por Horário) ---
const SHIFT_CONFIG = {
    'manha': { 
        label: 'Manhã', 
        icon: 'fa-sun', 
        color: '#FFD700', // Amarelo Ouro
        bg: '#FFF9C4',
        border: '#FBC02D',
        text: '#000'
    },
    'tarde': { 
        label: 'Tarde', 
        icon: 'fa-fire', 
        color: '#FF5722', // Laranja Intenso
        bg: '#FFCCBC',
        border: '#E64A19',
        text: '#000'
    },
    'noite': { 
        label: 'Noite', 
        icon: 'fa-moon', 
        color: '#673AB7', // Roxo Profundo
        bg: '#D1C4E9',
        border: '#512DA8',
        text: '#FFF'
    }
};

// --- FUNÇÕES AUXILIARES DE LÓGICA ---

function getTurnoConfig(horario) {
    if (!horario) return SHIFT_CONFIG.tarde;
    const hora = parseInt(horario.split(':')[0]);
    
    if (hora >= 5 && hora < 12) return SHIFT_CONFIG.manha;
    if (hora >= 12 && hora < 18) return SHIFT_CONFIG.tarde;
    return SHIFT_CONFIG.noite;
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

// --- CARROSSEL DE DESTAQUES ---
export function renderDestaques(todosBlocos) {
    const container = document.getElementById('carousel-destaques');
    if (!container) return;

    const destaquesOriginais = todosBlocos.filter(b => 
        (b.is_special === true || b.is_special === "true") && b.artist_image
    );

    if (destaquesOriginais.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Duplica para efeito de loop infinito se tiver poucos
    let listaFinal = [...destaquesOriginais];
    while (listaFinal.length < 10) { 
        listaFinal = [...listaFinal, ...destaquesOriginais];
    }

    container.innerHTML = '';
    container.style.display = 'flex';

    const wrapper = document.createElement('div');
    wrapper.className = 'destaques-wrapper';
    
    // Estilos inline para garantir funcionamento do drag
    wrapper.style.scrollBehavior = 'auto'; 
    wrapper.style.overflowX = 'auto'; 
    wrapper.style.cursor = 'grab'; 
    wrapper.style.scrollbarWidth = 'none'; 

    listaFinal.forEach(bloco => {
        const card = document.createElement('div');
        card.className = 'destaque-card';
        card.onclick = (e) => {
            if (wrapper.classList.contains('dragging')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            mostrarDetalhes(bloco);
        };
        card.ondragstart = (e) => e.preventDefault();

        const data = bloco.date || bloco['Data'];
        const dataFormatada = data ? (data.includes('-') ? data.split('-').reverse().slice(0, 2).join('/') : data.substring(0, 5)) : '';
        const horario = bloco.time || bloco['Horário'];
        const nomeBloco = bloco.name || bloco['Nome do Bloco'];
        const artista = bloco.artist || "Artista Convidado";

        card.innerHTML = `
            <div class="destaque-img-container">
                <img src="${bloco.artist_image}" alt="${artista}" class="destaque-img" loading="lazy" style="pointer-events: none;">
                <div class="destaque-overlay"></div>
                <span class="destaque-badge">⭐ Destaque</span>
            </div>
            <div class="destaque-info">
                <h3 class="destaque-artista">${artista}</h3>
                <p class="destaque-bloco">No bloco: <strong>${nomeBloco}</strong></p>
                <div class="destaque-data">
                    <i class="far fa-calendar-alt"></i> ${dataFormatada} às ${horario}
                </div>
            </div>
        `;
        wrapper.appendChild(card);
    });

    container.appendChild(wrapper);

    // Lógica de Scroll Infinito/Drag
    let isPaused = false;
    let scrollPos = 0;
    const speed = 0.8; 
    let isDown = false;
    let startX;
    let scrollLeftStart;
    const itemWidth = 296; 
    const resetPoint = destaquesOriginais.length * itemWidth;

    function animateScroll() {
        if (!wrapper) return;
        if (wrapper.scrollLeft >= resetPoint) {
            const diff = wrapper.scrollLeft - resetPoint;
            wrapper.scrollLeft = diff;
            scrollPos = diff;
        }
        if (!isPaused && !isDown) {
            scrollPos += speed;
            wrapper.scrollLeft = scrollPos;
        } else {
            scrollPos = wrapper.scrollLeft;
        }
        requestAnimationFrame(animateScroll);
    }

    wrapper.addEventListener('mousedown', (e) => {
        isDown = true;
        isPaused = true;
        wrapper.classList.add('active');
        wrapper.style.cursor = 'grabbing';
        startX = e.pageX - wrapper.offsetLeft;
        scrollLeftStart = wrapper.scrollLeft;
        setTimeout(() => wrapper.classList.remove('dragging'), 100);
    });

    wrapper.addEventListener('mouseleave', () => {
        isDown = false;
        isPaused = false;
        wrapper.style.cursor = 'grab';
        wrapper.classList.remove('active');
    });

    wrapper.addEventListener('mouseup', () => {
        isDown = false;
        wrapper.style.cursor = 'grab';
        wrapper.classList.remove('active');
        setTimeout(() => isPaused = false, 1000);
        setTimeout(() => wrapper.classList.remove('dragging'), 50);
    });

    wrapper.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - wrapper.offsetLeft;
        const walk = (x - startX) * 1.5;
        wrapper.scrollLeft = scrollLeftStart - walk;
        if (Math.abs(walk) > 5) {
            wrapper.classList.add('dragging');
        }
    });

    wrapper.addEventListener('touchstart', () => isPaused = true, { passive: true });
    wrapper.addEventListener('touchend', () => setTimeout(() => isPaused = false, 1000));

    requestAnimationFrame(animateScroll);
}

// --- RENDERIZAÇÃO DA LISTA DE BLOCOS ---
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
        
        // Dados
        const nome = bloco.name || bloco['Nome do Bloco'];
        const bairro = bloco.neighborhood || bloco['bairro'] || "BH";
        const horario = bloco.time || bloco['Horário'] || "00:00";
        
        // Configuração de Estilo por TURNO
        const turno = getTurnoConfig(horario);
        
        article.className = 'bloco-card';
        // Borda esquerda colorida baseada no turno
        article.style.borderLeft = `6px solid ${turno.color}`;
        
        article.onclick = (e) => {
            if (e.target.closest('.fav-btn')) return;
            mostrarDetalhes(bloco);
        };

        const favoritoClass = isFavorito(bloco.id) ? 'favorited' : '';
        const iconHeart = isFavorito(bloco.id) ? 'fas fa-heart' : 'far fa-heart';
        const statusHTML = getStatusHTML(bloco);
        
        const estilos = Array.isArray(bloco.musical_style) ? bloco.musical_style : (bloco['Estilo Musical'] ? [bloco['Estilo Musical']] : []);
        const estilosTags = estilos.map(style => `<span class="tag">${style}</span>`).join(' ');
        
        article.innerHTML = `
            <div class="card-header" style="background-color: #FAFAFA; border-bottom: 2px solid #1A1A1A; padding: 12px; display: flex; align-items: flex-start; justify-content: space-between;">
                <div style="display: flex; flex-direction: column; gap: 4px; width: 85%;">
                     <span class="turno-badge" style="background:${turno.bg}; color:${turno.border}; border: 1px solid ${turno.border}; align-self: flex-start; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                        <i class="fas ${turno.icon}"></i> ${turno.label} • ${horario}
                    </span>
                    <h3 style="color: #1A1A1A; margin: 0; font-family: 'Anton', sans-serif; font-size: 1.3rem; line-height: 1.1; text-transform: uppercase;">${nome}</h3>
                </div>
                <button class="fav-btn ${favoritoClass}" data-id="${bloco.id}" style="color: #CCC; background: none; border: none; font-size: 1.4rem; cursor: pointer;">
                    <i class="${iconHeart}"></i>
                </button>
            </div>
            
            <div class="card-body" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                ${statusHTML}
                
                <div class="info-row" style="display: flex; align-items: center; gap: 8px; color: #555; font-weight: 700;">
                    <i class="fas fa-map-marker-alt" style="color: #1A1A1A;"></i>
                    <span>${bairro}</span>
                </div>

                <div id="weather-${bloco.id}" class="weather-widget" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.9rem; color: #1A1A1A;">
                    <span style="color: #999;">...</span>
                </div>

                <div class="card-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${estilosTags}
                </div>
            </div>
        `;

        fragment.appendChild(article);
    });

    container.appendChild(fragment);
    atualizarClimaDosCards(listaBlocos);
}

// --- FUNÇÃO DE CLIMA (COM CORREÇÃO FALLBACK) ---
async function atualizarClimaDosCards(blocos) {
    // Coordenadas do Centro de BH (Fallback)
    const BH_LAT = -19.917299;
    const BH_LNG = -43.934559;

    for (const bloco of blocos) {
        // Usa as coordenadas do bloco OU usa as de BH se não tiver
        const lat = bloco.lat || bloco['Latitude Local de Concentração'] || BH_LAT;
        const lng = bloco.lng || bloco['Longitude Local de Concentração'] || BH_LNG;
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
                    // Define cor se for chuva
                    const isRain = clima.icone.includes('rain') || clima.icone.includes('bolt') || clima.icone.includes('cloud-showers');
                    const bgClima = isRain ? '#CFD8DC' : '#FFF9C4';
                    
                    el.style.backgroundColor = bgClima;
                    el.style.padding = '4px 8px';
                    el.style.borderRadius = '4px';
                    el.style.border = '1px solid #1A1A1A';
                    
                    el.innerHTML = `
                        <i class="fas ${clima.icone}" title="Máx: ${clima.tempMax}°C"></i>
                        <span>${clima.tempMax}°C</span>
                    `;
                }
            }
        }
    }
}

// --- DETALHES DO BLOCO ---
export async function mostrarDetalhes(bloco) {
    if (unsubscribeVibe) {
        unsubscribeVibe();
        unsubscribeVibe = null;
    }

    const container = document.getElementById('detalhes-conteudo');
    
    // Dados Básicos
    const nome = bloco.name || bloco['Nome do Bloco'];
    const bairro = bloco.neighborhood || bloco['bairro'] || "Belo Horizonte";
    const horario = bloco.time || bloco['Horário'] || "00:00";
    
    // Configurações do Turno
    const turno = getTurnoConfig(horario);
    
    const estilosMusicais = Array.isArray(bloco.musical_style) ? bloco.musical_style.join(' • ') : (bloco['Estilo Musical'] || 'Diversos');

    // Botão Favorito no Header
    const btnFavHeader = document.getElementById('btn-fav-detalhe');
    if (btnFavHeader) {
        const novoBotao = btnFavHeader.cloneNode(true);
        btnFavHeader.parentNode.replaceChild(novoBotao, btnFavHeader);

        const updateFavVisual = () => {
            const isFav = isFavorito(bloco.id);
            if(isFav) {
                novoBotao.classList.add('favorited');
                novoBotao.innerHTML = '<i class="fas fa-heart"></i>';
                novoBotao.style.color = '#FF2A00';
            } else {
                novoBotao.classList.remove('favorited');
                novoBotao.innerHTML = '<i class="far fa-heart"></i>';
                novoBotao.style.color = '#1A1A1A';
            }
        };
        
        updateFavVisual();
        
        novoBotao.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorito(bloco.id);
            updateFavVisual();
            if(navigator.vibrate) navigator.vibrate(50);
            
            // Sincroniza lista
            const btnList = document.querySelector(`.fav-btn[data-id="${bloco.id}"]`);
            if(btnList) atualizarBotaoFavorito(btnList, isFavorito(bloco.id));
        });
    }

    // Mais Dados
    const local = bloco.location || bloco['Local de Concentração'] || 'Local a definir';
    const dataOriginal = bloco.date || bloco['Data'];
    const dataExibicao = dataOriginal.split('-').reverse().join('/'); // Ex: 15/02/2026
    const diaMesTicket = dataExibicao.substring(0, 5); 
    const descricao = bloco.description || bloco['descrisao'] || '';

    // Links
    const enderecoBusca = encodeURIComponent(`${local}, ${bairro}, Belo Horizonte, MG`);
    const apelidoLocal = encodeURIComponent(nome);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${enderecoBusca}`;
    const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${enderecoBusca}&dropoff[nickname]=${apelidoLocal}`;
    const url99 = `https://d.99app.com/`; 

    // Renderização HTML com Estilo do Turno
    container.innerHTML = `
        <div class="detalhe-wrapper">
            
            <div class="detalhe-hero" style="border-bottom: 4px solid #000; background: linear-gradient(to bottom, #FFF 0%, ${turno.bg} 100%); padding: 20px;">
                <div class="detalhe-header-top" style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span class="audience-pill" style="background-color: ${turno.color}; color: #000; border: 2px solid #000; box-shadow: 2px 2px 0px #000; padding: 4px 12px; border-radius: 20px; font-weight:bold; font-size:0.8rem; text-transform:uppercase;">
                        <i class="fas ${turno.icon}"></i> ${turno.label}
                    </span>
                    ${getStatusPill(bloco)}
                </div>

                <h1 class="detalhe-titulo" style="color: #1A1A1A; font-family:'Anton', sans-serif; text-transform:uppercase; font-size:2rem; line-height:1; margin-bottom:8px;">${nome}</h1>
                <p class="detalhe-subtitulo" style="color: #1A1A1A; font-weight: 700; opacity:0.8;">${estilosMusicais}</p>
                
                ${getCountdownHTML(dataOriginal, horario)}

                <div class="detalhe-grid-info" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:20px;">
                    <div class="info-item" style="border: 2px solid #000; background:#FFF; padding:10px; border-radius:8px; text-align:center;">
                        <i class="far fa-calendar-alt" style="color:${turno.color}; font-size:1.2rem; display:block; margin-bottom:4px;"></i>
                        <span class="valor" style="font-weight:800; font-size:1.1rem; display:block;">${diaMesTicket}</span>
                    </div>
                    <div class="info-item" style="border: 2px solid #000; background:#FFF; padding:10px; border-radius:8px; text-align:center;">
                        <i class="far fa-clock" style="color:${turno.color}; font-size:1.2rem; display:block; margin-bottom:4px;"></i>
                        <span class="valor" style="font-weight:800; font-size:1.1rem; display:block;">${horario}</span>
                    </div>
                </div>

                <div id="weather-slot" style="margin-top: 12px;"></div>
                
                ${descricao ? `<div class="detalhe-descricao" style="margin-top:16px; font-style:italic; border-left:4px solid ${turno.color}; padding-left:12px; color:#555;">"${descricao}"</div>` : ''}

                <button id="btn-checkin-action" class="btn-checkin ${isCheckedIn(bloco.id) ? 'checked' : ''}" data-id="${bloco.id}" style="width:100%; margin-top:20px; padding:16px; font-weight:bold; text-transform:uppercase; border:2px solid #000; background:#1A1A1A; color:#FFF; box-shadow:4px 4px 0px rgba(0,0,0,0.2);">
                    <i class="${isCheckedIn(bloco.id) ? 'fas fa-check-circle' : 'far fa-circle'}"></i> 
                    <span>${isCheckedIn(bloco.id) ? 'Fui e sobrevivi!' : 'Marcar presença'}</span>
                </button>
            </div>

            <div class="utility-card" style="margin:20px; padding:16px; border:2px solid #000; border-radius:12px; background:#FFF; box-shadow:6px 6px 0px #000;">
                <h3 style="margin-bottom:12px;"><i class="fas fa-map-marked-alt"></i> Como Chegar</h3>
                
                <div class="card-local-texto" style="margin-bottom:16px;">
                    <h4 style="margin-bottom:4px; color:#1A1A1A; font-size:1.1rem;">${local}</h4>
                    <p style="color:#666; font-weight:bold;">${bairro}</p>
                </div>

                <div class="botoes-mapa-grid" style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
                    <a href="${uberUrl}" class="btn-transport" style="text-align:center; padding:10px; border:2px solid #000; border-radius:6px; color:#000; font-weight:bold; text-decoration:none;">
                        Uber
                    </a>
                    <a href="${url99}" target="_blank" class="btn-transport" style="text-align:center; padding:10px; border:2px solid #000; border-radius:6px; color:#000; font-weight:bold; text-decoration:none;">
                        99
                    </a>
                    <a href="${mapsUrl}" target="_blank" class="btn-transport" style="text-align:center; padding:10px; border:2px solid #000; border-radius:6px; color:#000; font-weight:bold; text-decoration:none;">
                        Maps
                    </a>
                </div>
            </div>

            <div class="vibe-section utility-card" style="margin:20px; padding:16px; border:2px solid #000; border-radius:12px; background:#F5F5F5; box-shadow:6px 6px 0px #999;">
                <h3 style="color: #1A1A1A;"><i class="fas fa-satellite-dish"></i> Vibe Check</h3>
                <p style="font-size: 0.9rem; margin-bottom: 12px; color: #666;">Como tá o bloco agora?</p>

                <div id="vibe-display" class="vibe-display loading">
                    <span class="vibe-status">Carregando...</span>
                    <div class="vibe-badges"></div>
                </div>
                <div id="vibe-controls" class="vibe-controls" style="display:flex; gap:8px; margin-top:12px;">
                     ${ getAuth().currentUser ? `
                        <button class="btn-vibe btn-fogo" data-tipo="fogo" style="flex:1; padding:12px; border:2px solid #000; border-radius:8px; background:#FFF;">🔥<br>Fervendo</button>
                        <button class="btn-vibe btn-morto" data-tipo="morto" style="flex:1; padding:12px; border:2px solid #000; border-radius:8px; background:#FFF;">💀<br>Morgado</button>
                        <button class="btn-vibe btn-policia" data-tipo="policia" style="flex:1; padding:12px; border:2px solid #000; border-radius:8px; background:#FFF;">👮<br>Polícia</button>
                    ` : `
                        <div class="login-lock"><i class="fas fa-lock"></i> Faça login para votar!</div>
                    `}
                </div>
            </div>

            <div style="height: 100px;"></div>
        </div>`;

    mudarVisualizacao('view-detalhes');

    requestAnimationFrame(() => {
        // Fallback de coordenadas para Clima nos Detalhes
        const BH_LAT = -19.917299;
        const BH_LNG = -43.934559;
        
        const lat = bloco.lat || bloco['Latitude Local de Concentração'] || BH_LAT;
        const lng = bloco.lng || bloco['Longitude Local de Concentração'] || BH_LNG;
        const dataOriginal = bloco.date || bloco['Data'];

        if (lat && lng && dataOriginal) {
            const dataFormatada = dataOriginal.split('/').reverse().join('-');
            getPrevisaoTempo(lat, lng, dataFormatada).then(clima => {
                const el = document.getElementById('weather-slot');
                if (el && clima) {
                    const isRain = clima.icone.includes('rain') || clima.icone.includes('bolt') || clima.icone.includes('cloud-showers');
                    const corClima = isRain ? '#CFD8DC' : '#FFF9C4';
                    
                    el.innerHTML = `
                        <div class="detalhe-clima" style="background:${corClima}; padding:8px 12px; border:2px solid #000; border-radius:8px; display:flex; align-items:center; gap:10px;">
                            <i class="fas ${clima.icone}" style="font-size:1.5rem;"></i>
                            <span>Previsão: <strong>${clima.tempMax}°C</strong> (${clima.resumo || 'N/A'})</span>
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
        return `<span class="status-live-pill" style="background:#FF2A00; color:#FFF; padding:4px 8px; font-weight:bold; border-radius:4px; border:1px solid #000;">AO VIVO 🔥</span>`;
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
        if (data.score > 3) {
            displayEl.style.backgroundColor = '#FFCCBC'; // Quente
            displayEl.style.border = '2px solid #E64A19';
        } else if (data.score < -1) {
            displayEl.style.backgroundColor = '#E0E0E0'; // Morto
        } else {
            displayEl.style.backgroundColor = '#FFF'; // Neutro
        }

        badgesEl.innerHTML = '';
        if (data.temPolicia) {
            badgesEl.innerHTML += `<span class="badge-policia">👮 Policiamento</span>`;
        }
        if (data.total > 0) {
            badgesEl.innerHTML += `<span class="badge-count" style="font-size:0.8rem; margin-left:8px; color:#666;">(${data.total} votos)</span>`;
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

// --- NAVEGAÇÃO E UTILS ---
export function mudarVisualizacao(viewId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active-view');
        section.classList.add('view-hidden');
    });

    const appHeader = document.querySelector('.app-header');
    const bottomNav = document.querySelector('.bottom-nav');
    const mainContent = document.getElementById('main-content');
    const searchContainer = document.querySelector('.search-container');
    const filterToggle = document.getElementById('filter-toggle');
    const filtersPanel = document.getElementById('filters-panel');

    if (viewId === 'view-detalhes') {
        appHeader.style.display = 'none';
        bottomNav.style.display = 'none';
        mainContent.style.paddingTop = '0';
    } else {
        appHeader.style.display = 'flex';
        bottomNav.style.display = 'flex';
        mainContent.style.paddingTop = ''; 
        
        if (viewId === 'view-explorar') {
            if (searchContainer) searchContainer.style.display = 'block'; 
            if (filterToggle) filterToggle.style.display = 'block';
        } else {
            if (searchContainer) searchContainer.style.display = 'none';
            if (filterToggle) filterToggle.style.display = 'none';
            if (filtersPanel) filtersPanel.style.display = 'none'; 
        }
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
        return `<div class="status-live" style="background:#00E676; color:black; border:2px solid black; padding:4px 8px; font-weight:800; display:inline-block; margin-bottom:8px;">TÁ ROLANDO!</div>`;
    } else {
        const diaMes = data.includes('-') ? data.split('-').reverse().slice(0, 2).join('/') : data.substring(0, 5);
        return `<div class="card-info" style="color:#666; font-size:0.9rem;"><i class="far fa-clock"></i> <span style="font-weight:700; color: #1A1A1A;">${diaMes} às ${hora}</span></div>`;
    }
}

// --- TIMELINE E OUTROS ---
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
    
    // Config Turno
    const horario = bloco.time || bloco['Horário'];
    const turno = getTurnoConfig(horario);

    article.className = 'bloco-card';
    article.onclick = (e) => {
        if (e.target.closest('.fav-btn')) return;
        mostrarDetalhes(bloco); 
    };

    const nome = bloco.name || bloco['Nome do Bloco'];
    const bairro = bloco.neighborhood || bloco['bairro'] || "BH";

    article.innerHTML = `
        <div class="card-header" style="padding: 12px; background-color: ${turno.bg}; border-bottom:2px solid #000;">
            <div class="card-emoji-badge" style="font-size: 1.2rem; margin-right:6px; background:#FFF; border:2px solid #000; color:#000;">
                <i class="fas ${turno.icon}"></i>
            </div>
            <h3 style="font-size: 1.1rem; color:#1A1A1A; font-weight:800;">${nome}</h3>
            <button class="fav-btn favorited" data-id="${bloco.id}" style="color:#FF2A00; border:none; background:none;">
                <i class="fas fa-heart"></i>
            </button>
        </div>
        <div class="card-body" style="padding: 12px;">
            <div class="card-info" style="margin-top:0;">
                <i class="far fa-clock"></i>
                <span style="font-weight:800; color: #1A1A1A;">${horario}</span>
                <span style="margin: 0 8px; color:#1A1A1A;">|</span>
                <i class="fas fa-map-marker-alt"></i>
                <span style="color: #1A1A1A;">${bairro}</span>
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
            <i class="fas fa-bell"></i> Testar Alertas
        </h3>
        <p>MODO DEMO: Simulação.</p>
    `;

    btn.onclick = async () => {
        const { NotificationManager } = await import('./notifications.js');
        const permitido = await NotificationManager.solicitarPermissao();
        
        if (permitido) {
            btn.style.borderColor = 'var(--color-success)';
            btn.style.cursor = 'default';
            btn.onclick = null;
            btn.innerHTML = `
                <h3 style="color: var(--color-success);"><i class="fas fa-check-circle"></i> Alertas Ativados</h3>
                <button id="btn-simular-agora" style="margin-top:12px; width:100%; padding:12px; font-weight:bold; border:2px solid black; background:var(--color-primary); color:white; cursor:pointer; box-shadow:4px 4px 0px black;">
                    Disparar Alerta
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