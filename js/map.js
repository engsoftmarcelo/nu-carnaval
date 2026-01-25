/* ==========================================================================
   js/map.js
   Lógica Geoespacial (Leaflet.js)
   Estilo: Cores por Dia + Legenda + Popups Interativos
   ========================================================================== */

let map = null;
let markersLayer = null; 
let userMarker = null;

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

// --- FUNÇÃO DE INICIALIZAÇÃO ---
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
        const temRota = bloco.route && Array.isArray(bloco.route) && bloco.route.length > 0;

        if (temRota || temPonto) {
            // --- 3. LÓGICA DE COR POR DATA ---
            const corNeon = DATE_COLORS[bloco.date] || DATE_COLORS['default'];

            // Conteúdo do Popup
            // NOTA: O botão agora chama 'window.abrirDetalhesDoMapa' definido no app.js
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

            // Desenha Rota ou Ponto
            if (temRota) {
                // Se tiver rota, desenha a linha grossa e a bolinha no início
                L.polyline(bloco.route, { color: corNeon, weight: 5 }).bindPopup(popupContent).addTo(markersLayer);
                L.circleMarker(bloco.route[0], markerOptions).bindPopup(popupContent).addTo(markersLayer);
            } else if (temPonto) {
                // Se só tiver ponto, desenha a bolinha
                L.circleMarker([bloco.lat, bloco.lng], markerOptions).bindPopup(popupContent).addTo(markersLayer);
            }
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