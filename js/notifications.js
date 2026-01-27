/* ==========================================================================
   js/notifications.js
   Gerenciamento de Notificações: Locais (Agendadas) e Simulação de Crise
   Versão: Frontend-Only (Sem Backend Pago)
   ========================================================================== */

export const NotificationManager = {
    timers: {}, // Armazena os IDs dos timeouts para poder cancelar se desfavoritar

    // 1. Solicita permissão ao utilizador
    async solicitarPermissao() {
        if (!("Notification" in window)) {
            console.log("Este navegador não suporta notificações.");
            return false;
        }

        if (Notification.permission === "granted") return true;

        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }

        return false;
    },

    // 2. Agenda a notificação local (30 min antes do bloco)
    async agendar(bloco) {
        // Verifica permissão antes de calcular
        if (Notification.permission !== "granted") {
            const concedido = await this.solicitarPermissao();
            if (!concedido) return;
        }

        // Se já tiver agendado, limpa para não duplicar
        this.cancelar(bloco.id);

        try {
            // Cria data do bloco: "2026-01-31" + "09:00" -> Date Object
            const dataHoraString = `${bloco.date}T${bloco.time}:00`;
            const dataBloco = new Date(dataHoraString);
            
            // Subtrai 30 minutos (30 * 60 * 1000 ms)
            const horaNotificacao = new Date(dataBloco.getTime() - 30 * 60000);
            const agora = new Date();

            const tempoAteNotificar = horaNotificacao - agora;

            // Só agenda se ainda não passou da hora
            if (tempoAteNotificar > 0) {
                console.log(`⏰ Notificação agendada para ${bloco.name} em ${horaNotificacao.toLocaleTimeString()}`);
                
                // Agenda o disparo
                this.timers[bloco.id] = setTimeout(() => {
                    this.disparar(bloco);
                }, tempoAteNotificar);
            }

        } catch (erro) {
            console.error("Erro ao agendar notificação:", erro);
        }
    },

    // 3. Cancela o agendamento local (se o utilizador desfavoritar)
    cancelar(blocoId) {
        if (this.timers[blocoId]) {
            clearTimeout(this.timers[blocoId]);
            delete this.timers[blocoId];
            console.log(`🗑️ Notificação cancelada para bloco ${blocoId}`);
        }
    },

    // 4. Cria a Notificação Visual (Disparo local agendado)
    disparar(bloco) {
        this.exibirNotificacao(`Nu! O ${bloco.name} vai sair!`, {
            body: `Corre que o bloco sai às ${bloco.time} em ${bloco.neighborhood}.`,
            tag: bloco.id
        });
        
        delete this.timers[bloco.id];
    },

    // 5. Função Genérica para Exibir Notificações (Abstrai Service Worker vs API Nativa)
    exibirNotificacao(titulo, options) {
        const config = {
            icon: './assets/icons/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: './index.html' },
            ...options
        };

        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(titulo, config);
            });
        } else {
            new Notification(titulo, config);
        }
    },

    // --- MODO SIMULAÇÃO (Substitui o Push Real Server-Side) ---
    // Esta função é chamada pelo botão "Testar Alertas" na UI para demonstração
    simularAlertaCrise() {
        alert("🚨 MODO DEMONSTRAÇÃO:\n\n1. O alerta chegará em 5 segundos.\n2. FECHE O APP AGORA (ou minimize) para ver a notificação chegar!");
        
        setTimeout(() => {
            this.exibirNotificacao("🚨 METRÔ PAROU!", {
                body: "Linha 1 interditada devido à chuva. Clique para ver rotas alternativas.",
                tag: 'simulacao-crise',
                requireInteraction: true // Mantém a notificação na tela até interação
            });
        }, 5000); // Espera 5 segundos antes de disparar
    }
};