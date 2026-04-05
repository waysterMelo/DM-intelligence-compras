import { IsString, IsNumber, IsOptional, IsEnum, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class TaxItemDto {
  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional() @IsNumber()
  totalFreight?: number;

  @IsEnum(['RESALE', 'INDUSTRIAL_INPUT', 'CONSUMPTION', 'FIXED_ASSET'])
  itemUseType: 'RESALE' | 'INDUSTRIAL_INPUT' | 'CONSUMPTION' | 'FIXED_ASSET';

  @IsEnum(['RESALE', 'INSUMO', 'FREIGHT', 'ENERGY', 'DEPRECIATION', 'SERVICE', 'OTHER'])
  creditNature: 'RESALE' | 'INSUMO' | 'FREIGHT' | 'ENERGY' | 'DEPRECIATION' | 'SERVICE' | 'OTHER';

  @IsOptional() @IsString() ncm?: string;
  @IsOptional() @IsString() cfop?: string;
  @IsOptional() @IsString() cest?: string;

  @IsEnum(['INTERNAL', 'INTERSTATE'])
  operationType: 'INTERNAL' | 'INTERSTATE';

  @IsOptional() @IsString() originState?: string;
  @IsOptional() @IsString() destinationState?: string;

  @IsOptional() @IsString() cstIcms?: string;
  @IsOptional() @IsString() csosn?: string;
  @IsOptional() @IsString() cstPis?: string;
  @IsOptional() @IsString() cstCofins?: string;
  @IsOptional() @IsString() cstIpi?: string;

  @IsOptional() @IsBoolean() hasIcmsSt?: boolean;
  @IsOptional() @IsBoolean() isMonophase?: boolean;
  @IsOptional() @IsBoolean() isZeroRate?: boolean;
  @IsOptional() @IsBoolean() isSuspended?: boolean;
  @IsOptional() @IsBoolean() isExempt?: boolean;

  @IsOptional() @IsNumber() icmsRate?: number;
  @IsOptional() @IsNumber() pisRate?: number;
  @IsOptional() @IsNumber() cofinsRate?: number;
  @IsOptional() @IsNumber() ipiRate?: number;
}

export class CalculateQuoteTaxDto {
  @IsString()
  buyerCompanyId: string;

  @IsString()
  supplierCompanyId: string;

  @ValidateNested()
  @Type(() => TaxItemDto)
  item: TaxItemDto;
}
