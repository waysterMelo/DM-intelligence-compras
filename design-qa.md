# Design QA — Histórico com cards neutros

## Evidências

- Fonte visual: `artifacts/history-neutral-cards/01-before.png`
- Implementação final: `artifacts/history-neutral-cards/06-final-desktop.png`
- Estado: Histórico Geral, filtro “Todos os status”, comprador autenticado.
- Viewport e pixels: fonte e implementação em 1274 × 717 px, densidade equivalente e sem normalização adicional.
- Comparação completa: as duas imagens foram abertas juntas para avaliar hierarquia, legibilidade, contraste, espaçamento e proporções.
- Região focal: cards, faixa lateral, badge, painéis internos e calendário estão legíveis na captura completa; não foi necessário recorte adicional.
- Responsividade: em viewport CSS de 390 px, o card mediu 300 px, `bodyScrollWidth` 384 px e não houve overflow horizontal.

## Superfícies verificadas

- Tipografia: família, pesos, tamanhos e hierarquia foram preservados; textos escuros melhoraram a leitura sobre os cards claros.
- Espaçamento e layout: grid, paddings, raios, alinhamentos e densidade foram preservados após correção do eixo flex do card.
- Cores e tokens: o fundo geral passou para cinza-azulado neutro; cards usam branco e cinza muito claro; cores fortes ficaram restritas à faixa lateral, ícone, badge e ação.
- Imagens e ícones: não há imagens raster na superfície; os ícones existentes foram mantidos e receberam cor semântica por status.
- Conteúdo: nomes, quantidades, solicitantes, datas, status e ações permanecem intactos.

## Histórico de comparação

1. A fonte anterior usava azul forte em toda a superfície dos cards, classificado como P1 por excesso de peso visual e repetição.
2. A primeira implementação neutra perdeu `flex-col`, causando sobreposição horizontal, classificada como P1. O eixo do card foi corrigido e a composição voltou ao fluxo vertical.
3. A comparação final não encontrou P0, P1 ou P2 pendentes.

## Findings

- Nenhuma divergência bloqueante ou moderada na implementação final.

## Implementation Checklist

- Fundo geral neutro: concluído.
- Cards claros com faixa semântica: concluído.
- Ícone e badge com cor forte por status: concluído.
- Calendário mantido como destaque azul: concluído.
- Responsividade sem overflow horizontal: concluído.

## Follow-up Polish

- P3 opcional: observar a distribuição de cores com mais requisições em estados diferentes antes de ajustar saturação individual.

final result: passed
