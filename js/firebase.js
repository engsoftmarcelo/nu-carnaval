/* ==========================================================================
   js/firebase.js - VERSÃO COMPLETA (Auth + Sync + Push + Vibe Check)
   Projeto: nu-carnaval-2026-e9c3b
   SDK: v12.8.0
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    enableIndexedDbPersistence,
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot, 
    orderBy, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getFavoritos, importarFavoritos } from './storage.js';

// --- SUAS CHAVES DO PROJETO ---
const firebaseConfig = {
  apiKey: "AIzaSyBi6wODg7PVMmDnaF8wjGpfPBdtk1SF7Yg",
  authDomain: "nu-carnaval-2026-e9c3b.firebaseapp.com",
  projectId: "nu-carnaval-2026-e9c3b",
  storageBucket: "nu-carnaval-2026-e9c3b.firebasestorage.app",
  messagingSenderId: "152985754748",
  appId: "1:152985754748:web:1f402ce47450eca2e4fdf9"
};

// Variáveis globais do Firebase
let app, auth, db, provider;
let firebaseInicializado = false;

// --- INICIALIZAÇÃO ---
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // --- Persistência de Dados (Offline) ---
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("💾 Persistência do Firestore: ATIVADA");
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Persistência falhou: Múltiplas abas abertas.');
            } else if (err.code == 'unimplemented') {
                console.warn('Persistência não suportada neste navegador.');
            }
        });

    provider = new GoogleAuthProvider();
    firebaseInicializado = true;
    console.log("🔥 Firebase (nu-carnaval-2026-e9c3b) conectado! v12.8.0");
} catch (e) {
    console.error("🔥 Erro crítico ao inicializar Firebase:", e);
}

// ==========================================================================
// 1. AUTENTICAÇÃO E SINCRONIZAÇÃO
// ==========================================================================

// --- LOGIN ---
export async function loginGoogle() {
    if (!firebaseInicializado) {
        alert("Erro: Firebase não inicializou. Verifique o console (F12).");
        return;
    }

    try {
        console.log("🔵 Abrindo popup do Google...");
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log("✅ Logado com sucesso:", user.displayName);
        alert(`Aê! Boas vindas, ${user.displayName.split(' ')[0]}!`);
        
        // Sincroniza dados (sem travar se der erro no banco)
        sincronizarDados(user).catch(err => console.warn("Aviso (Banco de Dados):", err.code || err));

        return user;
    } catch (error) {
        console.error("❌ Erro no login:", error);
        
        if (error.code === 'auth/unauthorized-domain') {
            alert("ERRO DE DOMÍNIO: Adicione a URL deste site no Firebase Console > Authentication > Authorized Domains.");
        } else if (error.code === 'auth/operation-not-allowed') {
            alert("ERRO: O Login com Google não está ativado no Firebase Console.");
        } else if (error.code === 'auth/popup-closed-by-user') {
            console.log("Login cancelado pelo usuário.");
        } else {
            alert("Erro ao logar: " + error.message);
        }
    }
}

// --- LOGOUT ---
export async function logout() {
    try {
        await signOut(auth);
        alert("Desconectado.");
        location.reload(); // Recarrega para limpar o visual
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// --- MONITORAMENTO (UI) ---
export function monitorarAuth(callbackBotao) {
    if (!auth) return;
    onAuthStateChanged(auth, (user) => {
        if (user) {
            callbackBotao(true, user);
            // Sincroniza silenciosamente ao recarregar a página se já estiver logado
            sincronizarDados(user).catch(() => {});
        } else {
            callbackBotao(false, null);
        }
    });
}

// --- SALVAR NA NUVEM (Favoritos) ---
export async function salvarNaNuvem(favoritosArray) {
    if (!auth?.currentUser) return; // Só salva se logado
    
    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, { favoritos: favoritosArray }, { merge: true });
        console.log("☁️ Favoritos salvos na nuvem.");
    } catch (e) {
        console.error("Erro ao salvar na nuvem:", e);
    }
}

// --- SINCRONIZAÇÃO INTERNA ---
async function sincronizarDados(user) {
    const userRef = doc(db, "users", user.uid);
    
    // Graças à persistência ativada, o getDoc funciona offline buscando do cache local
    const docSnap = await getDoc(userRef);
    const favoritosLocais = getFavoritos(); // Pega do storage.js
    
    if (docSnap.exists()) {
        // Usuário já existe na nuvem -> Mesclar dados
        const dadosNuvem = docSnap.data();
        const favoritosNuvem = dadosNuvem.favoritos || [];
        
        // Junta local + nuvem sem duplicar
        const uniao = [...new Set([...favoritosLocais, ...favoritosNuvem])];
        
        console.log(`🔄 Sincronizando: ${favoritosLocais.length} locais + ${favoritosNuvem.length} nuvem = ${uniao.length} total.`);

        importarFavoritos(uniao); // Atualiza localStorage
        await setDoc(userRef, { favoritos: uniao }, { merge: true }); // Atualiza nuvem
    } else {
        // Primeiro acesso -> Criar perfil
        console.log("✨ Criando perfil novo na nuvem...");
        await setDoc(userRef, { 
            favoritos: favoritosLocais,
            email: user.email,
            nome: user.displayName,
            criado_em: new Date().toISOString()
        });
    }
}

// ==========================================================================
// 2. PUSH NOTIFICATIONS
// ==========================================================================

export async function salvarTokenPush(subscription) {
    const subJSON = JSON.parse(JSON.stringify(subscription));

    try {
        const docId = auth.currentUser ? auth.currentUser.uid : 'anon_' + Date.now();
        const docRef = doc(db, "push_subscribers", docId);
        
        await setDoc(docRef, {
            subscription: subJSON,
            topics: ['geral', 'metro', 'emergencia'],
            updated_at: new Date().toISOString(),
            user_id: auth.currentUser ? auth.currentUser.uid : null,
            platform: navigator.platform || 'unknown'
        }, { merge: true });
        
        console.log("🔔 Token Push salvo no Firestore!");
        return true;
    } catch (e) {
        console.error("Erro ao salvar token push:", e);
        return false;
    }
}

// ==========================================================================
// 3. VIBE CHECK (Real-Time Feed) [NOVO]
// ==========================================================================

/**
 * Envia um status para o bloco atual.
 * @param {string} blocoId - ID do bloco
 * @param {string} tipo - 'fogo' | 'morto' | 'policia'
 */
