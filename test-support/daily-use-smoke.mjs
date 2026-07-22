import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.DAILY_USE_API_URL || 'http://127.0.0.1:3000';
const mockPath = fileURLToPath(new URL('./daily-use-api.mjs', import.meta.url));

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${options.method || 'GET'} ${path}: ${payload?.message || response.status}`);
  return payload;
};

const waitForApi = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/companies`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('A API de simulação não iniciou.');
};

const mock = spawn(process.execPath, [mockPath], { stdio: 'ignore' });

try {
  await waitForApi();

  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'comprador', password: 'teste' }) });
  assert.equal(login.user.role, 'Comprador');

  const requisitions = await request('/requisitions');
  const strategic = requisitions.find(item => item.id === 'req-resina');
  assert.ok(strategic, 'A fila estratégica deve conter a compra de resina.');

  const calculated = await request(`/requisitions/${strategic.id}/quotes`, {
    method: 'PUT',
    body: JSON.stringify([{ companyId: 'supplier-1', supplierName: 'Polímeros Brasil', price: 7.2, freight: 240, leadTime: 5, paymentTerms: '30/60 dias', itemUseType: 'INDUSTRIAL_INPUT', icmsValue: 1.3, ipiValue: 0, pisValue: 0.0468, cofinsValue: 0.216, ipiTreatment: 'INCLUDED', isSelected: true }]),
  });
  assert.equal(calculated.quotes[0].dataCompleteness, 'COMPLETE');
  assert.ok(calculated.quotes[0].estimatedNetTotal < calculated.quotes[0].grossTotalCost);

  const quick = await request('/requisitions/quick-purchase', {
    method: 'POST',
    body: JSON.stringify({ name: 'Parafusos M8 inox', quantity: 100, unit: 'un', unitPrice: 1.85, freight: 20, supplierId: 'supplier-2', department: 'Manutenção', requester: 'Compras', paymentTerms: '28 dias' }),
  });
  assert.equal(quick.costReconciliationStatus, 'PENDING_INVOICE');

  const invoice = await request(`/requisitions/${quick.id}/invoice/manual`, {
    method: 'POST',
    body: JSON.stringify({ number: '9001', series: '1', accessKey: '35'.padEnd(44, '1'), issueDate: '2026-07-22', supplierCnpj: '22222222000191', productTotal: 185, freightTotal: 20, discountTotal: 0, grossTotal: 205 }),
  });
  assert.equal(invoice.grossVariance, 0);

  const reconciled = await request(`/requisitions/${quick.id}/reconcile`, { method: 'POST', body: JSON.stringify({ acceptDivergence: false }) });
  assert.equal(reconciled.costReconciliationStatus, 'COST_CONFIRMED');

  const stats = await request('/stats');
  assert.ok(stats.totalSpent > 0);
  assert.ok(Number.isFinite(stats.awaitingInvoiceCount));

  console.log('✓ login do comprador');
  console.log('✓ cotação estratégica e TCO');
  console.log('✓ compra rápida sem tributos');
  console.log('✓ recebimento e conferência da NF');
  console.log('✓ indicadores operacionais');
} finally {
  if (!mock.killed) mock.kill();
}
