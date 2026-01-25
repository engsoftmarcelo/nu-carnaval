/* ==========================================================================
   js/map.js
   Lógica Geoespacial (Leaflet.js)
   Estilo: Cores por Dia + Legenda + Popups Interativos + Mapa de Trajeto
   ========================================================================== */

let map = null;
let markersLayer = null; 
let userMarker = null;

// Variável para controlar a instância do mapa de detalhes (evita erros de re-inicialização)
let miniMap = null;

// Camadas de Utilidade
let metroLayer = null;
let wcLayer = null;
let socorroLayer = null;

// --- 1. CONFIGURAÇÃO DE CORES POR DATA ---
// Mapeie as datas principais do seu JSON para cores distintas (Neo-Brutalism Palette)
const DATE_COLORS = {
    '2026-01-31': '#FF2A00', // Sábado (Vermelho Neon)
    '2026-02-01': '#FFD700', // Domingo (Amarelo)
    '2026-02-06': '#00C853', // Sexta Pré (Verde)
    '2026-02-07': '#6600FF', // Sábado Carnaval (Roxo)
    '2026-02-08': '#FF0090', // Domingo Carnaval (Rosa)
    '2026-02-09': '#00BFFF', // Segunda (Azul)
    '2026-02-10': '#FF8C00', // Terça (Laranja)
    '2026-02-11': '#808080', // Quarta (Cinza)
    '2026-02-12': '#A52A2A', // Quinta (Marrom)
    '2026-02-13': '#4B0082', // Sexta (Índigo)
    'default': '#1A1A1A'     // Outras datas (Preto)
};

// Formatação bonita para a legenda (YYYY-MM-DD -> DD/MM)
function formatarDataLegenda(isoDate) {
    if (!isoDate) return 'Outros';
    const partes = isoDate.split('-');
    // Retorna Dia/Mês (ex: 31/01)
    return `${partes[2]}/${partes[1]}`;
}

// --- DADOS DE SOBREVIVÊNCIA (Pontos Fixos) ---
const DADOS_UTILIDADE = [
    { type: 'metro', name: 'Estação Central', lat: -19.916133, lng: -43.932652, info: 'Aberto até 01:00' },
    { type: 'metro', name: 'Estação Santa Efigênia', lat: -19.919556, lng: -43.922250, info: 'Acesso Boulevard' },
    { type: 'metro', name: 'Estação Lagoinha', lat: -19.912000, lng: -43.945000, info: 'Integração Move' },
    { type: 'wc', name: 'Banheiros - Praça da Estação', lat: -19.9155, lng: -43.9335, info: 'Bateria com 50 unidades' },
    { type: 'wc', name: 'Banheiros - Praça da Liberdade', lat: -19.932051, lng: -43.938046, info: 'Próximo ao CCBB' },
    { type: 'wc', name: 'Banheiros - Sapucaí', lat: -19.918, lng: -43.928, info: 'Mirante' },
    { type: 'socorro', name: 'Posto Médico Avançado', lat: -19.917, lng: -43.935, info: 'Atendimento 24h' }
];

