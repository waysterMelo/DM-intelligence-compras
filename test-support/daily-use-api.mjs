import http from 'node:http';

const buyer = { id: 'buyer-1', name: 'RA Polymers', cnpj: '12345678000123', taxRegime: 'REAL', companyRole: 'BUYER', isActive: true };
const suppliers = [
  { id: 'supplier-1', name: 'Polímeros Brasil', cnpj: '11111111000191', taxRegime: 'REAL', companyRole: 'SUPPLIER', isActive: true },
  { id: 'supplier-2', name: 'Resinas Sul', cnpj: '22222222000191', taxRegime: 'PRESUMIDO', companyRole: 'SUPPLIER', isActive: true },
  { id: 'supplier-3', name: 'Plast Prime', cnpj: '33333333000191', taxRegime: 'SIMPLES', companyRole: 'SUPPLIER', isActive: true },
];

const selectedCompany = id => suppliers.find(company => company.id === id);
const now = new Date().toISOString();
let requisitions = [
  {
    id: 'req-resina', name: 'Resina PP H503', quantity: 1200, unit: 'kg', estimatedCost: 7.4, finalCost: null,
    requestDate: '2026-07-21', deliveryDate: null, status: 'Solicitado', department: 'Produção', priority: 'Urgente',
    requester: 'Marcos', purchaseMode: 'STRATEGIC', costReconciliationStatus: 'NOT_REQUIRED', quotes: [],
  },
  {
    id: 'req-luvas', name: 'Luvas nitrílicas', quantity: 20, unit: 'cx', estimatedCost: 38, finalCost: 38,
    requestDate: '2026-07-22', deliveryDate: null, status: 'Comprado', department: 'Manutenção', priority: 'Normal',
    requester: 'Carla', purchaseMode: 'QUICK', costReconciliationStatus: 'PENDING_INVOICE',
    quotes: [{ id: 'quote-luvas', supplierName: 'Plast Prime', companyId: 'supplier-3', company: selectedCompany('supplier-3'), price: 38, freight: 25, leadTime: 2, paymentTerms: '28 dias', isSelected: true, itemUseType: 'CONSUMPTION', grossTotalCost: 785, estimatedCreditTotal: 0, estimatedNetTotal: 785, dataCompleteness: 'INCOMPLETE', calculationSource: 'SUPPLIER_QUOTE' }],
  },
  {
    id: 'req-embalagem', name: 'Filme stretch 500 mm', quantity: 60, unit: 'rolo', estimatedCost: 72, finalCost: 68,
    requestDate: '2026-07-18', deliveryDate: null, status: 'Comprado', department: 'Logística', priority: 'Alta',
    requester: 'Lucas', purchaseMode: 'STRATEGIC', costReconciliationStatus: 'DIVERGENCE_FOUND',
    quotes: [{ id: 'quote-filme', supplierName: 'Polímeros Brasil', companyId: 'supplier-1', company: selectedCompany('supplier-1'), price: 72, freight: 120, leadTime: 4, paymentTerms: '30/60 dias', isSelected: true, itemUseType: 'INDUSTRIAL_INPUT', grossTotalCost: 4440, estimatedCreditTotal: 399.6, estimatedNetTotal: 4040.4, dataCompleteness: 'COMPLETE', calculationSource: 'SUPPLIER_QUOTE' }],
    purchaseInvoice: { id: 'invoice-filme', number: '4821', series: '1', accessKey: '1'.repeat(44), issueDate: now, supplierCnpj: '11111111000191', importSource: 'MANUAL', productTotal: 4320, freightTotal: 180, discountTotal: 0, grossTotal: 4500, icmsTotal: 518.4, ipiTotal: 0, pisTotal: 71.28, cofinsTotal: 328.32, stTotal: 0, fcpTotal: 0, difalTotal: 0, cbsTotal: 0, ibsTotal: 0, estimatedRecoverableTotal: 918, actualNetEstimatedTotal: 3582, quotedGrossTotal: 4440, quotedNetEstimatedTotal: 4040.4, quotedFreightTotal: 120, quotedTaxTotal: 799.2, actualTaxTotal: 918, freightVariance: 60, taxVariance: 118.8, grossVariance: 60, netVariance: -458.4 },
  },
];

const json = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  response.end(JSON.stringify(data));
};

const body = request => new Promise((resolve, reject) => {
  let text = '';
  request.on('data', chunk => { text += chunk; });
  request.on('end', () => {
    try { resolve(text ? JSON.parse(text) : {}); } catch (error) { reject(error); }
  });
  request.on('error', reject);
});

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const taxAmount = (price, rate, value) => value !== undefined && value !== null ? Number(value) : rate !== undefined && rate !== null ? price * Number(rate) / 100 : 0;

