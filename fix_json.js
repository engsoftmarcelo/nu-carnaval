const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'blocos.json');

console.log("🛠️ Iniciando REPARO CIRÚRGICO do JSON...");

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // --- PASSO 1: Resgatar conteúdo seguro (a partir do bloco 002) ---
    // Ignoramos o início corrompido e pegamos do segundo bloco em diante.
    const marker = '"id": "blk_002"';
    const splitIndex = content.indexOf(marker);

    if (splitIndex === -1) {
        throw new Error("Marcador 'blk_002' não encontrado. O arquivo original parece muito danificado.");
    }

    // Encontra a chave '{' que abre o bloco 002 (antes do ID)
    const lastBraceIndex = content.lastIndexOf('{', splitIndex);
    if (lastBraceIndex === -1) throw new Error("Erro estrutural: Início do bloco 002 não localizado.");
    
    let safeContent = content.substring(lastBraceIndex);

    // --- PASSO 2: Reconstruir o Cabeçalho e Bloco 001 ---
    const newHeader = `{
  "meta": {
    "version": "2026.1.0",
    "generated_at": "2026-01-21T03:42:00Z",
    "description": "Base recuperada via script."
  },
  "blocos": [
    {
      "id": "blk_001_recuperado",
      "nome": "Bloco Abertura (Recuperado)",
      "resumo": "Dados restaurados automaticamente.",
      "data": "2026-01-31",
      "horario": "08:00",
      "localizacao": { "bairro": "Centro" },
      "filtros": { "estilo": [], "publico": "Geral" },
      "entrada": "Gratuito"
    },
    `; // Vírgula importante para ligar ao bloco 002

    let finalContent = newHeader + safeContent;

    // --- PASSO 3: Correções de Sintaxe Interna ---
    // Corrige campos vazios "estilo":, -> "estilo": [],
    finalContent = finalContent.replace(/"estilo":\s*,/g, '"estilo": [],');
    finalContent = finalContent.replace(/"estilo":\s*}/g, '"estilo": []}');
    finalContent = finalContent.replace(/"filtros":\s*,/g, '"filtros": {},');

    // --- PASSO 4: Correção Segura do Rodapé ---
    // Remove APENAS o fechamento de array/objeto final se existir (] }), ignorando espaços.
    // Isso protege o fechamento '}' do último bloco.
    finalContent = finalContent.replace(/\s*\]\s*\}\s*,?\s*$/, '');

    // Adiciona um rodapé novo e limpo
    finalContent += '\n  ]\n}';

    // Remove BOM (caractere invisível) se existir
    finalContent = finalContent.replace(/^\uFEFF/, '');

    // --- PASSO 5: Salvar e Validar ---
    fs.writeFileSync(filePath, finalContent, 'utf8');
    
    // Teste Final
    JSON.parse(finalContent);
    console.log("✅ SUCESSO: O arquivo 'data/blocos.json' foi reparado e validado com sucesso!");

} catch (err) {
    console.error("❌ ERRO:", err.message);
    if (err.message.includes('position')) {
         console.log("Dica: O erro de posição indica que ainda há uma vírgula faltando ou sobrando entre os blocos.");
    }
}