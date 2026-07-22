/**
 * Contrato de Documento Fiscal (Fase 6 — Preparação).
 *
 * Define o modelo mínimo de um documento fiscal (NF-e / XML) que o sistema
 * precisa consumir para enriquecer cadastro e validar parâmetros do motor.
 *
 * Estrutura baseada na NT 2020.001 e nos campos do Quote modelo.
 */

// =============================================
// TIPOS BASE
// =============================================

/**
 * Indicador de papel/autorização
 * 0=Sem geração de DANFE (NFC-e), 1=DANFE normal
 */
export type NFeIndicadorDANFE = 0 | 1;

/**
 * Indicador de presença do comprador
 * 0=Não informado, 1=Transação presencial, 2=Não presencial (internet),
 * 3=Não presencial (teleatendimento), 4=NFC-e em entrega domiciliar,
 * 5=Operação presencial com entregador em domicílio, 6=Não presencial (outros)
 */
export type NFeIndicadorPresenca = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Modalidade de determinação da base de cálculo do ICMS
 * 0=Margem Valor Agregado, 1=Pauta, 2=Preço Tabelado Máximo, 3=Valor da Operação
 */
export type NFeModalidadeBC = '0' | '1' | '2' | '3';

// =============================================
// EMITENTE
// =============================================

export interface FiscalDocEmitente {
  /** CNPJ (14 dígitos) ou CPF (11 dígitos) */
  cnpjCpf: string;
  /** Razão Social */
  nome: string;
  /** Nome Fantasia */
  fantasia?: string;
  /** Endereço */
  endereco: string;
  /** Número do endereço */
  numero?: string;
  /** Complemento */
  complemento?: string;
  /** Bairro */
  bairro: string;
  /** Código do município (IBGE, 7 dígitos) */
  codMunicipio: string;
  /** Nome do município */
  municipio: string;
  /** UF */
  uf: string;
  /** CEP (8 dígitos) */
  cep?: string;
  /** Código do País (BACEN) */
  codPais?: string;
  /** Nome do País */
  pais?: string;
  /** Telefone */
  telefone?: string;
  /** Inscrição Estadual */
  ie?: string;
  /** I.E. ST (para substituição tributária) */
  ieSt?: string;
  /** Regime de apuração do Simples Nacional */
  crt?: '1' | '2' | '3'; // 1=MEI (não usa), 2=Simples, 3=Normal
  /** Inscrição Municipal */
  im?: string;
}

// =============================================
// DESTINATÁRIO / COMPRADOR
// =============================================

export interface FiscalDocDestinatario {
  cnpjCpf: string;
  nome?: string; // Pode ser nulo em operações com consumidor final
  bairro?: string;
  codMunicipio?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codPais?: string;
  pais?: string;
  ie?: string; // Pode ser vazio para não contribuinte
  ieSt?: string;
}

// =============================================
// ITEM DO DOCUMENTO FISCAL
// =============================================

export interface FiscalDocItem {
  /** Número do item (dentro do documento) */
  numeroItem: number;

  // === Identificação do Produto ===
  /** Código de produto do emitente (referência interna) */
  code?: string;
  /** Descrição do produto/serviço */
  descricao: string;
  /** NCM — Nomenclatura Comum do Mercosul (8 dígitos) */
  ncm: string;
  /** NVE — Nomenclatura de Valor Aduaneiro e Estatístico (até 8) */
  nve?: string[];
  /** CEST — Código Especificador da Substituição Tributária (7 dígitos) */
  cest?: string;
  /** Excecao de IPI (código da legislação aplicável) */
  extIPI?: string;
  /** CFOP — Código Fiscal de Operações e Prestações (4 dígitos) */
  cfop: string;
  /** Unidade comercial */
  uCom: string;
  /** Quantidade comercial */
  qCom: number;
  /** Valor unitário comercial */
  vUnCom: number;
  /** Unidade tributável */
  uTrib: string;
  /** Quantidade tributável */
  qTrib: number;
  /** Valor unitário tributável */
  vUnTrib: number;

  /** Valor do frete (por item) */
  vFrete?: number;
  /** Valor do seguro (por item) */
  vSeguro?: number;
  /** Valor do desconto (por item) */
  vDesc?: number;
  /** Outras despesas acessórias */
  vOutro?: number;

  // === Tributação ICMS ===
  /** Origem da mercadoria (0=Ex; 1=Nacion; 2=Extern) */
  origem: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
  /** CSOSN (Simples Nacional) ou CST (Regime Normal) */
  cstIcms: string;
  /** Modalidade de definição da base de cálculo do ICMS */
  modBC?: NFeModalidadeBC;
  /** Alíquota do ICMS (%) */
  icmsRate?: number;
  /** Valor do ICMS */
  icmsValue?: number;
  /** Base de cálculo do ICMS */
  icmsBase?: number;
  /** Alíquota interestadual (%) */
  pICMSInter?: number;
  /** Origem do ICMS-ST */
  vICMSSubstituto?: number;
  /** Percentual do ICMS-ST */
  icmsStPercent?: number;
  /** Valor do ICMS retido por ST */
  icmsStValue?: number;
  /** Valor do Fundo de Combate à Pobreza */
  vFCPST?: number;

