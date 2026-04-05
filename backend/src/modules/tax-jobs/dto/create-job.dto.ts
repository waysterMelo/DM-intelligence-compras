import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum, IsNumber, Min } from 'class-validator';

export enum ScopeType {
  QUOTE = 'QUOTE',
  COMPANY = 'COMPANY',
  DATE_RANGE = 'DATE_RANGE',
  ENGINE_VERSION = 'ENGINE_VERSION',
  TENANT_ALL = 'TENANT_ALL'
}

export class CreateJobDto {
  @IsEnum(ScopeType)
  @IsNotEmpty()
  scopeType: ScopeType;

  @IsObject()
  @IsOptional()
  scopePayloadJson?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  engineVersionFrom?: string;

  @IsString()
  @IsOptional()
  engineVersionTo?: string;

  // tenantId e requestedByUserId vêm do contexto autenticado,
  // mas são aceitos como opcionais para override administrativo
  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  buyerCompanyId?: string;
}

export class AuthContext {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
}
