/* ==========================================================================
   js/map.js
   Lógica Geoespacial (Leaflet.js)
   Estilo: Neo-Brutalismo + Camadas de Utilidade (Sobrevivência)
   ========================================================================== */

let map = null;
let markersLayer = null; // Camada dos Blocos
let userMarker = null;

// Camadas de Utilidade
let metroLayer = null;
let wcLayer = null;
let socorroLayer = null;

// Cores "Minas Neon"
const STYLE_COLORS = {
    'axé': '#FF2A00',      // Vermelho Inconfidência
    'samba': '#00C853',    // Verde
    'rock': '#1A1A1A',     // Preto
    'funk': '#6600FF',     // Roxo
    'default': '#FF2A00'
};

// DADOS DE SOBREVIVÊNCIA (MOCK) - Em produção, pode vir de um JSON separado
const DADOS_UTILIDADE = [
    // Metrô (Funcionamento estendido)
    { type: 'metro', name: 'Estação Central', lat: -19.916133, lng: -43.932652, info: 'Aberto até 01:00' },
    { type: 'metro', name: 'Estação Santa Efigênia', lat: -19.919556, lng: -43.922250, info: 'Acesso Boulevard' },
    { type: 'metro', name: 'Estação Lagoinha', lat: -19.912000, lng: -43.945000, info: 'Integração Move' },
    { type: 'metro', name: 'Estação Savassi (Futura)', lat: -19.933, lng: -43.937, info: 'Em obras' }, // Exemplo

    // Banheiros Químicos (Pontos Estratégicos)
    { type: 'wc', name: 'Banheiros - Praça da Estação', lat: -19.9155, lng: -43.9335, info: 'Bateria com 50 unidades' },
    { type: 'wc', name: 'Banheiros - Praça da Liberdade', lat: -19.932051, lng: -43.938046, info: 'Próximo ao CCBB' },
    { type: 'wc', name: 'Banheiros - Sapucaí', lat: -19.918, lng: -43.928, info: 'Mirante' },

    // Postos Médicos / Hidratação
    { type: 'socorro', name: 'Posto Médico Avançado', lat: -19.917, lng: -43.935, info: 'Atendimento 24h' }
];

// Ícones Personalizados com FontAwesome e CSS Inline
const criarIconeUtilidade = (tipo) => {
    let iconClass = '';
    let color = '';
    let bgColor = '#FFFFFF';
    
    switch(tipo) {
        case 'metro': 
            iconClass = 'fas fa-subway'; 
            color = '#6600FF'; // Roxo Noite
            break;
        case 'wc': 
            iconClass = 'fas fa-restroom'; 
            color = '#00C853'; // Verde Sucesso
            break;
        case 'socorro':
            iconClass = 'fas fa-briefcase-medical';
            color = '#FF2A00'; // Vermelho
            break;
    }
    
    // Cria um marcador redondo com borda grossa (Estilo da marca)
    return L.divIcon({
        className: 'custom-util-icon',
        html: `<div style="
            background:${bgColor}; 
            width:34px; height:34px; 
            border-radius:50%; 
            display:flex; align-items:center; justify-content:center; 
            border:2px solid #1A1A1A; 
            box-shadow: 3px 3px 0px rgba(0,0,0,0.3);">
             <i class="${iconClass}" style="color:${color}; font-size:18px;"></i>
           </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17], // Centraliza
        popupAnchor: [0, -18]
    });
};

export function initMap(blocos) {
    const container = document.getElementById('mapa-container');
    if (!container) return;

    map = L.map('mapa-container', { zoomControl: false }).setView([-19.916681, -43.934493], 14);

    // Zoom no topo direito
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Mapa Base (Estilo "Papel/Asfalto")
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);
    tiles.getContainer().style.filter = 'grayscale(100%) contrast(1.1)';

    // 1. Instancia as Camadas
    markersLayer = L.layerGroup().addTo(map); // Blocos (Ligado por padrão)
    metroLayer = L.layerGroup();              // Metrô (Desligado por padrão, ou ligue se quiser)
    wcLayer = L.layerGroup().addTo(map);      // Banheiros (Ligado por padrão - é essencial!)
    socorroLayer = L.layerGroup();

    // 2. Popula as Camadas de Utilidade
    DADOS_UTILIDADE.forEach(item => {
        const marker = L.marker([item.lat, item.lng], {
            icon: criarIconeUtilidade(item.type)
        }).bindPopup(`
            <div class="map-popup">
                <h3 style="color:#1A1A1A">${item.name}</h3>
                <p>${item.info}</p>
            </div>
        `);

        if (item.type === 'metro') metroLayer.addLayer(marker);
        else if (item.type === 'wc') wcLayer.addLayer(marker);
        else if (item.type === 'socorro') socorroLayer.addLayer(marker);
    });

    // 3. Adiciona o Controle de Camadas (Layer Control)
    const overlayMaps = {
        "<i class='fas fa-music'></i> Blocos": markersLayer,
        "<i class='fas fa-restroom'></i> Banheiros": wcLayer,
        "<i class='fas fa-subway'></i> Metrô": metroLayer,
        "<i class='fas fa-medkit'></i> Socorro": socorroLayer
    };

    // Adiciona o controle no canto inferior esquerdo (para não brigar com o botão "Perto de Mim")
    L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);

    setupGeoButton();
    atualizarMarcadores(blocos);
}

export function atualizarMarcadores(blocosFiltrados) {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    blocosFiltrados.forEach(bloco => {
        const temPonto = bloco.lat && bloco.lng;
        const temRota = bloco.route && Array.isArray(bloco.route) && bloco.route.length > 0;

        if (temRota || temPonto) {
            const estiloPrincipal = (bloco.musical_style && bloco.musical_style[0]) 
                ? bloco.musical_style[0].toLowerCase() 
                : 'default';
            const corNeon = STYLE_COLORS[estiloPrincipal] || STYLE_COLORS['default'];

            const popupContent = `
                <div class="map-popup">
                    <h3>${bloco.name}</h3>
                    <p><strong>${bloco.time || ''}</strong> • ${bloco.neighborhood || ''}</p>
                    <button class="btn-small" onclick="window.location.href='#roteiro'" style="margin-top:8px; width:100%;">
                        + Detalhes
                    </button>
                </div>
            `;

            const markerOptions = {
                radius: 8,
                fillColor: corNeon,
                color: '#1A1A1A',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            };

            if (temRota) {
                L.polyline(bloco.route, { color: corNeon, weight: 5 }).bindPopup(popupContent).addTo(markersLayer);
                L.circleMarker(bloco.route[0], markerOptions).bindPopup(popupContent).addTo(markersLayer);
            } else if (temPonto) {
                L.circleMarker([bloco.lat, bloco.lng], markerOptions).bindPopup(popupContent).addTo(markersLayer);
            }
        }
    });
}

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

                userMarker = L.circleMarker(userPos, {
                    radius: 12, // Um pouco maior
                    fillColor: "#CCFF00", // Amarelo CTA
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