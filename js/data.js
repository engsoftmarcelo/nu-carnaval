/* ==========================================================================
   js/data.js
   Camada de Dados - CORRIGIDO
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

            // Geração de ID (Slug)
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

            // Coordenadas (Função auxiliar interna ou lógica direta se não houver a função corrigirCoordenada importada)
            // Assumindo que a função corrigirCoordenada estava definida neste arquivo ou deve ser tratada aqui.
            // Vou incluir a lógica de correção básica aqui para garantir que funcione.
            const corrigirCoordenada = (val) => {
                if (!val) return null;
                let v = String(val).replace(',', '.').trim();
                return v === "" ? null : parseFloat(v);
            };

            const latCorrigida = corrigirCoordenada(linha['Latitude Local de Concentração']);
            const lngCorrigida = corrigirCoordenada(linha['Longitude Local de Concentração']);
            const latDispCorrigida = corrigirCoordenada(linha['Latitude Local de Dispersão']);
            const lngDispCorrigida = corrigirCoordenada(linha['Longitude Local de Dispersão']);

            return {
                id: idGerado, // Usamos o slug gerado como ID principal
                originalId: linha.id, // Mantemos o ID numérico original se precisar
                name: nomeBloco,
                date: dataFormatada || "", 
                time: linha['Horário'] || "A definir",
                
                // --- NOVOS CAMPOS (Que estavam faltando) ---
                is_special: linha.is_special,
                artist: linha.artist,
                artist_image: linha.artist_image,

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
            
            // Compara datas
            const dataA = new Date(a.date);
            const dataB = new Date(b.date);
            if (dataA < dataB) return -1;
            if (dataA > dataB) return 1;

            // Se datas iguais, compara horários
            const horaA = a.time.replace(':', '');
            const horaB = b.time.replace(':', '');
            return horaA - horaB;
        });

    } catch (error) {
        console.error("[Data] Erro fatal ao processar dados:", error);
        return [];
    }
}