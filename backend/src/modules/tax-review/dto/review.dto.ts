import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum ReviewReasonCode {
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  BLOCKED = 'BLOCKED',
  HIGH_TAX_DELTA = 'HIGH_TAX_DELTA',
  RULE_CONFLICT = 'RULE_CONFLICT',
  MANUAL_AUDIT_REQUESTED = 'MANUAL_AUDIT_REQUESTED',
  DOCUMENT_MISMATCH = 'DOCUMENT_MISMATCH',
  MISSING_CRITICAL_TAX_DATA = 'MISSING_CRITICAL_TAX_DATA'
}

export enum ReviewSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ReviewStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED'
}

export enum ReviewOutcome {
  CALCULATION_ACCEPTED = 'CALCULATION_ACCEPTED',
  CALCULATION_ADJUSTED = 'CALCULATION_ADJUSTED',
  CALCULATION_REJECTED = 'CALCULATION_REJECTED',
  ESCALATED = 'ESCALATED'
}

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  quoteId: string;

  @IsEnum(ReviewReasonCode)
  @IsNotEmpty()
  reasonCode: ReviewReasonCode;

  @IsString()
  @IsOptional()
  reasonText?: string;

  @IsEnum(ReviewSeverity)
  @IsOptional()
  severity?: ReviewSeverity;

  @IsString()
  @IsOptional()
  oldSnapshotId?: string;

  @IsString()
  @IsOptional()
  newSnapshotId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignReviewDto {
  @IsString()
  @IsNotEmpty()
  assignedToUserId: string;
}

export class ResolveReviewDto {
  @IsEnum(ReviewOutcome)
  @IsNotEmpty()
  outcome: ReviewOutcome;

  @IsObject()
  @IsOptional()
  adjustedValues?: Record<string, any>;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString({ each: true })
  @IsOptional()
  ruleCodes?: string[];

  @IsString()
  @IsOptional()
  legalBasisRef?: string;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

export class DismissReviewDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