const criarIconeUtilidade = (tipo) => {
    let iconClass = '';
    let color = '';
    let bgColor = '#FFFFFF';
    
    switch(tipo) {
        case 'metro': iconClass = 'fas fa-subway'; color = '#6600FF'; break;
        case 'wc': iconClass = 'fas fa-restroom'; color = '#00C853'; break;
        case 'socorro': iconClass = 'fas fa-briefcase-medical'; color = '#FF2A00'; break;
    }
    
    return L.divIcon({
        className: 'custom-util-icon',
        html: `<div style="background:${bgColor}; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #1A1A1A; box-shadow: 3px 3px 0px rgba(0,0,0,0.3);">
             <i class="${iconClass}" style="color:${color}; font-size:18px;"></i>
           </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
    });
};

// --- FUNÇÃO DE INICIALIZAÇÃO DO MAPA PRINCIPAL ---
export function initMap(blocos) {
    const container = document.getElementById('mapa-container');
    if (!container) return;

    // Inicializa o mapa centralizado em BH
    map = L.map('mapa-container', { zoomControl: false }).setView([-19.916681, -43.934493], 13);
    
    // Move o zoom para o topo direito
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles (CartoDB Voyager - Estilo limpo)
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);
    
    // Aplica filtro CSS para deixar o mapa em tons de cinza (destaca os marcadores coloridos)
    tiles.getContainer().style.filter = 'grayscale(100%) contrast(1.1)';

    // Inicializa Camadas
    markersLayer = L.layerGroup().addTo(map);
    metroLayer = L.layerGroup();
    wcLayer = L.layerGroup().addTo(map); // Banheiros visíveis por padrão
    socorroLayer = L.layerGroup();

    // Adiciona utilitários ao mapa
    DADOS_UTILIDADE.forEach(item => {
        const marker = L.marker([item.lat, item.lng], { icon: criarIconeUtilidade(item.type) })
            .bindPopup(`<div class="map-popup"><h3 style="color:#1A1A1A">${item.name}</h3><p>${item.info}</p></div>`);
        
        if (item.type === 'metro') metroLayer.addLayer(marker);
        else if (item.type === 'wc') wcLayer.addLayer(marker);
        else if (item.type === 'socorro') socorroLayer.addLayer(marker);
    });

    // Controle de Camadas
    const overlayMaps = {
        "<i class='fas fa-music'></i> Blocos": markersLayer,
        "<i class='fas fa-restroom'></i> Banheiros": wcLayer,
        "<i class='fas fa-subway'></i> Metrô": metroLayer,
        "<i class='fas fa-medkit'></i> Socorro": socorroLayer
    };

    L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);

    // --- 2. ADICIONA A LEGENDA NO MAPA ---
    addLegend(map);

    // Configura botão de "Perto de Mim"
    setupGeoButton();
    
    // Renderiza os marcadores iniciais
    atualizarMarcadores(blocos);
}

// Função para criar a legenda visual no canto inferior direito
function addLegend(map) {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        let html = '<h4 style="margin:0 0 8px 0; font-size:0.9rem; text-transform:uppercase;">Datas</h4>';

        // Percorre as datas definidas em DATE_COLORS para criar a lista
        for (const [date, color] of Object.entries(DATE_COLORS)) {
            if (date === 'default') continue; 
            
            html += `
                <div class="legend-item">
                    <span class="legend-color" style="background:${color}"></span>
                    <span>${formatarDataLegenda(date)}</span>
                </div>
            `;
        }
        
        // Adiciona item para "Outros"
        html += `
            <div class="legend-item">
                <span class="legend-color" style="background:${DATE_COLORS['default']}"></span>
                <span>Outros</span>
            </div>
        `;

        div.innerHTML = html;
        return div;
    };

    legend.addTo(map);
}

// --- FUNÇÃO DE ATUALIZAÇÃO DOS MARCADORES ---
export function atualizarMarcadores(blocosFiltrados) {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    blocosFiltrados.forEach(bloco => {
        const temPonto = bloco.lat && bloco.lng;
        // Verifica se tem rota predefinida OU rota calculada (lat/lng -> latDisp/lngDisp)
        // No seu data.js atual, 'route' não está sendo gerado explicitamente, mas se você tiver, a lógica abaixo funciona.
        // O foco aqui é mostrar o marcador principal.
        
        if (temPonto) {
            // --- 3. LÓGICA DE COR POR DATA ---
            const corNeon = DATE_COLORS[bloco.date] || DATE_COLORS['default'];

            // Conteúdo do Popup
            // NOTA: O botão chama 'window.abrirDetalhesDoMapa' definido no app.js
            const popupContent = `
                <div class="map-popup">
                    <h3>${bloco.name}</h3>
                    <p><strong>${formatarDataLegenda(bloco.date)}</strong> • ${bloco.time}</p>
                    <p>${bloco.neighborhood || ''}</p>
                    <button class="btn-small" onclick="window.abrirDetalhesDoMapa('${bloco.id}')" style="margin-top:8px; width:100%; cursor:pointer;">
                        + Detalhes
                    </button>
                </div>
            `;

            // Estilo do Marcador (Bolinha)
            const markerOptions = {
                radius: 8,
                fillColor: corNeon,
                color: '#1A1A1A',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            };

            // Desenha a bolinha
            L.circleMarker([bloco.lat, bloco.lng], markerOptions).bindPopup(popupContent).addTo(markersLayer);
        }
    });
}

// --- GEOLOCALIZAÇÃO ---
function setupGeoButton() {
    const btnGeo = document.getElementById('btn-geo');
    if(!btnGeo) return;
    
    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Sem GPS disponível.");
            return;
        }
        btnGeo.classList.add('searching');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const userPos = [lat, lng];

                if (userMarker) map.removeLayer(userMarker);

                // Marcador do usuário (Verde Neon bem chamativo)
                userMarker = L.circleMarker(userPos, {
                    radius: 12,
                    fillColor: "#CCFF00",
                    color: "#1A1A1A",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);

                userMarker.bindPopup("<b>Você</b><br>Perdido no meio do povo").openPopup();
                map.setView(userPos, 16);
                btnGeo.classList.remove('searching');
            },
            (erro) => {
                console.error("Erro GPS:", erro);
                alert("Ative o GPS para encontrarmos você.");
                btnGeo.classList.remove('searching');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

/* ==========================================================================
   NOVO: MAPA DE DETALHES (TRAJETO)
   Renderiza o mini-mapa dentro da tela de detalhes do bloco
   ========================================================================== */
export function renderDetalheMap(bloco) {
    const containerId = 'detalhe-mapa-interno';
    const container = document.getElementById(containerId);

    if (!container) return;

    // 1. Limpa mapa anterior se existir (Importante para evitar erro do Leaflet: "Map container is already initialized")
    if (miniMap) {
        miniMap.remove();
        miniMap = null;
    }

    // 2. Verifica coordenadas
    const temConcentracao = bloco.lat && bloco.lng;
    const temDispersao = bloco.latDisp && bloco.lngDisp;

    if (!temConcentracao && !temDispersao) {
        container.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; background:#eee; color:#666; font-weight:bold;">Mapa do trajeto indisponível</div>';
        return;
    }

    // 3. Inicializa Mapa
    // Centraliza na concentração ou dispersão inicialmente
    const center = temConcentracao ? [bloco.lat, bloco.lng] : [bloco.latDisp, bloco.lngDisp];
    
    miniMap = L.map(containerId, {
        zoomControl: false, // Visual limpo
        attributionControl: false, // Oculta atribuição para economizar espaço no card
        dragging: true,
        scrollWheelZoom: false // Evita scroll da página travar no mapa
    }).setView(center, 15);

    // Tiles (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(miniMap);

    const bounds = L.latLngBounds();

    // 4. Marcador de Concentração (Verde)
    if (temConcentracao) {
        const iconStart = L.divIcon({
            className: 'custom-pin',
            html: '<div style="background-color:#00C853; width:16px; height:16px; border-radius:50%; border:3px solid #1A1A1A; box-shadow: 2px 2px 0px rgba(0,0,0,0.2);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10], // Centraliza
            popupAnchor: [0, -10]
        });

        L.marker([bloco.lat, bloco.lng], { icon: iconStart })
            .addTo(miniMap)
            .bindPopup(`<b>Concentração</b><br>${bloco.location}`);
        
        bounds.extend([bloco.lat, bloco.lng]);
    }

    // 5. Marcador de Dispersão (Vermelho)
    if (temDispersao) {
        const iconEnd = L.divIcon({
            className: 'custom-pin',
            html: '<div style="background-color:#FF2A00; width:16px; height:16px; border-radius:50%; border:3px solid #1A1A1A; box-shadow: 2px 2px 0px rgba(0,0,0,0.2);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        L.marker([bloco.latDisp, bloco.lngDisp], { icon: iconEnd })
            .addTo(miniMap)
            .bindPopup(`<b>Dispersão</b><br>${bloco.locationEnd || 'Fim do trajeto'}`);
        
        bounds.extend([bloco.latDisp, bloco.lngDisp]);
    }

    // 6. Desenha Linha do Trajeto (Se tiver os dois pontos)
    if (temConcentracao && temDispersao) {
        L.polyline([[bloco.lat, bloco.lng], [bloco.latDisp, bloco.lngDisp]], {
            color: '#1A1A1A',
            weight: 4,
            dashArray: '10, 10', // Linha tracejada estilosa
            opacity: 0.8
        }).addTo(miniMap);
    }

    // 7. Ajusta Zoom para caber tudo com margem
    if (temConcentracao || temDispersao) {
        // Se for só um ponto, mantém zoom 15, se forem dois, ajusta bounds
        if (temConcentracao && temDispersao) {
            miniMap.fitBounds(bounds, { padding: [40, 40] });
        } else {
            miniMap.setView(center, 15);
        }
    }
}