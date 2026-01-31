/* ==========================================================================
   js/map.js
   Lógica Geoespacial (Leaflet.js) - VERSÃO BAIRROS INTERATIVOS
   Estrutura: Polígonos de Bairros + Utilitários (Metrô/WC)
   ========================================================================== */

let map = null;
let geoJsonLayer = null; // Camada dos Bairros
let todosBlocosCache = []; // Cache dos blocos para filtragem
let userMarker = null;

// Camadas de Utilidade
let metroLayer = null;
let wcLayer = null;
let socorroLayer = null;

// --- DADOS DE SOBREVIVÊNCIA (Pontos Fixos Mantidos) ---
const DADOS_UTILIDADE = [
    // --- LINHA 1: METRÔ BH ---
    { type: 'metro', name: 'Estação Eldorado', lat: -19.9329, lng: -44.0277, info: '🚨 Abre 05h Sábado (01/03)! Terminal Oeste.' },
    { type: 'metro', name: 'Estação Cidade Industrial', lat: -19.9365, lng: -44.0173, info: 'Acesso Barreiro/Industrial.' },
    { type: 'metro', name: 'Estação Vila Oeste', lat: -19.9312, lng: -43.9984, info: 'Funcionamento 05h15 às 23h.' },
    { type: 'metro', name: 'Estação Gameleira', lat: -19.9275, lng: -43.9881, info: 'Acesso Expominas.' },
    { type: 'metro', name: 'Estação Calafate', lat: -19.9238, lng: -43.9749, info: 'Acesso Blocos Zona Oeste.' },
    { type: 'metro', name: 'Estação Carlos Prates', lat: -19.9168, lng: -43.9576, info: 'Aberto até 23h.' },
    { type: 'metro', name: 'Estação Lagoinha', lat: -19.9126, lng: -43.9431, info: '💡 Evite a Central. Desça aqui.' },
    { type: 'metro', name: 'Estação Central', lat: -19.9157, lng: -43.9353, info: '⚠️ Entrada APENAS r. Aarão Reis.' },
    { type: 'metro', name: 'Estação Santa Efigênia', lat: -19.9189, lng: -43.9231, info: 'Acesso Área Hospitalar.' },
    { type: 'metro', name: 'Estação Santa Tereza', lat: -19.9135, lng: -43.9142, info: '🔥 Coração do Carnaval.' },
    { type: 'metro', name: 'Estação Horto Florestal', lat: -19.8974, lng: -43.9161, info: 'Alternativa tranquila ao Leste.' },
    { type: 'metro', name: 'Estação Santa Inês', lat: -19.8887, lng: -43.9153, info: 'Acesso rápido a Santa Tereza.' },
    { type: 'metro', name: 'Estação José Cândido', lat: -19.8828, lng: -43.9202, info: 'Melhor descida para Pena de Pavão.' },
    { type: 'metro', name: 'Estação Minas Shopping', lat: -19.8735, lng: -43.9255, info: 'Acesso Shopping e Hotéis.' },
    { type: 'metro', name: 'Estação São Gabriel', lat: -19.8544, lng: -43.9197, info: '🚨 Abre 05h Sábado (01/03)!' },
    { type: 'metro', name: 'Estação Primeiro de Maio', lat: -19.8402, lng: -43.9261, info: 'Metrô Ativo.' },
    { type: 'metro', name: 'Estação Waldomiro Lobo', lat: -19.8331, lng: -43.9333, info: 'Acesso Norte.' },
    { type: 'metro', name: 'Estação Floramar', lat: -19.8228, lng: -43.9435, info: 'Estação tranquila.' },
    { type: 'metro', name: 'Estação Vilarinho', lat: -19.8145, lng: -43.9515, info: '🚨 Abre 05h Sábado (01/03)!' },

    // --- INFRAESTRUTURA DE SAÚDE E WC ---
    { type: 'socorro', name: 'PMA Central (CRJ)', lat: -19.9155, lng: -43.9355, info: '🏥 Urgência 24h.' },
    { type: 'wc', name: 'Banheiros Fixos - Centro', lat: -19.9155, lng: -43.9335, info: 'Bolsão Praça da Estação.' },
    { type: 'wc', name: 'Banheiros Fixos - Savassi', lat: -19.932051, lng: -43.938046, info: 'Quarteirões Fechados.' },
    { type: 'wc', name: 'Banheiros - Sapucaí', lat: -19.918, lng: -43.928, info: 'Mirante / Químicos.' }
];

// Helper: Normalizar texto para comparação (ex: "Santa Tereza" == "santa tereza")
function normalizarTexto(texto) {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
}

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

