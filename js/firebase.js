/* ==========================================================================
   js/firebase.js - VERSÃO FINAL (CDN + Test Mode + Push Notifications)
   Projeto: nu-carnaval-2026-e9c3b
   SDK: v12.8.0
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
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

    // --- IMPLEMENTAÇÃO 2.1.2: Persistência de Dados (Offline) ---
    // Habilita o cache local do Firestore para funcionar sem rede
    enableIndexedDbPersistence(db)
        .then(() => {
            console.log("💾 Persistência do Firestore: ATIVADA");
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                // Múltiplas abas abertas podem bloquear a persistência
                console.warn('Persistência falhou: Múltiplas abas abertas.');
            } else if (err.code == 'unimplemented') {
                // Navegador não suporta (ex: modo anônimo em alguns casos)
                console.warn('Persistência não suportada neste navegador.');
            }
        });
    // ------------------------------------------------------------

    provider = new GoogleAuthProvider();
    firebaseInicializado = true;
    console.log("🔥 Firebase (nu-carnaval-2026-e9c3b) conectado! v12.8.0");
} catch (e) {
    console.error("🔥 Erro crítico ao inicializar Firebase:", e);
}

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
            alert("ERRO DE DOMÍNIO: Adicione a URL deste site (ou localhost) no Firebase Console > Authentication > Settings > Authorized Domains.");
        } else if (error.code === 'auth/operation-not-allowed') {
            alert("ERRO: O Login com Google não está ativado. Vá no Firebase Console > Authentication e ative o provedor Google.");
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

// --- SALVAR NA NUVEM (Ao clicar no coração) ---
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

// --- PUSH NOTIFICATIONS: Salvar Token no Firestore (NOVO - Seção 2.2.2) ---
export async function salvarTokenPush(subscription) {
    // Clona o objeto de subscrição para garantir que é um JSON puro
    const subJSON = JSON.parse(JSON.stringify(subscription));

    try {
        // Se não houver utilizador logado, usa um ID anónimo baseado no timestamp
        const docId = auth.currentUser ? auth.currentUser.uid : 'anon_' + Date.now();
        const docRef = doc(db, "push_subscribers", docId);
        
        await setDoc(docRef, {
            subscription: subJSON,
            topics: ['geral', 'metro', 'emergencia'], // Tópicos padrão
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