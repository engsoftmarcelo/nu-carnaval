/* ==========================================================================
   js/map.js
   Lógica Geoespacial (Leaflet.js) - NEO-BRUTALISMO & FILTRAGEM
   ========================================================================== */

let map = null;
let geoJsonLayer = null; // Camada dos Bairros
let todosBlocosCache = []; // Cache dos blocos para filtragem
let userMarker = null;

// Camadas de Utilidade
let metroLayer = null;
let wcLayer = null;
let socorroLayer = null;

// --- CONFIGURAÇÃO DE TURNOS (Para o Pin do Mapa de Detalhes) ---
const SHIFT_MAP_CONFIG = {
    'manha': { color: '#FFD700', icon: 'fas fa-sun', label: 'Manhã' },  // Amarelo
    'tarde': { color: '#FF5722', icon: 'fas fa-fire', label: 'Tarde' }, // Laranja
    'noite': { color: '#673AB7', icon: 'fas fa-moon', label: 'Noite' }  // Roxo
};

function getShiftConfig(horario) {
    if (!horario) return SHIFT_MAP_CONFIG.tarde;
    const hora = parseInt(horario.split(':')[0]);
    
    if (hora >= 5 && hora < 12) return SHIFT_MAP_CONFIG.manha;
    if (hora >= 12 && hora < 18) return SHIFT_MAP_CONFIG.tarde;
    return SHIFT_MAP_CONFIG.noite;
}

// --- DADOS DE SOBREVIVÊNCIA (Pontos Fixos) ---
const DADOS_UTILIDADE = [
    // Metrô
    { type: 'metro', name: 'Estação Eldorado', lat: -19.9329, lng: -44.0277, info: '🚨 Abre 05h Sábado! Terminal Oeste.' },
    { type: 'metro', name: 'Estação Cidade Industrial', lat: -19.9365, lng: -44.0173, info: 'Acesso Barreiro.' },
    { type: 'metro', name: 'Estação Gameleira', lat: -19.9275, lng: -43.9881, info: 'Acesso Expominas.' },
    { type: 'metro', name: 'Estação Calafate', lat: -19.9238, lng: -43.9749, info: 'Acesso Zona Oeste.' },
    { type: 'metro', name: 'Estação Lagoinha', lat: -19.9126, lng: -43.9431, info: '💡 Evite a Central. Desça aqui.' },
    { type: 'metro', name: 'Estação Central', lat: -19.9157, lng: -43.9353, info: '⚠️ Acesso R. Aarão Reis.' },
    { type: 'metro', name: 'Estação Santa Tereza', lat: -19.9135, lng: -43.9142, info: '🔥 Coração do Carnaval.' },
    { type: 'metro', name: 'Estação Santa Efigênia', lat: -19.9189, lng: -43.9231, info: 'Área Hospitalar.' },
    { type: 'metro', name: 'Estação Minas Shopping', lat: -19.8735, lng: -43.9255, info: 'Shopping e Hotéis.' },
    { type: 'metro', name: 'Estação Vilarinho', lat: -19.8145, lng: -43.9515, info: '🚨 Abre 05h Sábado!' },

    // Saúde e WC
    { type: 'socorro', name: 'PMA Central (CRJ)', lat: -19.9155, lng: -43.9355, info: '🏥 Urgência 24h.' },
    { type: 'wc', name: 'Banheiros Praça da Estação', lat: -19.9155, lng: -43.9335, info: 'Bolsão de Banheiros.' },
    { type: 'wc', name: 'Banheiros Savassi', lat: -19.932051, lng: -43.938046, info: 'Quarteirões Fechados.' },
    { type: 'wc', name: 'Banheiros Sapucaí', lat: -19.918, lng: -43.928, info: 'Mirante / Químicos.' }
];

// Helper: Normalizar texto
function normalizarTexto(texto) {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
}

// --- ÍCONES NEO-BRUTALISTAS (Quadrados, Borda Grossa, Sombra) ---
const criarIconeUtilidade = (tipo) => {
    let iconClass = '';
    let color = '';
    let bg = '#FFF';
    
    switch(tipo) {
        case 'metro': iconClass = 'fas fa-subway'; color = '#FFFFFF'; bg = '#6600FF'; break; // Roxo Metrô
        case 'wc': iconClass = 'fas fa-restroom'; color = '#1A1A1A'; bg = '#00C853'; break; // Verde
        case 'socorro': iconClass = 'fas fa-briefcase-medical'; color = '#FFFFFF'; bg = '#FF2A00'; break; // Vermelho
    }
    
    // HTML do ícone quadrado com sombra dura
    const html = `
        <div style="
            background: ${bg};
            width: 32px;
            height: 32px;
            border: 2px solid #000;
            box-shadow: 4px 4px 0px #000;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: transform 0.1s;
        ">
            <i class="${iconClass}" style="color:${color}; font-size:16px;"></i>
        </div>
    `;

    return L.divIcon({
        className: 'custom-util-icon',
        html: html,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -20]
    });
};

