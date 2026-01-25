// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFavoritos, importarFavoritos } from './storage.js';

// Suas configurações (Copiadas do Console)
const firebaseConfig = {
  apiKey: "AIzaSyCdqQQbV6eOLEeZSiHoDMqjrHw6pHF9XOc",
  authDomain: "nu-carnaval-2026.firebaseapp.com",
  projectId: "nu-carnaval-2026",
  storageBucket: "nu-carnaval-2026.firebasestorage.app",
  messagingSenderId: "887279427389",
  appId: "1:887279427389:web:97c2274c605aaa2d43ef54",
  measurementId: "G-X0B4G8DVTL"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- FUNÇÕES EXPORTADAS PARA O RESTO DO APP ---

// 1. Função de Login com Google
export async function loginGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("Logado como:", user.displayName);
        
        // Sincroniza dados assim que logar
        await sincronizarDados(user);
        
        return user;
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Ops! Não deu pra logar agora.");
    }
}

// 2. Função de Sair (Logout)
export async function logout() {
    try {
        await signOut(auth);
        alert("Você saiu da conta. Seus dados locais continuam aqui.");
        location.reload();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// 3. Monitora se o usuário está logado ou não (Observer)
export function monitorarAuth(callbackBotao) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Se usuário logou, atualiza a interface (botão)
            callbackBotao(true, user);
        } else {
            callbackBotao(false, null);
        }
    });
}

// 4. Salva Favoritos na Nuvem (Chamado quando você clica no coração)
export async function salvarNaNuvem(favoritosArray) {
    const user = auth.currentUser;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userRef, { favoritos: favoritosArray });
            console.log("☁️ Favoritos salvos na nuvem!");
        } catch (e) {
            console.error("Erro ao salvar na nuvem:", e);
        }
    }
}

// --- LÓGICA DE SINCRONIZAÇÃO (MAGIA) ---
async function sincronizarDados(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    
    // Pega o que já tem no celular
    const favoritosLocais = getFavoritos();
    
    if (docSnap.exists()) {
        // Se usuário já existe na nuvem, misturamos tudo
        const dadosNuvem = docSnap.data();
        const favoritosNuvem = dadosNuvem.favoritos || [];
        
        // Junta os dois sem repetir (Set remove duplicatas)
        const uniao = [...new Set([...favoritosLocais, ...favoritosNuvem])];
        
        // Atualiza Local e Nuvem com a lista completa
        importarFavoritos(uniao); 
        await setDoc(userRef, { favoritos: uniao }, { merge: true });
        
        console.log("🔄 Dados sincronizados com sucesso!");
    } else {
        // Primeiro acesso: sobe o que tem no celular para a nuvem
        await setDoc(userRef, { favoritos: favoritosLocais });
        console.log("☁️ Dados enviados para a nuvem pela primeira vez.");
    }
}