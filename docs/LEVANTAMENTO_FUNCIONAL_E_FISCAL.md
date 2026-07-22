# Levantamento funcional e fiscal — RA Polymers Compras

Atualizado em 22/07/2026. Este documento é um levantamento técnico para orientar o produto; a parametrização fiscal final deve ser homologada pela contabilidade responsável.

## Funcionalidades encontradas

- Autenticação e primeiro cadastro de empresa/usuário.
- Cadastro de comprador e fornecedores, CNPJ, papel e regime tributário.
- Configuração global de percentuais de aproveitamento de ICMS, PIS, Cofins e IPI.
- Criação em massa de requisições a partir de texto, com interpretação de quantidade e unidade.
- Fila estratégica de compras com prioridade, departamento, status e paginação.
- Mapa de cotação com até três fornecedores, preço, frete, prazo e condição de pagamento.
- Classificação da destinação: insumo industrial, revenda, uso/consumo e ativo imobilizado.
- Estimativa de custo bruto, créditos tributários, custo líquido/TCO e memória do cálculo.
- Escolha do fornecedor vencedor, negociação, saving e conclusão da compra.
- Histórico, detalhes, calendário de atividade, busca de preços/fornecedores e dashboard.
- Compra rápida: registro comercial imediato, sem cálculo tributário, com situação `Aguardando NF`.
- Regularização posterior da compra rápida com número, data, chave da NF-e, tributos destacados e memória fiscal.

## Regras fiscais que afetam o sistema

### ICMS

- O crédito depende de documento fiscal idôneo, incidência anterior, destinação e regras da UF. Apenas regime tributário e CST não são suficientes para decidir o crédito.
- Mercadoria para uso/consumo no regime atual do ICMS só dará crédito a partir de 01/01/2033 (LC 87/1996, art. 33, I).
- Ativo imobilizado não deve ser tratado como crédito integral imediato: a apropriação é mensal, em 1/48, com controles do CIAP e proporcionalidade das saídas tributadas (LC 87/1996, art. 20, § 5º).
- Na compra de optante pelo Simples, o adquirente não optante pode tomar crédito em mercadoria para comercialização ou industrialização, limitado ao ICMS efetivamente devido e ao percentual informado no documento (LC 123/2006, art. 23, §§ 1º e 2º). Não se deve aplicar automaticamente a alíquota interna cheia.
- ICMS-ST, redução de base, diferimento, benefício fiscal, FCP e DIFAL exigem dados próprios. Um booleano de ST e uma alíquota única não bastam.

### PIS e Cofins

- No regime não cumulativo, o fornecedor ser optante pelo Simples Nacional não bloqueia, isoladamente, o crédito do adquirente. O ADI RFB 15/2007 admite créditos, observadas as vedações e os demais requisitos legais.
- O conceito de insumo depende de essencialidade ou relevância para produção/prestação. A categoria genérica `uso e consumo` não permite concluir, sozinha, que nunca há crédito.
- Revenda, insumo, ativo, frete e demais despesas possuem fundamentos e restrições diferentes. CST e alíquota não substituem a natureza da operação.

### IPI

- Crédito é próprio de estabelecimento industrial ou equiparado e, em regra, alcança matéria-prima, produto intermediário e material de embalagem empregados na industrialização, conforme destaque/indicação documental e demais condições do RIPI.
- `Comprador fora do Simples + item marcado como insumo` não é prova suficiente de direito ao crédito.

### IBS e CBS em 2026

- 2026 é o ano de teste: CBS de 0,9% e IBS de 0,1%. O tratamento financeiro depende do cumprimento das obrigações acessórias e da disciplina de compensação/dispensa do período.
- A orientação oficial estabelece destaque dos novos campos nos documentos fiscais eletrônicos. Segundo comunicado do CGIBS de 15/06/2026, a validação operacional obrigatória está prevista para 03/08/2026 para empresas no regime regular.
- No regime regular definitivo, o crédito de IBS/CBS exige documento fiscal eletrônico idôneo e, em regra, extinção do débito da operação. Aquisição de fornecedor do Simples também pode gerar crédito nos limites legais.
- Por segurança, os campos IBS/CBS adicionados ao sistema em 2026 são armazenados como informativos e não reduzem automaticamente o TCO.

## Correções técnicas aplicadas nesta etapa

- Removido o bloqueio automático de PIS/Cofins só porque o fornecedor é do Simples.
- ICMS de fornecedor do Simples passa a exigir CSOSN compatível e valor/alíquota informado, evitando crédito cheio presumido.
- Valores monetários informados na NF prevalecem sobre estimativas simples por percentual.
- Percentuais são limitados ao intervalo de 0% a 100%.
- Ativo imobilizado gera alerta de apropriação em 48 parcelas.
- IBS/CBS de 2026 são registrados, mas não abatidos automaticamente do custo.
- Atualização de cotações passou a validar/calcular antes de excluir as anteriores e é concluída em transação.
- Compra rápida distingue imposto pendente de imposto igual a zero.

## Dados ainda necessários para um motor fiscal assertivo

1. UF de origem, UF de destino, inscrição estadual e condição de contribuinte de cada estabelecimento.
2. NCM, CEST, CFOP/natureza da operação, CST/CSOSN completo e código de benefício fiscal.
3. Base de cálculo e valor destacado por tributo; redução de base, diferimento, desoneração, FCP e ICMS-ST.
4. Identificação de frete CIF/FOB, emitente do CT-e e vínculo com aquisição ou venda.
5. Estabelecimento industrial/equiparado para IPI e vínculo efetivo do material com o processo produtivo.
6. Política contábil documentada para essencialidade/relevância de PIS/Cofins.
7. Controle CIAP do ativo imobilizado e cronograma mensal de 1/48.
8. Leiaute completo da NF-e 2026: CST IBS/CBS, `cClassTrib`, bases, reduções e eventos de pagamento/extinção.
9. Versionamento das regras por vigência, UF e tipo de operação; nenhuma regra tributária deve ficar fixa no frontend.
10. Importação do XML da NF-e para reduzir digitação e usar os valores oficiais do documento.

## Fontes oficiais consultadas

- Lei Complementar 87/1996: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm
- Lei Complementar 123/2006: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm
- Lei Complementar 214/2025, texto compilado: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm
- Receita Federal — Reforma Tributária do Consumo: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda
- Receita Federal — ADI RFB 15/2007: https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?anoAtoFacet=2007&tipoData=2
- RIPI, Decreto 7.212/2010: https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm
- CGIBS — orientações de início de vigência: https://cgibs.gov.br/comite-gestor-do-ibs-e-receita-federal-divulgam-orientacoes-sobre-a-entrada-em-vigor-da-cbs-e-do-ibs-em-1-de-janeiro-de-2026
- CGIBS — marco operacional de 03/08/2026: https://cgibs.gov.br/novo-marco-da-reforma-tributaria-inicia-em-03-de-agosto-com-preenchimento-obrigatorio-dos-campos-relativos-ao-ibs-e-a-cbs
