import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class NfeXmlService {
  private decode(value: string) {
    return value
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  private scope(xml: string, tag: string) {
    const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i'));
    return match?.[1] || '';
  }

  private tag(xml: string, tag: string) {
    const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i'));
    return match ? this.decode(match[1].trim()) : '';
  }

  private number(xml: string, tag: string) {
    const value = Number(this.tag(xml, tag).replace(',', '.'));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  validateAccessKey(key: string) {
    if (!/^\d{44}$/.test(key)) return false;
    const digits = key.slice(0, 43).split('').map(Number).reverse();
    const sum = digits.reduce((total, digit, index) => total + digit * ((index % 8) + 2), 0);
    const remainder = sum % 11;
    const expected = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
    return expected === Number(key[43]);
  }

  parse(buffer: Buffer) {
    if (!buffer?.length) throw new BadRequestException('Arquivo XML não informado.');
    if (buffer.length > 2 * 1024 * 1024) throw new BadRequestException('O XML deve ter no máximo 2 MB.');
    const xml = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!xml.includes('<') || !/<(?:\w+:)?NFe[\s>]/i.test(xml)) {
      throw new BadRequestException('O arquivo não contém uma NF-e válida.');
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new BadRequestException('XML com declarações externas não é permitido.');
    }

    const infMatch = xml.match(/<(?:\w+:)?infNFe\b[^>]*\bId=["']NFe(\d{44})["']/i);
    const protocolKey = this.tag(this.scope(xml, 'infProt'), 'chNFe');
    const accessKey = infMatch?.[1] || protocolKey.replace(/\D/g, '');
    if (!this.validateAccessKey(accessKey)) throw new BadRequestException('Chave de acesso da NF-e inválida.');

    const ide = this.scope(xml, 'ide');
    const emit = this.scope(xml, 'emit');
    const total = this.scope(xml, 'ICMSTot');
    const reformTotal = this.scope(xml, 'IBSCBSTot');
    if (this.tag(ide, 'mod') !== '55') throw new BadRequestException('O XML deve ser de NF-e modelo 55.');
    const issueDateText = this.tag(ide, 'dhEmi') || this.tag(ide, 'dEmi');
    const issueDate = new Date(issueDateText);
    if (Number.isNaN(issueDate.getTime())) throw new BadRequestException('Data de emissão inválida no XML.');

    const supplierCnpj = this.tag(emit, 'CNPJ').replace(/\D/g, '');
    if (supplierCnpj.length !== 14) throw new BadRequestException('CNPJ do emitente inválido no XML.');
    const grossTotal = this.number(total, 'vNF');
    if (grossTotal <= 0) throw new BadRequestException('Valor total da NF-e inválido.');

    return {
      number: this.tag(ide, 'nNF'),
      series: this.tag(ide, 'serie') || null,
      accessKey,
      issueDate,
      supplierCnpj,
      productTotal: this.number(total, 'vProd'),
      freightTotal: this.number(total, 'vFrete'),
      discountTotal: this.number(total, 'vDesc'),
      grossTotal,
      icmsTotal: this.number(total, 'vICMS'),
      ipiTotal: this.number(total, 'vIPI'),
      pisTotal: this.number(total, 'vPIS'),
      cofinsTotal: this.number(total, 'vCOFINS'),
      stTotal: this.number(total, 'vST'),
      fcpTotal: this.number(total, 'vFCP') + this.number(total, 'vFCPST'),
      difalTotal: this.number(total, 'vICMSUFDest'),
      cbsTotal: this.number(reformTotal, 'vCBS'),
      ibsTotal: this.number(reformTotal, 'vIBS'),
      xmlContent: xml,
    };
  }
}
