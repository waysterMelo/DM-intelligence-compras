/**
 * Seed de dados para Fase 5 — Regras fiscais e Base Legal.
 * Executar com: npx ts-node src/seed/seed-tax-rules.ts
 *
 * Grupos de regras:
 *   A — REGRAS OPERACIONAIS — cobrem os cenários do dia a dia (icms, pis, cofins, ipi)
 *   B — REGRAS BLOQUEANTES  — impedem cálculo automático em cenários anômalos
 *   C — REGRAS EXEMPLIFICATIVAS — demonstram a estrutura, não devem ser assumidas como exaustivas
 *
 * Base Legal:
 *   Referências normativas utilizadas pelo motor para justificativa das decisões.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================
// BASE LEGAL — referências oficiais
// =============================================
const legalBasisData = [
  {
    code: 'CFEB_ART155',
    name: 'CFEB Art. 155 — ICMS',
    lawType: 'CFEB',
    lawNumber: '1988/CF',
    article: 'Art. 155',
    paragraph: '§2º',
    description: 'Competência estadual para instituir ICMS sobre operações com mercadorias e serviços de transporte interestadual e intermunicipal.',
    url: 'http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    isActive: true
  },
  {
    code: 'CFEB_ART195',
    name: 'CFEB Art. 195 — PIS/COFINS',
    lawType: 'CFEB',
    lawNumber: '1988/CF',
    article: 'Art. 195',
    paragraph: 'I',
    description: 'Base constitucional para financiamento da seguridade social (PIS/Pasep e COFINS).',
    url: 'http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    isActive: true
  },
  {
    code: 'LC123_ART23',
    name: 'LC 123/2006 Art. 23 — Simples Nacional',
    lawType: 'LC',
    lawNumber: '123/2006',
    article: 'Art. 23',
    paragraph: '',
    description: 'Regras de recolhimento unificado (DAS) para ME/EPP optantes pelo Simples Nacional.',
    url: 'http://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    isActive: true
  },
  {
    code: 'LEI10833_ART5',
    name: 'Lei 10.833/2003 Art. 5º — PIS/COFINS não-cumulativo',
    lawType: 'LEI',
    lawNumber: '10.833/2003',
    article: 'Art. 5º',
    paragraph: '',
    description: 'Institui a contribuição PIS/Pasep e COFINS não-cumulativos com direito a crédito sobre insumos.',
    url: 'http://www.planalto.gov.br/ccivil_03/leis/2003/l10.833.htm',
    isActive: true
  },
  {
    code: 'LEI9430_ART15',
    name: 'Lei 9.430/1996 Art. 15 — Alíquota interestadual do ICMS',
    lawType: 'LEI',
    lawNumber: '9.430/1996',
    article: 'Art. 15',
    paragraph: '',
    description: 'Alíquotas interestaduais do ICMS (7 %, 12 %).',
    url: 'http://www.planalto.gov.br/ccivil_03/leis/1996/l9430.htm',
    isActive: true
  },
  {
    code: 'LEI9532_ART6',
    name: 'Lei 9.532/1997 Art. 6º — IPI',
    lawType: 'LEI',
    lawNumber: '9.532/1997',
    article: 'Art. 6º',
    paragraph: '',
    description: 'Regulamentação do IPI sobre produtos industrializados.',
    url: 'http://www.planalto.gov.br/ccivil_03/leis/1997/l9532.htm',
    isActive: true
  },
  {
    code: 'NT2023001',
    name: 'Nota Técnica 2023.001 — Regras de creditamento',
    lawType: 'NOTA_TECNICA',
    lawNumber: '2023.001',
    article: '',
    paragraph: '',
    description: 'Orientações sobre creditamento de PIS/COFINS para insumos industriais.',
    url: '',
    isActive: true
  }
];

// =============================================
// GRUPO A — REGRAS OPERACIONAIS (icms, pis, cofins, ipi)
// =============================================
const operationalRules = [
  // --- ICMS ---
  {
    code: 'ICMS-OP-INT',
    name: 'ICMS — Operação Interna (contribuinte)',
    description: 'Operação interna com contribuinte do ICMS: alíquota interna aplica-se com direito a crédito.',
    category: 'ICMS',
    severity: 'INFO',
    appliesTo: { operationType: 'INTERNAL', isSupplierIcmsTaxpayer: true },
    version: '1.0'
  },
  {
    code: 'ICMS-OP-INT-AUS',
    name: 'ICMS — Operação Interna (fornecedor não contribuinte)',
    description: 'Operação interna com fornecedor não contribuinte: incidência a verificar.',
    category: 'ICMS',
    severity: 'WARNING',
    appliesTo: { operationType: 'INTERNAL', isSupplierIcmsTaxpayer: false },
    version: '1.0'
  },
  {
    code: 'ICMS-OP-INT',
    name: 'ICMS — Operação Interestadual',
    description: 'Operação interestadual com alíquota diferenciada por UF de destino.',
    category: 'ICMS',
    severity: 'INFO',
    appliesTo: { operationType: 'INTERSTATE', isSupplierIcmsTaxpayer: true },
    version: '1.0'
  },
  {
    code: 'ICMS-SIMPLES',
    name: 'ICMS — Fornecedor Simples Nacional',
    description: 'Fornecedor optante pelo Simples Nacional: ICMS recolhido via DAS, sem creditamento pelo adquirente.',
    category: 'ICMS',
    severity: 'WARNING',
    appliesTo: { supplierTaxRegime: 'SIMPLES' },
    version: '1.0'
  },
  {
    code: 'ICMS-MONO',
    name: 'ICMS — Substituição Monofásica',
    description: 'Produto com regime monofásico de ICMS: tributo retido na origem, sem novo creditamento.',
    category: 'ICMS',
    severity: 'BLOCKING',
    appliesTo: { isMonophase: true },
    version: '1.0'
  },
  {
    code: 'ICMS-ST',
    name: 'ICMS — Substituição Tributária',
    description: 'ICMS retido por ST: sem novo creditamento pelo destinatário.',
    category: 'ICMS',
    severity: 'BLOCKING',
    appliesTo: { hasIcmsSt: true },
    version: '1.0'
  },
  {
    code: 'ICMS-ISENTO',
    name: 'ICMS — Isenção',
    description: 'Operação isenta de ICMS por benefício fiscal. Verificar legislação aplicável.',
    category: 'ICMS',
    severity: 'WARNING',
    appliesTo: { isExempt: true },
    version: '1.0'
  },
  {
    code: 'ICMS-SUSP',
    name: 'ICMS — Exigibilidade Suspensa',
    description: 'Exigibilidade do ICMS suspensa por decisão judicial ou administrativa.',
    category: 'ICMS',
    severity: 'WARNING',
    appliesTo: { isSuspended: true },
    version: '1.0'
  },
  {
    code: 'ICMS-ZER',
    name: 'ICMS — Alíquota Zero',
    description: 'Produto com alíquota zero de ICMS por benefício legal.',
    category: 'ICMS',
    severity: 'WARNING',
    appliesTo: { isZeroRate: true },
    version: '1.0'
  },

  // --- PIS ---
  {
    code: 'PIS-NCL',
    name: 'PIS — Não-cumulativo com crédito',
    description: 'PIS não-cumulativo com direito a crédito sobre insumos industriais.',
    category: 'PIS',
    severity: 'INFO',
    appliesTo: { buyerPisCofinsRegime: 'NON_CUMULATIVE', itemUseType: 'INDUSTRIAL_INPUT' },
    version: '1.0'
  },
  {
    code: 'PIS-CL',
    name: 'PIS — Regime Cumulativo',
    description: 'PIS cumulativo: sem direito a crédito.',
    category: 'PIS',
    severity: 'WARNING',
    appliesTo: { buyerPisCofinsRegime: 'CUMULATIVE' },
    version: '1.0'
  },
  {
    code: 'PIS-ZERO',
    name: 'PIS — Alíquota Zero',
    description: 'Produto com alíquota zero de PIS por benefício legal.',
    category: 'PIS',
    severity: 'WARNING',
    appliesTo: { isZeroRate: true },
    version: '1.0'
  },

  // --- COFINS ---
  {
    code: 'COFINS-NCL',
    name: 'COFINS — Não-cumulativo com crédito',
    description: 'COFINS não-cumulativo com direito a crédito sobre insumos industriais.',
    category: 'COFINS',
    severity: 'INFO',
    appliesTo: { buyerPisCofinsRegime: 'NON_CUMULATIVE', itemUseType: 'INDUSTRIAL_INPUT' },
    version: '1.0'
  },
  {
    code: 'COFINS-CL',
    name: 'COFINS — Regime Cumulativo',
    description: 'COFINS cumulativo: sem direito a crédito.',
    category: 'COFINS',
    severity: 'WARNING',
    appliesTo: { buyerPisCofinsRegime: 'CUMULATIVE' },
    version: '1.0'
  },

  // --- IPI ---
  {
    code: 'IPI-CONTRIB',
    name: 'IPI — Contribuinte',
    description: 'IPI aplicável: fornecedor é contribuinte do IPI.',
    category: 'IPI',
    severity: 'INFO',
    appliesTo: { isSupplierIpiTaxpayer: true },
    version: '1.0'
  },
  {
    code: 'IPI-N-CONTRIB',
    name: 'IPI — Não Contribuinte',
    description: 'Fornecedor não contribuinte de IPI: sem incidência.',
    category: 'IPI',
    severity: 'WARNING',
    appliesTo: { isSupplierIpiTaxpayer: false },
    version: '1.0'
  },

  // --- GENERAL ---
  {
    code: 'GEN-CONSUMO',
    name: 'Uso e Consumo — Sem Crédito',
    description: 'Item de uso e consumo: sem creditamento fiscal permitido.',
    category: 'GENERAL',
    severity: 'BLOCKING',
    appliesTo: { itemUseType: 'CONSUMPTION' },
    version: '1.0'
  },
  {
    code: 'GEN-IMOB',
    name: 'Ativo Permanente — Restrições PIS/COFINS',
    description: 'Item para ativo permanente (imobilizado): sem creditamento de PIS/COFINS sobre aquisição.',
    category: 'GENERAL',
    severity: 'WARNING',
    appliesTo: { itemUseType: 'FIXED_ASSET' },
    version: '1.0'
  }
];

async function main() {
  console.log('=== Seed: Tax Rules & Legal Basis ===');

  // --- Base Legal ---
  for (const data of legalBasisData) {
    const exists = await prisma.taxLegalBasis.findUnique({ where: { code: data.code } });
    if (!exists) {
      await prisma.taxLegalBasis.create({ data });
      console.log(`  [Legal Basis] ${data.code}: ${data.name}`);
    } else {
      console.log(`  [ok]          ${data.code}: ${data.name}`);
    }
  }

  // --- Regras ---
  for (const data of operationalRules) {
    const exists = await prisma.taxRuleCatalog.findUnique({ where: { code: data.code } });
    if (!exists) {
      await prisma.taxRuleCatalog.create({ data: data as any });
      console.log(`  [Rule] ${data.code}: ${data.name} [${data.severity}]`);
    } else {
      console.log(`  [ok]   ${data.code}: ${data.name}`);
    }
  }

  console.log('=== Seed completo. ===');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
