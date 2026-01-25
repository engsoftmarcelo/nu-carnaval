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
// Mapeamento das datas principais para cores distintas (Neo-Brutalism Palette)
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

// --- DADOS DE SOBREVIVÊNCIA (Pontos Fixos & Operação Especial 2026) ---
const DADOS_UTILIDADE = [
    // --- LINHA 1: METRÔ BH (Dados Operacionais do Relatório) ---
    // Vetor Oeste
    { type: 'metro', name: 'Estação Eldorado', lat: -19.9329, lng: -44.0277, info: '🚨 Abre 05h Sábado (01/03)! Terminal Oeste.' },
    { type: 'metro', name: 'Estação Cidade Industrial', lat: -19.9365, lng: -44.0173, info: 'Acesso Barreiro/Industrial. Rápido e Seguro.' },
    { type: 'metro', name: 'Estação Vila Oeste', lat: -19.9312, lng: -43.9984, info: 'Funcionamento 05h15 às 23h. Intervalo 10 min.' },
    { type: 'metro', name: 'Estação Gameleira', lat: -19.9275, lng: -43.9881, info: 'Acesso Expominas. Trens a cada 10 min.' },
    { type: 'metro', name: 'Estação Calafate', lat: -19.9238, lng: -43.9749, info: 'Acesso Blocos Zona Oeste. Proibido Vidro.' },
    
    // Vetor Central (Crítico)
    { type: 'metro', name: 'Estação Carlos Prates', lat: -19.9168, lng: -43.9576, info: 'Acesso Barro Preto / Fórum. Aberto até 23h.' },
    { type: 'metro', name: 'Estação Lagoinha', lat: -19.9126, lng: -43.9431, info: '💡 Dica: Evite a Central. Desça aqui para o "Então Brilha".' },
    { type: 'metro', name: 'Estação Central', lat: -19.9157, lng: -43.9353, info: '⚠️ Entrada APENAS r. Aarão Reis. Túnel Sapucaí Fechado.' },
    
    // Vetor Leste/Hospitalar
    { type: 'metro', name: 'Estação Santa Efigênia', lat: -19.9189, lng: -43.9231, info: 'Acesso Área Hospitalar e UPA Centro-Sul.' },
    { type: 'metro', name: 'Estação Santa Tereza', lat: -19.9135, lng: -43.9142, info: '🔥 Coração do Carnaval. Acesso Blocos de Rua.' },
    { type: 'metro', name: 'Estação Horto Florestal', lat: -19.8974, lng: -43.9161, info: 'Alternativa tranquila para acesso ao Leste.' },
    { type: 'metro', name: 'Estação Santa Inês', lat: -19.8887, lng: -43.9153, info: 'Acesso rápido à folia de Santa Tereza.' },
    { type: 'metro', name: 'Estação José Cândido', lat: -19.8828, lng: -43.9202, info: 'Melhor descida para Pena de Pavão (Domingo).' },
    
    // Vetor Norte
    { type: 'metro', name: 'Estação Minas Shopping', lat: -19.8735, lng: -43.9255, info: 'Acesso Shopping e Hotéis. Ponto de apoio.' },
    { type: 'metro', name: 'Estação São Gabriel', lat: -19.8544, lng: -43.9197, info: '🚨 Abre 05h Sábado (01/03)! Conexão Rodoviária.' },
    { type: 'metro', name: 'Estação Primeiro de Maio', lat: -19.8402, lng: -43.9261, info: 'Metrô Ativo. 05h15 às 23h.' },
    { type: 'metro', name: 'Estação Waldomiro Lobo', lat: -19.8331, lng: -43.9333, info: 'Acesso Norte. Aceita pagamento por aproximação.' },
    { type: 'metro', name: 'Estação Floramar', lat: -19.8228, lng: -43.9435, info: 'Estação tranquila. Evite multidões.' },
    { type: 'metro', name: 'Estação Vilarinho', lat: -19.8145, lng: -43.9515, info: '🚨 Abre 05h Sábado (01/03)! Terminal Venda Nova.' },

    // --- INFRAESTRUTURA DE SAÚDE E SANEAMENTO (Relatório 2026) ---
    { type: 'socorro', name: 'PMA Central (CRJ)', lat: -19.9155, lng: -43.9355, info: '🏥 Urgência 24h. Praça da Estação (Ao lado do Metrô).' },
    { type: 'wc', name: 'Banheiros Fixos - Centro', lat: -19.9155, lng: -43.9335, info: 'Bolsão Praça da Estação. Manutenção constante.' },
    { type: 'wc', name: 'Banheiros Fixos - Savassi', lat: -19.932051, lng: -43.938046, info: 'Zona de Pontos Fixos (Quarteirões Fechados).' },
    { type: 'wc', name: 'Banheiros - Sapucaí', lat: -19.918, lng: -43.928, info: 'Mirante. Bateria de Químicos Volantes.' }
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

    // Inicializa o mapa centralizado em BH (Praça Sete aprox)
    map = L.map('mapa-container', { zoomControl: false }).setView([-19.916681, -43.934493], 13);
    
    // Move o zoom para o topo direito
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles (CartoDB Voyager - Estilo limpo para destacar os blocos)
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);
    
    // Aplica filtro CSS para deixar o mapa base em tons de cinza
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

    // Controle de Camadas (Layers Control)
    const overlayMaps = {
        "<i class='fas fa-music'></i> Blocos": markersLayer,
        "<i class='fas fa-restroom'></i> Banheiros": wcLayer,
        "<i class='fas fa-subway'></i> Metrô": metroLayer,
        "<i class='fas fa-medkit'></i> Saúde (PMA)": socorroLayer
    };

    L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);

    // Adiciona a Legenda e Botão GPS
    addLegend(map);
    setupGeoButton();
    
    // Renderiza os marcadores iniciais dos blocos
    atualizarMarcadores(blocos);
}

