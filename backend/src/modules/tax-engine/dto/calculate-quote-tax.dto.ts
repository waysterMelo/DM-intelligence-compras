import { IsString, IsNumber, IsOptional, IsIn, ValidateNested, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class TaxItemDto {
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional() @IsNumber() @Min(0)
  totalFreight?: number;

  @IsIn(['RESALE', 'INDUSTRIAL_INPUT', 'CONSUMPTION', 'FIXED_ASSET'])
  itemUseType: 'RESALE' | 'INDUSTRIAL_INPUT' | 'CONSUMPTION' | 'FIXED_ASSET';

  @IsIn(['RESALE', 'INSUMO', 'FREIGHT', 'ENERGY', 'DEPRECIATION', 'SERVICE', 'OTHER'])
  creditNature: 'RESALE' | 'INSUMO' | 'FREIGHT' | 'ENERGY' | 'DEPRECIATION' | 'SERVICE' | 'OTHER';

  @IsOptional() @IsString() ncm?: string;
  @IsOptional() @IsString() cfop?: string;
  @IsOptional() @IsString() cest?: string;

  @IsIn(['INTERNAL', 'INTERSTATE'])
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

  @IsOptional() @IsNumber() @Min(0) @Max(100) icmsRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) pisRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) cofinsRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ipiRate?: number;
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