export async function enviarVibe(blocoId, tipo) {
    if (!auth.currentUser) {
        alert("Faça login para dar o papo!");
        return false;
    }

    try {
        const updatesRef = collection(db, "status_updates");
        await addDoc(updatesRef, {
            blocoId: blocoId,
            userId: auth.currentUser.uid,
            tipo: tipo,
            timestamp: Timestamp.now() // Data do servidor
        });
        console.log(`🔥 Vibe '${tipo}' enviada para ${blocoId}`);
        return true;
    } catch (e) {
        console.error("Erro ao enviar vibe:", e);
        return false;
    }
}

/**
 * Monitora a vibe de um bloco nos últimos 30 minutos.
 * @param {string} blocoId 
 * @param {function} callback - Recebe objeto { score, total, temPolicia, statusTexto }
 * @returns {function} unsubscribe - Função para parar de ouvir
 */
export function monitorarVibe(blocoId, callback) {
    // Define janela de tempo (30 minutos atrás)
    const trintaMinAtras = Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);
    const updatesRef = collection(db, "status_updates");

    // Query composta: Bloco + Tempo Recente
    // Nota: Isso pode exigir a criação de um índice no console do Firestore na primeira execução.
    const q = query(
        updatesRef,
        where("blocoId", "==", blocoId),
        where("timestamp", ">=", trintaMinAtras),
        orderBy("timestamp", "desc")
    );

    // Escuta em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
        let score = 0; // Termômetro (-10 a +10)
        let total = 0;
        let temPolicia = false;

        snapshot.forEach(doc => {
            const data = doc.data();
            total++;
            
            if (data.tipo === 'fogo') score += 1;
            if (data.tipo === 'morto') score -= 1;
            if (data.tipo === 'policia') temPolicia = true;
        });

        // Lógica do Status Texto
        let statusTexto = "Morno";
        if (score > 5) statusTexto = "PEGANDO FOGO 🔥";
        else if (score < -2) statusTexto = "Morgado 💀";
        else if (total === 0) statusTexto = "Sem dados";

        callback({ score, total, temPolicia, statusTexto });
    });

    return unsubscribe;
}