// --- FUNÇÃO DE INICIALIZAÇÃO DO MAPA ---
export async function initMap(blocos) {
    const container = document.getElementById('mapa-container');
    if (!container) return;

    todosBlocosCache = blocos;

    if (map) map.remove();
    map = L.map('mapa-container', { zoomControl: false }).setView([-19.916681, -43.934493], 12);
    
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles (CartoDB Voyager - Limpo e com Contraste)
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19
    }).addTo(map);
    
    // Filtro CSS no mapa para ficar mais "clean/cinza"
    tiles.getContainer().style.filter = 'grayscale(100%) contrast(1.1)';

    // Inicializa Camadas
    metroLayer = L.layerGroup();
    wcLayer = L.layerGroup().addTo(map);
    socorroLayer = L.layerGroup();

    DADOS_UTILIDADE.forEach(item => {
        const marker = L.marker([item.lat, item.lng], { icon: criarIconeUtilidade(item.type) })
            .bindPopup(`
                <div class="map-popup" style="font-family:'Manrope',sans-serif; text-align:center;">
                    <h3 style="color:#000; margin-bottom:4px; font-family:'Anton',sans-serif; text-transform:uppercase;">${item.name}</h3>
                    <p style="font-size:0.9rem;">${item.info}</p>
                </div>
            `);
        
        if (item.type === 'metro') metroLayer.addLayer(marker);
        else if (item.type === 'wc') wcLayer.addLayer(marker);
        else if (item.type === 'socorro') socorroLayer.addLayer(marker);
    });

    const overlayMaps = {
        "<i class='fas fa-restroom'></i> Banheiros": wcLayer,
        "<i class='fas fa-subway'></i> Metrô": metroLayer,
        "<i class='fas fa-medkit'></i> Saúde": socorroLayer
    };
    L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);

    setupGeoButton();

    // Carrega GeoJSON
    try {
        const response = await fetch('./data/BAIRRO_OFICIAL.json');
        if (!response.ok) throw new Error('Falha ao carregar GeoJSON');
        const bairrosData = await response.json();
        renderizarBairros(bairrosData);
    } catch (error) {
        console.error("Erro ao carregar bairros:", error);
    }
}

// --- RENDERIZAÇÃO DOS BAIRROS (FILTRADOS) ---
function renderizarBairros(geoJsonData) {
    
    // 1. Identifica quais bairros possuem blocos (Lista Única)
    const bairrosComFesta = new Set(
        todosBlocosCache.map(b => normalizarTexto(b.neighborhood || b['bairro']))
    );

    // 2. Filtra o GeoJSON para manter APENAS esses bairros
    const featuresFiltradas = geoJsonData.features.filter(feature => {
        if (!feature.properties || !feature.properties.NOME) return false;
        const nomeBairroMapa = normalizarTexto(feature.properties.NOME);
        return bairrosComFesta.has(nomeBairroMapa);
    });

    const dadosFiltrados = {
        type: "FeatureCollection",
        features: featuresFiltradas
    };

    // 3. Estilos Clean & Brutalist
    const defaultStyle = {
        color: "#1A1A1A",     // Borda preta forte (Estilo Cartoon)
        weight: 2,
        fillColor: "#FFFFFF", // Fundo branco para destacar no mapa cinza
        fillOpacity: 0.5
    };

    const hoverStyle = {
        weight: 4,
        color: "#000",
        fillColor: "#CCFF00", // Verde Neon no Hover
        fillOpacity: 0.8
    };

    const activeStyle = {
        weight: 5,
        color: "#000",
        fillColor: "#FF2A00", // Laranja Nu! no Selecionado
        fillOpacity: 1
    };

    geoJsonLayer = L.geoJSON(dadosFiltrados, {
        style: defaultStyle,
        onEachFeature: function (feature, layer) {
            
            // Tooltip com nome do bairro
            layer.bindTooltip(feature.properties.NOME, {
                permanent: false, 
                direction: 'center',
                className: 'bairro-tooltip'
            });

            layer.on('mouseover', function () {
                if(this !== window.selectedLayer) {
                    this.setStyle(hoverStyle);
                    this.bringToFront();
                }
            });
            
            layer.on('mouseout', function () {
                if(this !== window.selectedLayer) {
                    geoJsonLayer.resetStyle(this);
                }
            });

            layer.on('click', function (e) {
                if (window.selectedLayer) {
                    geoJsonLayer.resetStyle(window.selectedLayer);
                }
                
                window.selectedLayer = layer;
                layer.setStyle(activeStyle);
                layer.bringToFront();
                
                map.fitBounds(e.target.getBounds());

                const nomeBairro = feature.properties.NOME;
                filtrarEExibirBlocosDoBairro(nomeBairro);
            });
        }
    }).addTo(map);
}

