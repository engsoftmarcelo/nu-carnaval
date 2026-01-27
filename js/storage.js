/* ==========================================================================
   js/storage.js
   Gerencia persistência Local (LocalStorage) e Sincronização (Background Sync)
   Implementa a estratégia offline-first: guarda localmente sempre,
   e tenta sincronizar com a nuvem quando houver rede.
   ========================================================================== */

import { salvarNaNuvem } from './firebase.js';

// Chaves de armazenamento
const STORAGE_KEY = 'meus_favoritos_carnaval_2026';
const CHECKIN_KEY = 'nu_carnaval_checkins_2026';
const SYNC_QUEUE_KEY = 'nu_carnaval_sync_queue'; // Nova chave para a fila offline

/* ==========================================================================
   SISTEMA DE FILA OFFLINE (BACKGROUND SYNC)
   ========================================================================== */

/**
 * Adiciona uma ação à fila de sincronização quando não há internet.
 * @param {string} tipo - Tipo da ação (ex: 'update_favoritos')
 * @param {any} dados - Os dados a serem salvos (ex: array de IDs)
 */
function adicionarNaFila(tipo, dados) {
    try {
        const fila = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
        // Adiciona nova ação com timestamp
        fila.push({ 
            tipo, 
            dados, 
            timestamp: Date.now() 
        });
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(fila));
        console.log(`[Sync] 📡 Sem internet. Ação '${tipo}' enfileirada para depois.`);
    } catch (e) {
        console.error('[Sync] Erro ao salvar na fila:', e);
    }
}

/**
 * Processa a fila de sincronização.
 * Chamado automaticamente quando a conexão volta (evento 'online').
 */
export async function processarFilaSincronizacao() {
    if (!navigator.onLine) return;

    const fila = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    
    if (fila.length === 0) return;

    console.log(`[Sync] 🔄 Conexão voltou! Processando ${fila.length} itens pendentes...`);

    // Como o 'salvarNaNuvem' do Firebase substitui o array de favoritos pelo mais recente,
    // não precisamos processar item por item. Basta pegar o estado atual local
    // e enviar para a nuvem uma única vez.
    
    const favoritosAtuais = getFavoritos();
    
    try {
        await salvarNaNuvem(favoritosAtuais);
        
        // Se deu certo, limpa a fila
        localStorage.removeItem(SYNC_QUEUE_KEY);
        console.log('[Sync] ✅ Fila processada com sucesso! Nuvem atualizada.');
        
        // Feedback visual discreto para o utilizador
        const indicador = document.getElementById('offline-indicator');
        if(indicador) {
            const htmlOriginal = indicador.innerHTML;
            indicador.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizando dados...';
            indicador.classList.remove('view-hidden');
            
            setTimeout(() => {
                indicador.innerHTML = '<i class="fas fa-check"></i> Tudo salvo!';
                setTimeout(() => {
                    indicador.classList.add('view-hidden');
                    // Restaura o texto original para quando ficar offline de novo
                    setTimeout(() => indicador.innerHTML = htmlOriginal, 500);
                }, 2000);
            }, 1500);
        }

    } catch (error) {
        console.error('[Sync] ❌ Falha ao processar fila (tentaremos novamente depois):', error);
        // Não limpa a fila para tentar na próxima janela de conexão
    }
}

/* ==========================================================================
   GERENCIAMENTO DE FAVORITOS (ROTEIRO)
   ========================================================================== */

/**
 * Recupera a lista de favoritos locais.
 * @returns {Array<string>} Array de IDs
 */
export function getFavoritos() {
    try {
        const favoritosJSON = localStorage.getItem(STORAGE_KEY);
        return favoritosJSON ? JSON.parse(favoritosJSON) : [];
    } catch (erro) {
        console.error('Erro ao ler favoritos:', erro);
        return [];
    }
}

/**
 * Salva a lista localmente.
 */
function salvarFavoritos(listaIds) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaIds));
    } catch (erro) {
        console.error('Erro ao salvar favoritos localmente:', erro);
    }
}

/**
 * Alterna o estado de favorito (Adicionar/Remover).
 * ESTRATÉGIA: Optimistic UI (Atualiza local, tenta nuvem, fallback para fila).
 * @param {string} id - ID do bloco
 * @returns {boolean} Novo estado (true = favoritado)
 */
export function toggleFavorito(id) {
    const favoritos = getFavoritos();
    const index = favoritos.indexOf(id);
    let ehFavorito = false;

    if (index !== -1) {
        favoritos.splice(index, 1); // Remove
    } else {
        favoritos.push(id); // Adiciona
        ehFavorito = true;
    }

    // 1. Salva Localmente (Instantâneo - funciona sempre)
    salvarFavoritos(favoritos);
    
    // 2. Tenta Sincronizar com a Nuvem
    if (navigator.onLine) {
        // Se tem internet, tenta enviar direto
        salvarNaNuvem(favoritos).catch((err) => {
            console.warn('[Sync] Falha no envio direto. Enfileirando...', err);
            adicionarNaFila('update_favoritos', favoritos);
        });
    } else {
        // Se está offline, guarda na fila para depois
        adicionarNaFila('update_favoritos', favoritos);
    }

    return ehFavorito;
}

export function isFavorito(id) {
    return getFavoritos().includes(id);
}

/**
 * Importa favoritos de uma fonte externa (Link ou Nuvem).
 */
export function importarFavoritos(novosIds) {
    const atuais = getFavoritos();
    let count = 0;
    
    if (!Array.isArray(novosIds)) return 0;

    novosIds.forEach(id => {
        if (!atuais.includes(id)) {
            atuais.push(id);
            count++;
        }
    });
    
    if (count > 0) {
        salvarFavoritos(atuais);
        // Também enfileira a sincronização para garantir que a nuvem saiba da importação
        if (navigator.onLine) {
            salvarNaNuvem(atuais).catch(() => adicionarNaFila('update_favoritos', atuais));
        } else {
            adicionarNaFila('update_favoritos', atuais);
        }
    }
    
    return count;
}

/* ==========================================================================
   GERENCIAMENTO DE CHECK-INS (GAMIFICAÇÃO)
   (Por enquanto apenas local, mas preparado para sync)
   ========================================================================== */

export function getCheckins() {
    try {
        const checkins = localStorage.getItem(CHECKIN_KEY);
        return checkins ? JSON.parse(checkins) : [];
    } catch (erro) {
        return [];
    }
}

export function toggleCheckin(id) {
    const checkins = getCheckins();
    const index = checkins.indexOf(id);
    let checked = false;

    if (index !== -1) {
        checkins.splice(index, 1);
    } else {
        checkins.push(id);
        checked = true;
    }

    localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkins));
    
    // Futuro: Se quiser sincronizar check-ins na nuvem também:
    // adicionarNaFila('update_checkins', checkins);
    
    return checked;
}

export function isCheckedIn(id) {
    return getCheckins().includes(id);
}

export function getCheckinCount() {
    return getCheckins().length;
}

/* ==========================================================================
   LISTENERS GLOBAIS DE REDE
   ========================================================================== */

// Monitora quando a conexão volta para processar a fila
window.addEventListener('online', () => {
    processarFilaSincronizacao();
});

// Opcional: Tenta processar ao carregar a página também, caso tenha sobrado algo
document.addEventListener('DOMContentLoaded', () => {
    if (navigator.onLine) {
        setTimeout(processarFilaSincronizacao, 3000); // Espera 3s para não concorrer com o load inicial
    }
});