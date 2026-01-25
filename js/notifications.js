/* ==========================================================================
   js/notifications.js
   Gerenciamento de Notificações Locais para Engajamento
   ========================================================================== */

export const NotificationManager = {
    timers: {}, // Armazena os IDs dos timeouts para poder cancelar se desfavoritar

    // 1. Solicita permissão ao usuário (chamado no primeiro favoritar)
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

    // 2. Agenda a notificação
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
            // Nota: O formato em data.js já vem corrigido para YYYY-MM-DD
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

    // 3. Cancela o agendamento (se o usuário desfavoritar)
    cancelar(blocoId) {
        if (this.timers[blocoId]) {
            clearTimeout(this.timers[blocoId]);
            delete this.timers[blocoId];
            console.log(`🗑️ Notificação cancelada para bloco ${blocoId}`);
        }
    },

    // 4. Cria a Notificação Visual
    disparar(bloco) {
        // Tenta usar o Service Worker se disponível (melhor para Mobile)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(`Nu! O ${bloco.name} vai sair!`, {
                    body: `Corre que o bloco sai às ${bloco.time} em ${bloco.neighborhood}.`,
                    icon: 'assets/icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: bloco.id, // Evita notificações duplicadas
                    data: { url: window.location.href } // Para abrir o app ao clicar
                });
            });
        } else {
            // Fallback para notificação padrão do navegador
            new Notification(`Nu! O ${bloco.name} vai sair!`, {
                body: `Faltam 30 minutos! Concentração em ${bloco.neighborhood}.`,
                icon: 'assets/icons/icon-192.png'
            });
        }
        
        // Remove do registro de timers ativos
        delete this.timers[bloco.id];
    }
};