/* ==========================================================================
   js/weather.js
   Gerenciador de Clima (Open-Meteo API + LocalStorage Cache)
   ========================================================================== */

const CACHE_PREFIX = 'nu_clima_v1_';
const CACHE_EXPIRATION_MS = 1000 * 60 * 60 * 4; // Cache válido por 4 horas

// Mapeamento: WMO Weather Code -> Classe FontAwesome
// Baseado em: https://open-meteo.com/en/docs
const weatherIcons = {
    0: 'fa-sun',                  // Céu limpo
    1: 'fa-cloud-sun',            // Principalmente limpo
    2: 'fa-cloud-sun',            // Parcialmente nublado
    3: 'fa-cloud',                // Encoberto
    45: 'fa-smog',                // Nevoeiro
    48: 'fa-smog',
    51: 'fa-cloud-rain',          // Chuvisco
    53: 'fa-cloud-rain',
    55: 'fa-cloud-showers-heavy',
    61: 'fa-cloud-rain',          // Chuva fraca
    63: 'fa-cloud-showers-heavy', // Chuva moderada
    65: 'fa-cloud-showers-heavy', // Chuva forte
    80: 'fa-cloud-showers-heavy', // Pancadas de chuva
    81: 'fa-cloud-showers-heavy',
    82: 'fa-cloud-showers-heavy',
    95: 'fa-bolt',                // Trovoada
    96: 'fa-bolt',
    99: 'fa-bolt'
};

/**
 * Busca a previsão para um local e data específicos.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} date - Data no formato YYYY-MM-DD
 * @returns {Promise<Object|null>} Objeto com icone, tempMax e tempMin
 */
export async function getPrevisaoTempo(lat, lng, date) {
    if (!lat || !lng || !date) return null;

    // 1. Verifica Cache (LocalStorage)
    const cacheKey = `${CACHE_PREFIX}${lat}_${lng}_${date}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        const entry = JSON.parse(cached);
        // Se o cache for recente (< 4 horas), usa ele
        if (Date.now() - entry.timestamp < CACHE_EXPIRATION_MS) {
            return entry.data;
        }
    }

    // 2. Se não tiver cache, busca na API
    try {
        // API Open-Meteo para previsão diária
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo&start_date=${date}&end_date=${date}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na API Weather');
        
        const data = await response.json();
        
        if (!data.daily || !data.daily.weather_code) return null;

        const resultado = {
            codigo: data.daily.weather_code[0],
            tempMax: Math.round(data.daily.temperature_2m_max[0]),
            tempMin: Math.round(data.daily.temperature_2m_min[0]),
            icone: weatherIcons[data.daily.weather_code[0]] || 'fa-cloud'
        };

        // 3. Salva no Cache
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: resultado
        }));

        return resultado;

    } catch (erro) {
        console.warn('⚠️ [Clima] Erro ao buscar:', erro);
        // Em caso de erro (offline sem cache), retorna null para não quebrar a UI
        return null;
    }
}