function filtrarEExibirBlocosDoBairro(nomeBairro) {
    const nomeNormalizado = normalizarTexto(nomeBairro);

    const blocosDoBairro = todosBlocosCache.filter(bloco => 
        normalizarTexto(bloco.neighborhood) === nomeNormalizado || 
        normalizarTexto(bloco.bairro) === nomeNormalizado
    );

    const event = new CustomEvent('bairroSelecionado', { 
        detail: { 
            bairro: nomeBairro, 
            blocos: blocosDoBairro 
        } 
    });
    window.dispatchEvent(event);
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

                // Marcador do Usuário
                userMarker = L.circleMarker(userPos, {
                    radius: 10,
                    fillColor: "#CCFF00", // Verde Neon
                    color: "#000",        // Preto
                    weight: 4,            // Borda grossa
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);

                userMarker.bindPopup("<b>Você tá aqui ó!</b>").openPopup();
                map.setView(userPos, 15);
                btnGeo.classList.remove('searching');
            },
            (erro) => {
                console.error("Erro GPS:", erro);
                alert("Ative o GPS.");
                btnGeo.classList.remove('searching');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

export function focarCategoriaNoMapa(categoria) {
    if (!map) return;

    if (categoria === 'metro' && metroLayer) {
        if (!map.hasLayer(metroLayer)) map.addLayer(metroLayer);
        const group = L.featureGroup(metroLayer.getLayers());
        if (group.getLayers().length > 0) map.fitBounds(group.getBounds());
    }
    
    if (categoria === 'socorro' && socorroLayer) {
        if (!map.hasLayer(socorroLayer)) map.addLayer(socorroLayer);
        const group = L.featureGroup(socorroLayer.getLayers());
        if (group.getLayers().length > 0) map.fitBounds(group.getBounds());
    }
    
    if (categoria === 'wc' && wcLayer) {
        if (!map.hasLayer(wcLayer)) map.addLayer(wcLayer);
    }
}

export function atualizarMarcadores(blocos) {
    // Função mantida para compatibilidade, caso expansão futura precise de marcadores individuais
}

// --- MAPA DE DETALHES (PIN PERSONALIZADO POR TURNO) ---
export function renderDetalheMap(bloco) {
    const containerId = 'detalhe-mapa-interno';
    const container = document.getElementById(containerId);
    
    if (!container) return;
    container.innerHTML = ''; 
    container.style.display = 'block';

    if (!bloco.lat || !bloco.lng) {
        container.innerHTML = `
            <div style="height:100%; display:flex; align-items:center; justify-content:center; background:#f0f0f0; border:2px solid #000; color:#000;">
                <p style="font-weight:bold;">📍 Mapa off.<br><small>${bloco.location || ''}</small></p>
            </div>`;
        return;
    }

    const mapDetalhe = L.map(containerId, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        attributionControl: false
    }).setView([bloco.lat, bloco.lng], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(mapDetalhe);

    // --- CRIAÇÃO DO PIN PERSONALIZADO (Por Turno) ---
    // Agora usa a configuração de Turno (Manhã, Tarde, Noite) em vez de Região
    const horario = bloco.time || bloco['Horário'];
    const turnoConfig = getShiftConfig(horario);

    const pinHtml = `
        <div style="
            background-color: ${turnoConfig.color};
            width: 36px;
            height: 36px;
            border: 2px solid #000;
            box-shadow: 4px 4px 0px #000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFF;
            font-size: 16px;
            border-radius: 4px; /* Quadrado */
        ">
            <i class="${turnoConfig.icon}"></i>
        </div>
        <div style="
            width: 0; 
            height: 0; 
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid #000;
            margin: 0 auto;
            position: relative;
            top: -2px;
        "></div>
    `;

    L.marker([bloco.lat, bloco.lng], {
        icon: L.divIcon({
            className: 'custom-region-pin',
            html: pinHtml,
            iconSize: [36, 46],
            iconAnchor: [18, 46]
        })
    }).addTo(mapDetalhe);

    // Botão Expandir (Estilo Brutalista)
    const overlayBtn = document.createElement('div');
    overlayBtn.style.cssText = `
        position: absolute; bottom: 10px; right: 10px; z-index: 1000;
        background: #CCFF00; color: #000; padding: 8px 12px; border: 2px solid black;
        font-weight: 800; font-size: 0.8rem; cursor: pointer; text-transform: uppercase;
        box-shadow: 4px 4px 0px #000; display: flex; align-items: center; gap: 6px;
        transition: transform 0.1s;
    `;
    overlayBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> <span>Abrir Maps</span>';
    overlayBtn.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${bloco.lat},${bloco.lng}`, '_blank');
    
    overlayBtn.onmousedown = () => overlayBtn.style.transform = "translate(2px, 2px)";
    overlayBtn.onmouseup = () => overlayBtn.style.transform = "translate(0, 0)";

    container.appendChild(overlayBtn);
}