/* js/data.js - Versão Final: Sanitiza Coordenadas e Limpa Estilos */

const DATA_URL = './data/blocos.json';

export async function carregarDados() {
    try {
        console.log(`[Data] Carregando e corrigindo blocos...`);
        
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Erro ao carregar blocos.json');

        const dadosPlanilha = await response.json();

        return dadosPlanilha.map(linha => {
            // --- CORREÇÃO DE ESTILOS ---
            // 1. Separa por vírgula
            // 2. Remove "..." do final (regex: /\.+$/)
            // 3. Remove espaços em branco
            let estilos = linha['Estilo Musical'] 
                ? linha['Estilo Musical']
                    .split(',')
                    .map(s => s.replace(/\.+$/, '').trim()) // A Mágica acontece aqui
                    .filter(s => s.length > 0)
                : ['Diversos'];

            // Geração de ID único
            const nomeBloco = linha['Nome do Bloco'] || "bloco-sem-nome";
            const idGerado = nomeBloco
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "-");

            // Tratamento de Data
            let dataFormatada = linha['Data'];
            if (dataFormatada && dataFormatada.includes('/')) {
                const partes = dataFormatada.split('/');
                if (partes.length === 3) dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
            }

            // Correção de Coordenadas
            const latCorrigida = corrigirCoordenada(linha['Latitude Local de Concentração'], 'lat');
            const lngCorrigida = corrigirCoordenada(linha['Longitude Local de Concentração'], 'lng');

            return {
                id: idGerado,
                name: nomeBloco,
                date: dataFormatada || "", 
                time: linha['Horário'] || "A definir",
                neighborhood: "BH", 
                location: linha['Local de Concentração'] || "",
                musical_style: estilos,
                description: linha['Resumo'] || "",
                lat: latCorrigida,
                lng: lngCorrigida,
                normalized_name: nomeBloco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            };
        }).sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
        });

    } catch (erro) {
        console.error('[Data] Erro crítico:', erro);
        return [];
    }
}

function corrigirCoordenada(valor, tipo) {
    if (!valor) return null;
    let str = String(valor).replace(',', '.').trim();
    let numero = parseFloat(str);
    if (isNaN(numero)) return null;

    if (tipo === 'lat') {
        if (numero < -90) numero = numero / 10;
        if (numero > -5 && numero < 0) numero = numero * 10;
        if (numero > -18 || numero < -22) return null; 
    }

    if (tipo === 'lng') {
        if (numero < -180) numero = numero / 10;
        if (numero > -10 && numero < 0) numero = numero * 10;
        if (numero > -42 || numero < -46) return null;
    }

    return numero;
}