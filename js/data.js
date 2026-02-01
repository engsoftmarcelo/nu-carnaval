/* ==========================================================================
   js/data.js
   Camada de Dados
   ========================================================================== */

// Configuração do arquivo JSON
const DATA_URL = './data/blocos_site.json';

export async function carregarDados() {
    try {
        console.log(`[Data] Carregando blocos de ${DATA_URL}...`);
        
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Erro ao carregar JSON');

        const dadosPlanilha = await response.json();

        return dadosPlanilha.map(linha => {
            // Tratamento de Estilos Musicais
            let estilos = linha['Estilo Musical'] 
                ? linha['Estilo Musical']
                    .split(',')
                    .map(s => s.replace(/\.+$/, '').trim()) 
                    .filter(s => s.length > 0)
                : ['Diversos'];

            // Geração de ID
            const nomeBloco = linha['Nome do Bloco'] || "bloco-sem-nome";
            const idGerado = nomeBloco
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "-");

            // Formatação de Data
            let dataFormatada = linha['Data'];
            if (dataFormatada && dataFormatada.includes('/')) {
                const partes = dataFormatada.split('/');
                if (partes.length === 3) dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
            }

            // Coordenadas
            const latCorrigida = corrigirCoordenada(linha['Latitude Local de Concentração'], 'lat');
            const lngCorrigida = corrigirCoordenada(linha['Longitude Local de Concentração'], 'lng');
            const latDispCorrigida = corrigirCoordenada(linha['Latitude Local de Dispersão'], 'lat');
            const lngDispCorrigida = corrigirCoordenada(linha['Longitude Local de Dispersão'], 'lng');

            return {
                id: idGerado,
                name: nomeBloco,
                date: dataFormatada || "", 
                time: linha['Horário'] || "A definir",
                
                // Dados de localização e detalhes
                neighborhood: linha['bairro'] || "BH", 
                location: linha['Local de Concentração'] || "",
                locationEnd: linha['Local de Dispersão'] || "",
                musical_style: estilos,
                description: linha['descrisao'] || "", 
                
                // Coordenadas normalizadas
                lat: latCorrigida,
                lng: lngCorrigida,
                latDisp: latDispCorrigida, 
                lngDisp: lngDispCorrigida, 
                
                // Nome normalizado para busca
                normalized_name: nomeBloco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            };
        }).sort((a, b) => {
            // Ordenação por data e hora
            if (!a.date) return 1;
            if (!b.date) return -1;
            const dataHoraA = new Date(`${a.date}T${a.time.includes(':') ? a.time : '00:00'}`);
            const dataHoraB = new Date(`${b.date}T${b.time.includes(':') ? b.time : '00:00'}`);
            return dataHoraA - dataHoraB;
        });

    } catch (erro) {
        console.error('[Data] Erro crítico ao processar dados:', erro);
        return [];
    }
}

// Função auxiliar para correção de coordenadas
function corrigirCoordenada(valor, tipo) {
    if (!valor) return null;
    let str = String(valor).replace(',', '.').trim();
    if ((str.match(/\./g) || []).length > 1) {
         const parts = str.split('.');
         str = parts[0] + '.' + parts.slice(1).join('');
    }
    let numero = parseFloat(str);
    if (isNaN(numero)) return null;

    if (tipo === 'lat') {
        if (numero < -90) numero = numero / 10;
        if (numero > -5 && numero < 0) numero = numero * 10;
        if (numero > -10 || numero < -30) return null; 
    }
    if (tipo === 'lng') {
        if (numero < -180) numero = numero / 10; 
        if (numero > -10 && numero < 0) numero = numero * 10; 
        if (numero > -35 || numero < -55) return null;
    }
    return numero;
}