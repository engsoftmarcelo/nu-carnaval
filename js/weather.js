/* ==========================================================================
   js/weather.js
   Gerenciador de Clima (Open-Meteo API + Hourly Support + Traduções)
   ========================================================================== */

const CACHE_PREFIX = 'nu_clima_v3_'; // Nova versão de cache
const CACHE_EXPIRATION_MS = 1000 * 60 * 60 * 4; // 4 horas

const weatherIcons = {
    0: 'fa-sun', 1: 'fa-cloud-sun', 2: 'fa-cloud-sun', 3: 'fa-cloud',
    45: 'fa-smog', 48: 'fa-smog',
    51: 'fa-cloud-rain', 53: 'fa-cloud-rain', 55: 'fa-cloud-showers-heavy',
    61: 'fa-cloud-rain', 63: 'fa-cloud-showers-heavy', 65: 'fa-cloud-showers-heavy',
    80: 'fa-cloud-showers-heavy', 81: 'fa-cloud-showers-heavy', 82: 'fa-cloud-showers-heavy',
    95: 'fa-bolt', 96: 'fa-bolt', 99: 'fa-bolt'
};

// Traduções para PT-BR
const weatherDesc = {
    0: 'Céu limpo', 1: 'Poucas nuvens', 2: 'Parc. nublado', 3: 'Encoberto',
    45: 'Nevoeiro', 48: 'Nevoeiro',
    51: 'Chuvisco', 53: 'Chuvisco', 55: 'Chuvisco denso',
    61: 'Chuva fraca', 63: 'Chuva moderada', 65: 'Chuva forte',
    80: 'Pancadas', 81: 'Pancadas fortes', 82: 'Tempestade',
    95: 'Trovoada', 96: 'Trovoada/Granizo', 99: 'Trovoada forte'
};

/**
 * Busca a previsão. Se 'time' for fornecido, retorna dados da hora específica.
 * @param {number} lat 
 * @param {number} lng 
 * @param {string} date (YYYY-MM-DD)
 * @param {string} [time] (HH:MM) - Opcional
 */
export async function getPrevisaoTempo(lat, lng, date, time = null) {
    if (!lat || !lng || !date) return null;

    const cacheKey = `${CACHE_PREFIX}${lat}_${lng}_${date}`;
    const cached = localStorage.getItem(cacheKey);
    let dadosDoDia = null;

    // 1. Tenta pegar do Cache
    if (cached) {
        const entry = JSON.parse(cached);
        if (Date.now() - entry.timestamp < CACHE_EXPIRATION_MS) {
            dadosDoDia = entry.data;
        }
    }

    // 2. Se não tem cache, busca na API (Daily + Hourly)
    if (!dadosDoDia) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code,precipitation_probability&timezone=America%2FSao_Paulo&start_date=${date}&end_date=${date}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Erro API Weather');
            const data = await response.json();

            dadosDoDia = {
                daily: {
                    code: data.daily.weather_code[0],
                    max: Math.round(data.daily.temperature_2m_max[0]),
                    min: Math.round(data.daily.temperature_2m_min[0])
                },
                hourly: {
                    times: data.hourly.time,
                    temps: data.hourly.temperature_2m,
                    codes: data.hourly.weather_code,
                    probs: data.hourly.precipitation_probability
                }
            };

            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: dadosDoDia
            }));
        } catch (erro) {
            console.warn('⚠️ [Clima] Falha:', erro);
            return null;
        }
    }

    // 3. Processa o Retorno

    // Caso A: Horário Específico
    if (time && dadosDoDia.hourly) {
        const horaDesejada = parseInt(time.split(':')[0]);
        const index = Math.max(0, Math.min(23, horaDesejada));
        
        const codigoHora = dadosDoDia.hourly.codes[index];
        const tempHora = Math.round(dadosDoDia.hourly.temps[index]);
        const probChuva = dadosDoDia.hourly.probs[index];

        // Lógica: Se chance de chuva > 30%, avisa. Se não, descreve o céu.
        let resumoTexto = probChuva > 30 ? `${probChuva}% chance chuva` : (weatherDesc[codigoHora] || 'Tempo firme');

        return {
            tipo: 'hora',
            temp: tempHora,
            icone: weatherIcons[codigoHora] || 'fa-cloud',
            probChuva: probChuva,
            resumo: resumoTexto
        };
    }

    // Caso B: Resumo do Dia (Fallback)
    // Agora incluímos o 'resumo' baseado no código do dia
    const codigoDia = dadosDoDia.daily.code;
    return {
        tipo: 'dia',
        tempMax: dadosDoDia.daily.max,
        tempMin: dadosDoDia.daily.min,
        icone: weatherIcons[codigoDia] || 'fa-cloud',
        resumo: weatherDesc[codigoDia] || 'Geral' // Correção do N/A
    };
}