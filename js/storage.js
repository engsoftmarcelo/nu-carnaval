/* ==========================================================================
   js/storage.js
   Camada de Persistência Local (LocalStorage) & Nuvem (Firebase)
   Gerencia favoritos e check-ins do usuário.
   ========================================================================== */

// Importa a função para salvar na nuvem (NOVO)
import { salvarNaNuvem } from './firebase.js';

// Chave única para o LocalStorage 
const STORAGE_KEY = 'meus_favoritos_carnaval_2026'; // Atualizei para 2026 para garantir

/**
 * Recupera a lista de IDs dos blocos favoritos salvos.
 * @returns {Array<string>} Array de IDs (ex: ["entao-brilha-2026", ...])
 */
export function getFavoritos() {
    try {
        // 1. Lemos o LocalStorage
        const favoritosJSON = localStorage.getItem(STORAGE_KEY);
        
        // 2. Fazemos o parse ou retornamos array vazio se for a primeira vez
        if (!favoritosJSON) {
            return [];
        }

        return JSON.parse(favoritosJSON);
    } catch (erro) {
        console.error('Erro ao ler favoritos:', erro);
        return [];
    }
}

/**
 * Salva a lista de IDs no LocalStorage.
 * @param {Array<string>} listaIds - Nova lista de favoritos.
 */
function salvarFavoritos(listaIds) {
    try {
        // Transforma o array em string JSON para salvar
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaIds));
    } catch (erro) {
        console.error('Erro ao salvar favoritos (Storage cheio?):', erro);
    }
}

/**
 * Adiciona ou remove um bloco dos favoritos (Toggle).
 * @param {string} id - O ID do bloco (slug).
 * @returns {boolean} True se passou a ser favorito, False se deixou de ser.
 */
export function toggleFavorito(id) {
    const favoritos = getFavoritos();
    const index = favoritos.indexOf(id);
    let ehFavorito = false;

    if (index !== -1) {
        // Se já existe, remove (Desfavoritar)
        favoritos.splice(index, 1);
        ehFavorito = false;
    } else {
        // Se não existe, adiciona (Favoritar)
        favoritos.push(id);
        ehFavorito = true;
    }

    // 1. Persiste a nova lista localmente
    salvarFavoritos(favoritos);
    
    // 2. Tenta salvar na nuvem (NOVO)
    // (A função salvarNaNuvem verifica internamente se o usuário está logado)
    salvarNaNuvem(favoritos);

    // Retorna o novo estado para a UI poder atualizar o botão (vermelho/cinza)
    return ehFavorito;
}

/**
 * Verifica se um bloco específico é favorito.
 * Útil na hora de renderizar os cards para pintar o coração.
 * @param {string} id - O ID do bloco.
 * @returns {boolean}
 */
export function isFavorito(id) {
    const favoritos = getFavoritos();
    return favoritos.includes(id);
}

/**
 * Importa uma lista de IDs externos para os favoritos locais.
 * Usado quando o usuário abre um link compartilhado (Deep Linking) ou sincroniza com a nuvem.
 * Evita duplicatas.
 * @param {Array<string>} novosIds - Lista de IDs recebida via link ou nuvem.
 * @returns {number} Quantidade de novos blocos adicionados.
 */
export function importarFavoritos(novosIds) {
    const atuais = getFavoritos();
    let adicionadosCount = 0;
    
    novosIds.forEach(id => {
        // Só adiciona se ainda não estiver na lista local
        if (!atuais.includes(id)) {
            atuais.push(id);
            adicionadosCount++;
        }
    });
    
    if (adicionadosCount > 0) {
        salvarFavoritos(atuais);
    }
    
    return adicionadosCount;
}

/* ==========================================================================
   LÓGICA DE CHECK-IN (GAMIFICAÇÃO)
   Novas funções para gerenciar a presença nos blocos
   ========================================================================== */

const CHECKIN_KEY = 'nu_carnaval_checkins_2026';

/**
 * Recupera a lista de IDs dos blocos onde o usuário deu check-in.
 */
export function getCheckins() {
    try {
        const checkins = localStorage.getItem(CHECKIN_KEY);
        return checkins ? JSON.parse(checkins) : [];
    } catch (erro) {
        console.error('Erro ao ler check-ins:', erro);
        return [];
    }
}

/**
 * Alterna o estado de check-in de um bloco.
 * @param {string} id - O ID do bloco.
 * @returns {boolean} True se marcou presença, False se desmarcou.
 */
export function toggleCheckin(id) {
    const checkins = getCheckins();
    const index = checkins.indexOf(id);
    let checked = false;

    if (index !== -1) {
        checkins.splice(index, 1); // Remove (Desmarcar)
    } else {
        checkins.push(id); // Adiciona (Marcar)
        checked = true;
    }

    localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkins));
    return checked;
}

/**
 * Verifica se o usuário já deu check-in neste bloco.
 */
export function isCheckedIn(id) {
    return getCheckins().includes(id);
}

/**
 * Retorna o número total de blocos "sobrevividos".
 * Usado para exibir o placar/nível na gamificação.
 */
export function getCheckinCount() {
    return getCheckins().length;
}