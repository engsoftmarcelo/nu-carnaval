/* ==========================================================================
   js/data.js
   Camada de Dados
   Responsável por buscar, limpar e estruturar os dados do JSON.
   ========================================================================== */

const DATA_URL = './data/blocos.json';

/**
 * Busca e processa os dados dos blocos.
 * Retorna uma lista limpa e padronizada.
 */
export async function carregarDados() {
    try {
        console.log(`[Data] Carregando e corrigindo blocos...`);
        
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Erro ao carregar blocos.json');

        const dadosPlanilha = await response.json();

        return dadosPlanilha.map(linha => {
            // 1. Tratamento de Estilos Musicais
            // Converte string "Pop, Axé" em array ["Pop", "Axé"]
            let estilos = linha['Estilo Musical'] 
                ? linha['Estilo Musical']
                    .split(',')
                    .map(s => s.replace(/\.+$/, '').trim()) // Remove ponto final e espaços
                    .filter(s => s.length > 0)
                : ['Diversos'];

            // 2. Geração de ID Único e URL-friendly
            const nomeBloco = linha['Nome do Bloco'] || "bloco-sem-nome";
            const idGerado = nomeBloco
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/[^a-z0-9]/g, "-");     // Substitui especiais por hífen

            // 3. Padronização de Data (DD/MM/YYYY -> YYYY-MM-DD)
            let dataFormatada = linha['Data'];
            if (dataFormatada && dataFormatada.includes('/')) {
                const partes = dataFormatada.split('/');
                if (partes.length === 3) dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
            }

            // 4. Captura e Correção de Coordenadas (Concentração e Dispersão)
            const latCorrigida = corrigirCoordenada(linha['Latitude Local de Concentração'], 'lat');
            const lngCorrigida = corrigirCoordenada(linha['Longitude Local de Concentração'], 'lng');
            
            const latDispCorrigida = corrigirCoordenada(linha['Latitude Local de Dispersão'], 'lat');
            const lngDispCorrigida = corrigirCoordenada(linha['Longitude Local de Dispersão'], 'lng');

            // 5. Inferência de Bairro (fallback simples)
            let bairro = "BH";
            const localConcentracao = linha['Local de Concentração'];
            if (localConcentracao && localConcentracao.includes(',')) {
                const partesEndereco = localConcentracao.split(',');
                const possivelBairro = partesEndereco[partesEndereco.length - 1].trim();
                // Evita pegar números ou CEPs como bairro
                if (isNaN(possivelBairro) && possivelBairro.length > 2) {
                    bairro = possivelBairro;
                }
            }

            // Objeto Final do Bloco
            return {
                id: idGerado,
                name: nomeBloco,
                date: dataFormatada || "", 
                time: linha['Horário'] || "A definir",
                neighborhood: bairro,
                location: linha['Local de Concentração'] || "",
                locationEnd: linha['Local de Dispersão'] || "", // Novo campo para o trajeto
                musical_style: estilos,
                description: linha['Resumo'] || "",
                // Coordenadas Normalizadas
                lat: latCorrigida,
                lng: lngCorrigida,
                latDisp: latDispCorrigida, 
                lngDisp: lngDispCorrigida, 
                // Nome normalizado para busca rápida
                normalized_name: nomeBloco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            };
        }).sort((a, b) => {
            // Ordenação Cronológica: Data -> Horário
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

/**
 * Função utilitária para limpar coordenadas "sujas" vindas de planilhas.
 * Resolve problemas como: "-19.923.456" (pontos extras), vírgulas, ou magnitude errada.
 */
function corrigirCoordenada(valor, tipo) {
    if (!valor) return null;
    
    // Troca vírgula por ponto
    let str = String(valor).replace(',', '.').trim();
    
    // Remove pontos extras (ex: -19.888.222 -> -19.888222)
    // Mantém apenas o primeiro ponto decimal
    if ((str.match(/\./g) || []).length > 1) {
         const parts = str.split('.');
         str = parts[0] + '.' + parts.slice(1).join('');
    }
    
    let numero = parseFloat(str);
    if (isNaN(numero)) return null;

    // Correção de Magnitude (Latitude BH ~ -19, Longitude BH ~ -43)
    
    if (tipo === 'lat') {
        // Se for muito pequeno (ex: -199.0), divide
        if (numero < -90) numero = numero / 10;
        // Se for muito "perto de zero" mas com dígitos certos (ex: -1.9), multiplica
        if (numero > -5 && numero < 0) numero = numero * 10;
        
        // Filtro de segurança: Aceita apenas coordenadas razoáveis para a região (Minas Gerais/Brasil)
        // Latitude deve estar entre -18 e -22 (aprox) para ser BH/Região
        // Se estiver muito fora, considera dado inválido para não quebrar o mapa
        if (numero > -10 || numero < -30) return null; 
    }

    if (tipo === 'lng') {
        if (numero < -180) numero = numero / 10; // ex: -430 -> -43
        if (numero > -10 && numero < 0) numero = numero * 10; // ex: -4.3 -> -43
        
        // Filtro de segurança para Longitude (BH ~ -43/-44)
        if (numero > -35 || numero < -55) return null;
    }

    return numero;
}