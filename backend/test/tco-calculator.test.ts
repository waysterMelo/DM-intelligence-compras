import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTco } from '../src/modules/tco/tco-calculator';

const fullRecovery = { icms: 100, ipi: 100, pis: 100, cofins: 100 };
const base = {
  companyId: 'supplier-1',
  itemUseType: 'INDUSTRIAL_INPUT',
  quantity: 10,
  price: 100,
  freight: 50,
  ipiTreatment: 'INCLUDED',
  icmsValue: 0,
  ipiValue: 0,
  pisValue: 0,
  cofinsValue: 0,
};

describe('Simulador centralizado de TCO', () => {
  it('faz o valor monetário informado prevalecer sobre a alíquota', () => {
    const result = calculateTco({ ...base, icmsRate: 18, icmsValue: 10 }, fullRecovery);
    assert.equal(result.credits.icms, 100);
    assert.equal(result.estimatedNetTotal, 950);
  });

  it('não soma novamente um tributo marcado como incluído no preço', () => {
    const result = calculateTco({ ...base, ipiRate: 10, ipiValue: 10, ipiTreatment: 'INCLUDED' }, { icms: 0, ipi: 0, pis: 0, cofins: 0 });
    assert.equal(result.grossTotalCost, 1050);
  });

  it('soma o tributo adicional ao preço e à quantidade', () => {
    const result = calculateTco({ ...base, ipiValue: 10, ipiTreatment: 'ADDITIONAL' }, { icms: 0, ipi: 0, pis: 0, cofins: 0 });
    assert.equal(result.grossTotalCost, 1150);
  });

  it('marca a cotação incompleta e não cria recuperação para dados ausentes', () => {
    const result = calculateTco({ companyId: 'supplier-1', itemUseType: 'INDUSTRIAL_INPUT', quantity: 2, price: 100, ipiTreatment: 'INCLUDED' }, fullRecovery);
    assert.equal(result.dataCompleteness, 'INCOMPLETE');
    assert.equal(result.estimatedCreditTotal, 0);
    assert.ok(result.missingFields.includes('ICMS'));
  });

  it('registra o ajuste por cotação como premissa comercial', () => {
    const result = calculateTco({ ...base, utilizationIcms: 50 }, fullRecovery);
    assert.equal(result.calculationSource, 'MANUAL_OVERRIDE');
  });
});