// Função para criar a legenda visual no canto inferior direito
function addLegend(map) {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        let html = '<h4 style="margin:0 0 8px 0; font-size:0.9rem; text-transform:uppercase;">Datas</h4>';

        // Percorre as datas definidas em DATE_COLORS
        for (const [date, color] of Object.entries(DATE_COLORS)) {
            if (date === 'default') continue; 
            
            html += `
                <div class="legend-item">
                    <span class="legend-color" style="background:${color}"></span>
                    <span>${formatarDataLegenda(date)}</span>
                </div>
            `;
        }
        
        // Item para "Outros"
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

// --- FUNÇÃO DE ATUALIZAÇÃO DOS MARCADORES DE BLOCOS ---
export function atualizarMarcadores(blocosFiltrados) {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    blocosFiltrados.forEach(bloco => {
        const temPonto = bloco.lat && bloco.lng;
        
        if (temPonto) {
            // Define a cor baseada na data
            const corNeon = DATE_COLORS[bloco.date] || DATE_COLORS['default'];

            // Conteúdo do Popup
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

            // Estilo do Marcador (Bolinha Colorida)
            const markerOptions = {
                radius: 8,
                fillColor: corNeon,
                color: '#1A1A1A',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            };

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

                // Marcador do usuário (Verde Neon Chamativo)
                userMarker = L.circleMarker(userPos, {
                    radius: 12,
                    fillColor: "#CCFF00",
                    color: "#1A1A1A",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);

                userMarker.bindPopup("<b>Você</b><br>No meio da folia").openPopup();
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
   MAPA DE DETALHES (TRAJETO NO MODAL)
   Renderiza o mini-mapa dentro da tela de detalhes do bloco
   ========================================================================== */
export function renderDetalheMap(bloco) {
    const containerId = 'detalhe-mapa-interno';
    const container = document.getElementById(containerId);

    if (!container) return;

    // 1. Limpa mapa anterior se existir
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
    const center = temConcentracao ? [bloco.lat, bloco.lng] : [bloco.latDisp, bloco.lngDisp];
    
    miniMap = L.map(containerId, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false
    }).setView(center, 15);

    // Tiles
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
            iconAnchor: [10, 10],
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

    // 6. Desenha Linha do Trajeto
    if (temConcentracao && temDispersao) {
        L.polyline([[bloco.lat, bloco.lng], [bloco.latDisp, bloco.lngDisp]], {
            color: '#1A1A1A',
            weight: 4,
            dashArray: '10, 10',
            opacity: 0.8
        }).addTo(miniMap);
    }

    // 7. Ajusta Zoom
    if (temConcentracao || temDispersao) {
        if (temConcentracao && temDispersao) {
            miniMap.fitBounds(bounds, { padding: [40, 40] });
        } else {
            miniMap.setView(center, 15);
        }
    }
}

// --- NOVA FUNÇÃO: Ativar camadas específicas via clique externo ---
export function focarCategoriaNoMapa(categoria) {
    if (!map) return;

    // Remove camadas extras para limpar a visão
    if (map.hasLayer(wcLayer)) map.removeLayer(wcLayer);
    
    // Lógica para Metrô
    if (categoria === 'metro' && metroLayer) {
        if (!map.hasLayer(metroLayer)) {
            map.addLayer(metroLayer);
        }
        // Tenta dar zoom para mostrar os pontos
        const group = L.featureGroup(metroLayer.getLayers());
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }
    
    // Lógica para Saúde/Socorro
    if (categoria === 'socorro' && socorroLayer) {
        if (!map.hasLayer(socorroLayer)) {
            map.addLayer(socorroLayer);
        }
        const group = L.featureGroup(socorroLayer.getLayers());
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }
}