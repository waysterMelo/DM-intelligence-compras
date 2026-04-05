/**
 * Seed de dados para Fase 5 — Regras fisiciais e Base Legal.
 * Executar com: npx ts-node src/seed/seed-tax-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seed: Tax Rules & Legal Basis ===');

  // === Base Legal ===
  const legalBasisData = [
    {
      code: 'CF_ART155',
      name: 'CF/88 Art. 155 - ICMS',
      lawType: 'CF',
      lawNumber: '1988',
      article: 'Art. 155',
      paragraph: '§2º',
      description: 'Competência estadual para instituir ICMS sobre operações com mercadorias.',
      url: 'http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
      isActive: true
    },
    {
      code: 'LC123_ART23',
      name: 'LC 123/2006 Art. 23 - Simples Nacional',
      lawType: 'LC',
      lawNumber: '123/2006',
      article: 'Art. 23',
      paragraph: '',
      description: 'Regras de recolhimento unificado para ME/EPP optantes pelo Simples Nacional.',
      url: 'http://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
      isActive: true
    },
    {
      code: 'LEI10833_ART5',
      name: 'Lei 10.833/2003 Art. 5º - PIS/COFINS não-cumulativo',
      lawType: 'LEI',
      lawNumber: '10.833/2003',
      article: 'Art. 5º',
      paragraph: '',
      description: 'Institui a contribuição PIS/Pasep e COFINS não-cumulativos.',
      url: 'http://www.planalto.gov.br/ccivil_03/leis/2003/l10.833.htm',
      isActive: true
    },
    {
      code: 'LEI9532_ART6',
      name: 'Lei 9.532/1997 Art. 6º - IPI',
      lawType: 'LEI',
      lawNumber: '9.532/1997',
      article: 'Art. 6º',
      paragraph: '',
      description: 'Regulamentação do IPI sobre produtos industrializados.',
      url: 'http://www.planalto.gov.br/ccivil_03/leis/l9532.htm',
      isActive: true
    },
    {
      code: 'NT2023001',
      name: 'Nota Técnica 2023.001 - Regras de creditamento',
      lawType: 'NOTA_TECNICA',
      lawNumber: '2023.001',
      article: '',
      paragraph: '',
      description: 'Orientações sobre creditamento de PIS/COFINS para insumos industriais.',
      url: '',
      isActive: true
    }
  ];

  for (const data of legalBasisData) {
    const exists = await prisma.taxLegalBasis.findUnique({ where: { code: data.code } });
    if (!exists) {
      await prisma.taxLegalBasis.create({ data });
      console.log(`  ✓ Legal Basis: ${data.code}`);
    }
  }

  // === Tax Rules ===
  const rulesData = [
    // ICMS
    {
      code: 'ICMS_OPERACAO_INTERNA',
      name: 'ICMS - Operação Interna',
      description: 'Aplica ICMS para operações internas com contribuinte.',
      category: 'ICMS',
      severity: 'INFO',
      appliesTo: { operationType: 'INTERNAL', isSupplierIcmsTaxpayer: true },
      version: '1.0'
    },
    {
      code: 'ICMS_OPERACAO_INTERESTADUAL',
      name: 'ICMS - Operação Interestadual',
      description: 'Aplica ICMS para operações interestaduais com alíquota diferenciada.',
      category: 'ICMS',
      severity: 'INFO',
      appliesTo: { operationType: 'INTERSTATE', isSupplierIcmsTaxpayer: true },
      version: '1.0'
    },
    {
      code: 'ICMS_SIMPLES_FORNECEDOR',
      name: 'ICMS - Fornecedor Simples Nacional',
      description: 'Fornecedor do Simples: ICMS recolhido via DAS, sem creditamento normal.',
      category: 'ICMS',
      severity: 'WARNING',
      appliesTo: { supplierTaxRegime: 'SIMPLES' },
      version: '1.0'
    },
    {
      code: 'ICMS_MONOFASSICO',
      name: 'ICMS - Substituição Monofásica',
      description: 'Produto monofásico: ICMS retido anteriormente, sem novo creditamento.',
      category: 'ICMS',
      severity: 'BLOCKING',
      appliesTo: { isMonophase: true },
      version: '1.0'
    },
    {
      code: 'ICMS_ST',
      name: 'ICMS - Substituição Tributária',
      description: 'ICMS-ST: crédito diferido, retenção por substituição tributária.',
      category: 'ICMS',
      severity: 'BLOCKING',
      appliesTo: { hasIcmsSt: true },
      version: '1.0'
    },
    {
      code: 'ICMS_ISENTO',
      name: 'ICMS - Isenção',
      description: 'Operação isenta de ICMS por benefício fiscal.',
      category: 'ICMS',
      severity: 'WARNING',
      appliesTo: { isExempt: true },
      version: '1.0'
    },
    {
      code: 'ICMS_SUSPENSO',
      name: 'ICMS - Suspensão',
      description: 'Exigibilidade de ICMS suspensa por decisão judicial ou administrativa.',
      category: 'ICMS',
      severity: 'WARNING',
      appliesTo: { isSuspended: true },
      version: '1.0'
    },

    // PIS
    {
      code: 'PIS_NAO_CUMULATIVO',
      name: 'PIS - Regime Não-Cumulativo',
      description: 'PIS não-cumulativo com creditamento sobre insumos industriais.',
      category: 'PIS',
      severity: 'INFO',
      appliesTo: { buyerPisCofinsRegime: 'NON_CUMULATIVE', itemUseType: 'INDUSTRIAL_INPUT' },
      version: '1.0'
    },
    {
      code: 'PIS_CUMULATIVO',
      name: 'PIS - Regime Cumulativo',
      description: 'PIS cumulativo: sem creditamento.',
      category: 'PIS',
      severity: 'WARNING',
      appliesTo: { buyerPisCofinsRegime: 'CUMULATIVE' },
      version: '1.0'
    },
    {
      code: 'PIS_ALIQUOTA_ZERO',
      name: 'PIS - Alíquota Zero',
      description: 'Produto com alíquota zero de PIS por benefício legal.',
      category: 'PIS',
      severity: 'WARNING',
      appliesTo: { isZeroRate: true },
      version: '1.0'
    },

    // COFINS
    {
      code: 'COFINS_NAO_CUMULATIVO',
      name: 'COFINS - Regime Não-Cumulativo',
      description: 'COFINS não-cumulativo com creditamento sobre insumos industriais.',
      category: 'COFINS',
      severity: 'INFO',
      appliesTo: { buyerPisCofinsRegime: 'NON_CUMULATIVE', itemUseType: 'INDUSTRIAL_INPUT' },
      version: '1.0'
    },
    {
      code: 'COFINS_CUMULATIVO',
      name: 'COFINS - Regime Cumulativo',
      description: 'COFINS cumulativo: sem creditamento.',
      category: 'COFINS',
      severity: 'WARNING',
      appliesTo: { buyerPisCofinsRegime: 'CUMULATIVE' },
      version: '1.0'
    },

    // IPI
    {
      code: 'IPI_CONTRIBUINTE',
      name: 'IPI - Contribuinte',
      description: 'IPI aplicável para contribuinte com produto industrializado.',
      category: 'IPI',
      severity: 'INFO',
      appliesTo: { isSupplierIpiTaxpayer: true },
      version: '1.0'
    },
    {
      code: 'IPI_NAO_CONTRIBUINTE',
      name: 'IPI - Não Contribuinte',
      description: 'Fornecedor não contribuinte de IPI: sem incidência.',
      category: 'IPI',
      severity: 'WARNING',
      appliesTo: { isSupplierIpiTaxpayer: false },
      version: '1.0'
    },

    // General
    {
      code: 'CONSUMO_SEM_CREDITO',
      name: 'Uso e Consumo - Sem Crédito',
      description: 'Item de uso e consumo: sem creditamento fiscal permitido.',
      category: 'GENERAL',
      severity: 'BLOCKING',
      appliesTo: { itemUseType: 'CONSUMPTION' },
      version: '1.0'
    },
    {
      code: 'ATIVO_PERMANENTE_SEM_CREDITO',
      name: 'Ativo Permanente - Sem Crédito',
      description: 'Item para ativo permanente (imobilizado): sem creditamento de PIS/COFINS sobre aquisição.',
      category: 'GENERAL',
      severity: 'WARNING',
      appliesTo: { itemUseType: 'FIXED_ASSET' },
      version: '1.0'
    }
  ];

  for (const data of rulesData) {
    const exists = await prisma.taxRuleCatalog.findUnique({ where: { code: data.code } });
    if (!exists) {
      await prisma.taxRuleCatalog.create({ data: data as any });
      console.log(`  ✓ Rule: ${data.code}`);
    }
  }

  console.log('=== Seed completo! ===');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