  // === Tributação PIS ===
  /** CST do PIS (01-07, 40-99) */
  cstPis?: string;
  /** Alíquota do PIS (%) */
  pisRate?: number;
  /** Base de cálculo do PIS */
  pisBase?: number;
  /** Valor do PIS */
  pisValue?: number;

  // === Tributação COFINS ===
  /** CST da COFINS (01-07, 40-99) */
  cstCofins?: string;
  /** Alíquota da COFINS (%) */
  cofinsRate?: number;
  /** Base de cálculo da COFINS */
  cofinsBase?: number;
  /** Valor da COFINS */
  cofinsValue?: number;

  // === Tributação IPI ===
  /** CST do IPI (00, 49, 50, 51, 52, 53, 54, 55, 56, 99) */
  cstIpi?: string;
  /** Classe de enquadramento do IPI */
  clEnqIPI?: string;
  /** Código de enquadramento IPI */
  cEnqIPI?: string;
  /** Alíquota do IPI (%) */
  ipiRate?: number;
  /** Valor do IPI */
  ipiValue?: number;

  // === Indicadores Especiais (inferidos do documento) ===
  /** Produto monofásico */
  isMonofase?: boolean;
  /** Alíquota zero */
  isAlíquotaZero?: boolean;
  /** Isenção fiscal explicita */
  isIsento?: boolean;
  /** Suspensão de exigibilidade */
  isSuspenso?: boolean;
  /** Substituição Tributária */
  hasICMS_ST?: boolean;

  // === Natureza de Crédito (inferida) ===
  /** Natureza de crédito dedução — RESALE | INSUMO | FREIGHT | ENERGY | DEPRECIATION | SERVICE | OTHER */
  creditNature?: string;
  /** Flag: não permite crédito (operações não tributadas, isentas, etc) */
  noCredit?: boolean;
}

// =============================================
// TRANSPORTADOR (útil para ST e frete)
// =============================================

export interface FiscalDocTransportador {
  cnpjCpf?: string;
  nome?: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  codigoMunicipio?: string;
}

// =============================================
// DOCUMENTO FISCAL
// =============================================

export interface FiscalDocument {
  /** Tipo de documento: NFE | NFCE | NFS */
  type: 'NFE' | 'NFCE' | 'NFS';
  /** Chave de acesso (44 dígitos) */
  chave: string;
  /** Número do documento */
  numero: string;
  /** Série do documento */
  serie: string;
  /** Modelo do documento: 55=NF-e, 65=NFC-e, 1=NFS */
  modelo: string;

  /** Data de emissão (ISO 8601) */
  dataEmissao: string;
  /** Data de entrada/saída */
  dataEntradaSaida: string;
  /** Natureza da operação (ex: "Venda de mercadoria") */
  naturezaOperacao: string;

  // === Presença (comprador) ===
  /** Indicador de presença do comprador */
  indPres?: NFeIndicadorPresenca;
  /** Indicador do tipo de DANFE */
  indDANFE?: NFeIndicadorDANFE;

  // === Entidades ===
  emitente: FiscalDocEmitente;
  destinatario: FiscalDocDestinatario;
  itens: FiscalDocItem[];
  transportador?: FiscalDocTransportador;

  // === Totais ===
  valorNota: number;
  valorTotalICMS?: number;
  valorTotalICMS_ST?: number;
  valorTotalPIS?: number;
  valorTotalCOFINS?: number;
  valorTotalIPI?: number;
  valorTotalProdutos?: number;
  valorTotalServicos?: number;
  valorTotalFrete?: number;
  valorTotalSeguro?: number;
  valorTotalDescontos?: number;
  valorTotalIPI_De?: number;
  valorTotalIPI_I?: number;
}

/**
 * Mapeamento de campos que a NF-e XML resolve mas que hoje dependem
 * de cadastro ou input manual no Quote modelo.
 *
 * Esta estrutura será usada pelo parser XML (Fase 6) para enriquecer a Quote.
 */
export interface TaxGapEnrichment {
  quoteId: string;
  /** Campos que foram preenchidos pelo documento */
  enrichedFields: {
    ncm?: string;
    cest?: string;
    cfop?: string;
    cstIcms?: string;
    csosn?: string;
    icmsRate?: number;
    icmsValue?: number;
    pisRate?: number;
    pisValue?: number;
    cofinsRate?: number;
    cofinsValue?: number;
    ipiRate?: number;
    ipiValue?: number;
    hasIcmsSt?: boolean;
    isMonophase?: boolean;
    isZeroRate?: boolean;
    isExempt?: boolean;
    isSuspended?: boolean;
    creditNature?: string;
  };
  /** Fonte do enriquecimento: XML_NFE | XML_NFCE | XML_NFS | MANUAL */
  source: 'XML_NFE' | 'XML_NFCE' | 'XML_NFS' | 'MANUAL';
  /** Data do enriquecimento */
  enrichedAt: string;
}
