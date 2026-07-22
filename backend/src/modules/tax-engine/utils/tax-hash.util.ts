import * as crypto from 'crypto';
import { CalculateQuoteTaxDto } from '../dto/calculate-quote-tax.dto';

export const HASH_SCHEMA_VERSION = '1.0';

export class TaxHashUtil {
  /**
   * Extrai um Payload Canônico, ignora campos irrelevantes e sorteia as chaves alfabeticamente
   * pra garantir que A e B batam o mesmo Hash sempre que o fiscal bater igual.
   */
  static generateDeterministicHash(dto: CalculateQuoteTaxDto): { hash: string, algorithm: string, version: string, inputJson: any } {
    const canonicalPayload = {
      buyerCompanyId: dto.buyerCompanyId,
      supplierCompanyId: dto.supplierCompanyId,
      item: {
        quantity: dto.item.quantity,
        unitPrice: dto.item.unitPrice,
        totalFreight: dto.item.totalFreight || 0,
        itemUseType: dto.item.itemUseType,
        creditNature: dto.item.creditNature,
        operationType: dto.item.operationType,
        ncm: dto.item.ncm || null,
        cfop: dto.item.cfop || null,
        cest: dto.item.cest || null,
        hasIcmsSt: dto.item.hasIcmsSt || false,
        isMonophase: dto.item.isMonophase || false,
        isZeroRate: dto.item.isZeroRate || false,
        isSuspended: dto.item.isSuspended || false,
        isExempt: dto.item.isExempt || false,
        icmsRate: dto.item.icmsRate || 0,
        pisRate: dto.item.pisRate || 0,
        cofinsRate: dto.item.cofinsRate || 0,
        ipiRate: dto.item.ipiRate || 0,
      }
    };

    // Função recursiva para ordenar as chaves
    const sortObjectKeys = (obj: any): any => {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
      }
      return Object.keys(obj)
        .sort()
        .reduce((sorted: any, key: string) => {
          sorted[key] = sortObjectKeys(obj[key]);
          return sorted;
        }, {});
    };

    const sortedPayload = sortObjectKeys(canonicalPayload);
    const canonicalString = JSON.stringify(sortedPayload);
    const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');

    return {
      hash,
      algorithm: 'SHA-256',
      version: HASH_SCHEMA_VERSION,
      inputJson: sortedPayload // Mantem o clone limpo para salvar no DB como a versão canônica
    };
  }
}