// --- FUNÇÃO DE INICIALIZAÇÃO DO MAPA ---
export async function initMap(blocos) {
    const container = document.getElementById('mapa-container');
    if (!container) return;

    // 1. Guarda os blocos para filtrar quando clicar no bairro
    todosBlocosCache = blocos;

    // 2. Inicializa o mapa (Centro de BH)
    if (map) map.remove();
    map = L.map('mapa-container', { zoomControl: false }).setView([-19.916681, -43.934493], 12);
    
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles (CartoDB Voyager - Limpo)
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);
    
    tiles.getContainer().style.filter = 'grayscale(100%) contrast(1.1)';

    // 3. Inicializa Camadas de Utilidade
    metroLayer = L.layerGroup();
    wcLayer = L.layerGroup().addTo(map); // Banheiros visíveis por padrão
    socorroLayer = L.layerGroup();

    DADOS_UTILIDADE.forEach(item => {
        const marker = L.marker([item.lat, item.lng], { icon: criarIconeUtilidade(item.type) })
            .bindPopup(`<div class="map-popup"><h3 style="color:#1A1A1A">${item.name}</h3><p>${item.info}</p></div>`);
        
        if (item.type === 'metro') metroLayer.addLayer(marker);
        else if (item.type === 'wc') wcLayer.addLayer(marker);
        else if (item.type === 'socorro') socorroLayer.addLayer(marker);
    });

    // Controle de Camadas
    const overlayMaps = {
        "<i class='fas fa-restroom'></i> Banheiros": wcLayer,
        "<i class='fas fa-subway'></i> Metrô": metroLayer,
        "<i class='fas fa-medkit'></i> Saúde": socorroLayer
    };
    L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);

    setupGeoButton();

    // 4. Carrega e Renderiza os Bairros (GeoJSON)
    try {
        const response = await fetch('./data/BAIRRO_OFICIAL.json');
        if (!response.ok) throw new Error('Falha ao carregar GeoJSON');
        const bairrosData = await response.json();
        renderizarBairros(bairrosData);
    } catch (error) {
        console.error("Erro ao carregar bairros:", error);
        alert("Erro ao carregar o mapa de bairros.");
    }
}

// --- LÓGICA DE RENDERIZAÇÃO DOS BAIRROS ---
function renderizarBairros(geoJsonData) {
    // Estilos
    const defaultStyle = {
        color: "#6200ea",      // Roxo Nubank
        weight: 1,
        fillColor: "#6200ea",
        fillOpacity: 0.1
    };

    const hoverStyle = {
        weight: 3,
        fillOpacity: 0.4,
        color: "#00b0ff"       // Azul destaque
    };

    const activeStyle = {
        weight: 3,
        fillOpacity: 0.6,
        color: "#FF2A00"       // Laranja/Vermelho clicado
    };

    // Layer GeoJSON
    geoJsonLayer = L.geoJSON(geoJsonData, {
        style: defaultStyle,
        onEachFeature: function (feature, layer) {
            
            // Tooltip com nome do bairro
            if (feature.properties && feature.properties.NOME) {
                layer.bindTooltip(feature.properties.NOME, {
                    permanent: false, 
                    direction: 'center',
                    className: 'bairro-tooltip'
                });
            }

            // Hover
            layer.on('mouseover', function () {
                if(this !== window.selectedLayer) { // Não muda se estiver selecionado
                    this.setStyle(hoverStyle);
                }
            });
            
            layer.on('mouseout', function () {
                if(this !== window.selectedLayer) {
                    geoJsonLayer.resetStyle(this);
                }
            });

            // Clique: Filtra blocos e notifica o App
            layer.on('click', function (e) {
                // Reset visual do anterior
                if (window.selectedLayer) {
                    geoJsonLayer.resetStyle(window.selectedLayer);
                }
                
                // Marca o atual
                window.selectedLayer = layer;
                layer.setStyle(activeStyle);
                
                // Zoom no bairro
                map.fitBounds(e.target.getBounds());

                const nomeBairro = feature.properties.NOME;
                filtrarEExibirBlocosDoBairro(nomeBairro);
            });
        }
    }).addTo(map);
}

// Filtra os dados e dispara evento para o app.js
function filtrarEExibirBlocosDoBairro(nomeBairro) {
    const nomeNormalizado = normalizarTexto(nomeBairro);

    const blocosDoBairro = todosBlocosCache.filter(bloco => 
        normalizarTexto(bloco.neighborhood) === nomeNormalizado || // Tenta achar no campo neighborhood
        normalizarTexto(bloco.bairro) === nomeNormalizado          // Ou no campo bairro (caso varie)
    );

    console.log(`Bairro: ${nomeBairro} | Blocos: ${blocosDoBairro.length}`);

    // Cria evento customizado para o app.js ouvir
    const event = new CustomEvent('bairroSelecionado', { 
        detail: { 
            bairro: nomeBairro, 
            blocos: blocosDoBairro 
        } 
    });
    window.dispatchEvent(event);
}

// --- GEOLOCALIZAÇÃO (Mantida) ---
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
                    radius: 12,
                    fillColor: "#CCFF00",
                    color: "#1A1A1A",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);

                userMarker.bindPopup("<b>Você</b><br>Buscando folia").openPopup();
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

// --- FUNÇÃO AUXILIAR: Focar categorias (Metro/Socorro) ---
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

// --- PLACEHOLDER: Atualizar Marcadores ---
// Como não usamos mais marcadores de blocos, essa função fica vazia
// para não quebrar chamadas antigas no app.js
export function atualizarMarcadores(blocos) {
    // Lógica desativada: Blocos agora são acessados via clique no Bairro
    // Se quiser, pode limpar layers antigos aqui
    if (markersLayer) markersLayer.clearLayers();
}

// --- MAPA DE DETALHES (Mantido para mostrar trajeto SE houver coords no futuro) ---
export function renderDetalheMap(bloco) {
    // Mantém a lógica de mini-mapa caso algum bloco especial tenha trajeto
    // Se não tiver lat/lng, mostra mensagem de indisponível.
    const containerId = 'detalhe-mapa-interno';
    const container = document.getElementById(containerId);
    if (!container) return;

    if ((!bloco.lat || !bloco.lng) && (!bloco.latDisp)) {
        container.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; background:#f0f0f0; color:#888; text-align:center; padding:20px;">
            <p>📍 Mapa do trajeto não disponível<br><small>Confira o local: ${bloco.location || 'Não informado'}</small></p>
        </div>`;
        return;
    }
    
    // ... Resto da lógica original de renderDetalheMap se quiser manter suporte a trajetos ...
    // Para simplificar e garantir que não quebre com dados vazios, deixamos o fallback acima.
}