const calculateQuote = (requisition, quote, index) => {
  const quantity = requisition.quantity;
  const price = Number(quote.price || 0);
  const values = {
    icms: taxAmount(price, quote.icmsRate, quote.icmsValue), ipi: taxAmount(price, quote.ipiRate, quote.ipiValue),
    pis: taxAmount(price, quote.pisRate, quote.pisValue), cofins: taxAmount(price, quote.cofinsRate, quote.cofinsValue),
    st: taxAmount(price, quote.stRate, quote.stValue), fcp: taxAmount(price, quote.fcpRate, quote.fcpValue), difal: taxAmount(price, quote.difalRate, quote.difalValue),
  };
  const additional = (quote.ipiTreatment === 'INCLUDED' ? 0 : values.ipi)
    + (quote.hasIcmsSt && quote.stTreatment !== 'INCLUDED' ? values.st : 0)
    + (quote.hasFcp && quote.fcpTreatment !== 'INCLUDED' ? values.fcp : 0)
    + (quote.hasDifal && quote.difalTreatment !== 'INCLUDED' ? values.difal : 0);
  const gross = round((price + additional) * quantity + Number(quote.freight || 0));
  const recovery = quote.itemUseType === 'CONSUMPTION' ? 0 : round((values.icms + values.ipi + values.pis + values.cofins) * quantity);
  const required = ['icmsValue', 'ipiValue', 'pisValue', 'cofinsValue'];
  const missing = required.filter(key => quote[key] === undefined && quote[key.replace('Value', 'Rate')] === undefined);
  return {
    ...quote,
    id: `quote-${requisition.id}-${index}`,
    supplierName: selectedCompany(quote.companyId)?.name || quote.supplierName,
    company: selectedCompany(quote.companyId),
    grossTotalCost: gross,
    estimatedCreditTotal: recovery,
    estimatedNetTotal: round(gross - recovery),
    netCost: round((gross - recovery) / quantity),
    dataCompleteness: missing.length ? 'INCOMPLETE' : 'COMPLETE',
    calculationSource: [quote.utilizationIcms, quote.utilizationIpi, quote.utilizationPis, quote.utilizationCofins].some(value => value !== undefined) ? 'MANUAL_OVERRIDE' : 'SUPPLIER_QUOTE',
    tcoMemory: { resolvedTaxes: Object.fromEntries(Object.entries(values).map(([key, amount]) => [key, { amount, source: 'AMOUNT' }])), missingFields: missing },
  };
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, 'http://localhost:3000');
  try {
    if (request.method === 'GET' && url.pathname === '/companies') return json(response, 200, [buyer, ...suppliers]);
    if (request.method === 'GET' && url.pathname === '/companies/suppliers') return json(response, 200, suppliers);
    if (request.method === 'GET' && url.pathname === '/companies/buyer') return json(response, 200, buyer);
    if (request.method === 'GET' && url.pathname === '/companies/tco-assumptions') return json(response, 200, ['INDUSTRIAL_INPUT', 'RESALE', 'FIXED_ASSET', 'CONSUMPTION'].map(itemUseType => ({ itemUseType, icmsRecoveryPct: itemUseType === 'CONSUMPTION' ? 0 : 100, ipiRecoveryPct: itemUseType === 'CONSUMPTION' ? 0 : 100, pisRecoveryPct: itemUseType === 'CONSUMPTION' ? 0 : 100, cofinsRecoveryPct: itemUseType === 'CONSUMPTION' ? 0 : 100 })));
    if (request.method === 'PATCH' && url.pathname === '/companies/tco-assumptions') return json(response, 200, await body(request));
    if (request.method === 'POST' && url.pathname === '/auth/login') return json(response, 200, { access_token: 'daily-use-token', user: { id: 'user-1', name: 'Carlos Compras', role: 'Comprador', company: buyer } });
    if (request.method === 'GET' && url.pathname === '/requisitions') return json(response, 200, requisitions);
    if (request.method === 'GET' && url.pathname === '/stats') {
      const completed = requisitions.filter(item => ['Comprado', 'Entregue'].includes(item.status));
      return json(response, 200, { totalRequests: requisitions.length, totalSpent: completed.reduce((sum, item) => sum + (item.purchaseInvoice?.grossTotal ?? (item.finalCost || 0) * item.quantity), 0), pendingCount: requisitions.filter(item => ['Solicitado', 'Cotando'].includes(item.status)).length, completedCount: completed.length, awaitingInvoiceCount: completed.filter(item => !item.purchaseInvoice).length, invoiceDivergenceCount: completed.filter(item => item.costReconciliationStatus === 'DIVERGENCE_FOUND').length, invoiceVarianceTotal: completed.reduce((sum, item) => sum + Math.abs(item.purchaseInvoice?.grossVariance || 0), 0), averageLeadTime: 3 });
    }
    if (request.method === 'PUT' && /^\/requisitions\/[^/]+\/quotes$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      const requisition = requisitions.find(item => item.id === id);
      requisition.quotes = (await body(request)).map((quote, index) => calculateQuote(requisition, quote, index));
      requisition.status = 'Cotando';
      return json(response, 200, requisition);
    }
    if (request.method === 'PATCH' && /^\/requisitions\/[^/]+\/status$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      const data = await body(request);
      const requisition = requisitions.find(item => item.id === id);
      Object.assign(requisition, { status: data.status, finalCost: data.finalCost, paymentTerms: data.paymentTerms, costReconciliationStatus: data.status === 'Comprado' ? 'PENDING_INVOICE' : requisition.costReconciliationStatus });
      return json(response, 200, requisition);
    }
    if (request.method === 'POST' && url.pathname === '/requisitions/quick-purchase') {
      const data = await body(request);
      const supplier = selectedCompany(data.supplierId);
      const gross = round(data.unitPrice * data.quantity + Number(data.freight || 0));
      requisitions.unshift({ id: `req-quick-${Date.now()}`, name: data.name, quantity: data.quantity, unit: data.unit, estimatedCost: gross / data.quantity, finalCost: gross / data.quantity, paymentTerms: data.paymentTerms, requestDate: new Date().toISOString().slice(0, 10), deliveryDate: null, status: 'Comprado', department: data.department, priority: 'Normal', requester: data.requester || 'Compras', notes: data.notes, purchaseMode: 'QUICK', costReconciliationStatus: 'PENDING_INVOICE', quotes: [{ id: `quote-quick-${Date.now()}`, supplierName: supplier.name, companyId: supplier.id, company: supplier, price: data.unitPrice, freight: Number(data.freight || 0), paymentTerms: data.paymentTerms, isSelected: true, itemUseType: 'CONSUMPTION', grossTotalCost: gross, estimatedCreditTotal: 0, estimatedNetTotal: gross, dataCompleteness: 'INCOMPLETE' }] });
      return json(response, 201, requisitions[0]);
    }
    if (request.method === 'POST' && /^\/requisitions\/[^/]+\/invoice\/manual$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      const data = await body(request);
      const requisition = requisitions.find(item => item.id === id);
      const quote = requisition.quotes.find(item => item.isSelected) || requisition.quotes[0];
      const quotedGross = quote.grossTotalCost;
      requisition.purchaseInvoice = { id: `invoice-${id}`, ...data, importSource: 'MANUAL', estimatedRecoverableTotal: 0, actualNetEstimatedTotal: data.grossTotal, quotedGrossTotal: quotedGross, quotedNetEstimatedTotal: quote.estimatedNetTotal, quotedFreightTotal: quote.freight || 0, quotedTaxTotal: 0, actualTaxTotal: Number(data.icmsTotal || 0) + Number(data.ipiTotal || 0) + Number(data.pisTotal || 0) + Number(data.cofinsTotal || 0), freightVariance: Number(data.freightTotal || 0) - Number(quote.freight || 0), taxVariance: 0, grossVariance: data.grossTotal - quotedGross, netVariance: data.grossTotal - quote.estimatedNetTotal };
      requisition.costReconciliationStatus = Math.abs(requisition.purchaseInvoice.grossVariance) > 0.01 ? 'DIVERGENCE_FOUND' : 'INVOICE_RECEIVED';
      return json(response, 201, requisition.purchaseInvoice);
    }
    if (request.method === 'POST' && /^\/requisitions\/[^/]+\/reconcile$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      const requisition = requisitions.find(item => item.id === id);
      requisition.costReconciliationStatus = 'COST_CONFIRMED';
      return json(response, 200, requisition);
    }
    return json(response, 404, { message: 'Rota de simulação não implementada.' });
  } catch (error) {
    return json(response, 400, { message: error.message });
  }
});

server.listen(3000, '127.0.0.1', () => console.log('Daily-use API listening on http://127.0.0.1:3000'));
