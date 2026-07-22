# Escopo do sistema de Compras e TCO

Atualizado em 22/07/2026.

## Objetivo

O sistema apoia a equipe de Compras na criação de requisições, coleta e comparação de propostas, escolha manual do fornecedor, registro do valor negociado e conferência do custo realizado após o recebimento da NF-e.

Os impostos e percentuais de recuperação são dados comerciais informados pelo fornecedor ou configurados pelos usuários. Eles servem exclusivamente para produzir uma estimativa comparável de TCO.

## Simulador de TCO

O cálculo é executado somente no backend:

- custo bruto = preço unitário × quantidade + frete + tributos marcados como adicionais;
- recuperação estimada = valor informado do tributo × percentual configurado;
- TCO estimado = custo bruto − recuperação estimada.

Quando valor e alíquota são informados para o mesmo tributo, o valor monetário prevalece. IPI, ICMS-ST, FCP e DIFAL podem ser classificados como incluídos no preço ou adicionais. Dados obrigatórios ausentes deixam a proposta como `Incompleta`.

As premissas de recuperação são configuradas por destinação — insumo industrial, revenda, ativo e uso/consumo — para ICMS, IPI, PIS e Cofins. Um ajuste feito diretamente na cotação é registrado como premissa comercial específica.

## Comparação e decisão

A comparação apresenta preço, frete, tributos informados, custo bruto, recuperação estimada, TCO estimado, prazo, condição de pagamento e completude. A ordenação inicial usa o menor TCO, mas a escolha do fornecedor é sempre manual.

A proposta original, o valor negociado e o saving permanecem separados. Receber uma NF não altera a proposta vencedora.

## Compra rápida e NF-e

A compra rápida não exige dados tributários e começa no estado `Aguardando NF`. O fluxo de conferência usa os estados:

- `Aguardando NF`;
- `NF recebida`;
- `Custo conferido`;
- `Divergência encontrada`.

Cada requisição pode ter uma única NF nesta versão. A nota pode ser informada manualmente ou importada de um XML de NF-e 4.0. Na importação, o sistema verifica estrutura básica, modelo 55, chave de 44 dígitos com dígito verificador, duplicidade e CNPJ do fornecedor vencedor.

A conferência compara os totais bruto, frete, tributos e TCO estimado entre proposta e NF. Rateio entre requisições e entregas parciais não fazem parte desta versão.

## Dados de referência e limites

NCM é opcional para identificação e pesquisa. CEST, CFOP e CST/CSOSN são referências recebidas do fornecedor ou do XML e não acionam regras automáticas.

O produto não contém regras legais por NCM, CFOP, CST, UF ou regime tributário; não determina direito tributário e não realiza escrituração. A importação do XML existe somente para conferência comercial de custo.

## APIs principais

- `POST /tco/preview` — simula TCO sem persistir;
- `PUT /requisitions/:id/quotes` — salva propostas e os resultados calculados no backend;
- `POST /requisitions/:id/invoice/manual` — registra uma NF manual;
- `POST /requisitions/:id/invoice/xml` — importa o XML da NF-e;
- `POST /requisitions/:id/reconcile` — confirma a conferência de custo;
- `GET|PATCH /companies/tco-assumptions` — consulta ou altera a matriz de premissas.
