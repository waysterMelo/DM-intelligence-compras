import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  reason: string;

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
