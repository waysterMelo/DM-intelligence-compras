import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NfeXmlService } from '../src/modules/requisitions/nfe-xml.service';

const accessKey = () => {
  const prefix = '35'.padEnd(43, '1');
  const sum = prefix.split('').map(Number).reverse().reduce((total, digit, index) => total + digit * ((index % 8) + 2), 0);
  const remainder = sum % 11;
  return prefix + (remainder === 0 || remainder === 1 ? 0 : 11 - remainder);
};

const xml = (key: string, model = '55') => `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${key}" versao="4.00">
    <ide><mod>${model}</mod><serie>1</serie><nNF>123</nNF><dhEmi>2026-07-22T10:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000123</CNPJ></emit>
    <total><ICMSTot><vProd>100.00</vProd><vFrete>10.00</vFrete><vICMS>18.00</vICMS><vNF>110.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

describe('Importação de XML da NF-e', () => {
  const parser = new NfeXmlService();

  it('extrai os totais de uma NF-e 4.0 válida', () => {
    const result = parser.parse(Buffer.from(xml(accessKey())));
    assert.equal(result.number, '123');
    assert.equal(result.supplierCnpj, '12345678000123');
    assert.equal(result.grossTotal, 110);
    assert.equal(result.icmsTotal, 18);
  });

  it('recusa chave inválida', () => {
    assert.throws(() => parser.parse(Buffer.from(xml('1'.repeat(44)))), /Chave de acesso/);
  });

  it('recusa documento que não seja NF-e modelo 55', () => {
    assert.throws(() => parser.parse(Buffer.from(xml(accessKey(), '65'))), /modelo 55/);
  });

  it('recusa declaração externa no XML', () => {
    assert.throws(() => parser.parse(Buffer.from(`<!DOCTYPE NFe [<!ENTITY xxe SYSTEM "file:///tmp/a">]>${xml(accessKey())}`)), /declarações externas/);
  });
});
