import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import {
  EBillStatus,
  ECustomerType,
  EPaymentMethod,
  EPaymentTiming,
  ESaleType,
} from '../../../../../infrastructure/persistence/entities';
import { CreateBillItemRequest } from './bill-item.request';

export class CreateBillRequest {
  @ApiProperty() @IsUUID() @AutoMap() public locationId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public walkInName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public walkInPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public walkInGstin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public notes?: string;
  @ApiPropertyOptional({ enum: EPaymentMethod }) @IsOptional() @IsEnum(EPaymentMethod) @AutoMap(() => String) public paymentMethod?: EPaymentMethod;
  @ApiPropertyOptional({ enum: ESaleType, default: ESaleType.Normal }) @IsOptional() @IsEnum(ESaleType) @AutoMap(() => String) public saleType?: ESaleType;
  @ApiPropertyOptional({ enum: ECustomerType }) @IsOptional() @IsEnum(ECustomerType) @AutoMap(() => String) public customerType?: ECustomerType;
  @ApiPropertyOptional({ enum: EPaymentTiming }) @IsOptional() @IsEnum(EPaymentTiming) @AutoMap(() => String) public paymentTiming?: EPaymentTiming;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @AutoMap() public partialAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public facilitatorUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public facilitatorName?: string;
  @ApiPropertyOptional({ description: 'Commission % of the black markup, e.g. 30 = 30%. Only used when saleType=black and a facilitator is set.' })
  @IsOptional() @IsNumber() public commissionPct?: number;

  // Empty is legal: the Bills screen creates the header first, then adds lines
  // via POST :id/items. The POS terminal sends the full basket up front.
  @ApiProperty({ type: [CreateBillItemRequest] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBillItemRequest)
  @AutoMap(() => [CreateBillItemRequest])
  public items: CreateBillItemRequest[];
}

/** Header-only patch. Nulls are meaningful — they clear the field. */
export class UpdateBillRequest {
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public locationId?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @AutoMap() public customerId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @AutoMap() public walkInName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @AutoMap() public walkInPhone?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @AutoMap() public walkInGstin?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @AutoMap() public notes?: string | null;
}

export class TransitionBillStatusRequest {
  @ApiProperty({ enum: EBillStatus }) @IsEnum(EBillStatus) @AutoMap() public status: EBillStatus;
  @ApiPropertyOptional({ enum: EPaymentMethod }) @IsOptional() @IsEnum(EPaymentMethod) @AutoMap() public paymentMethod?: EPaymentMethod;
}

export class ListBillsRequest {
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public createdById?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public billNumber?: string;
  @ApiPropertyOptional({ enum: EBillStatus }) @IsOptional() @IsEnum(EBillStatus) @AutoMap() public status?: EBillStatus;
  @ApiPropertyOptional({ enum: EPaymentMethod }) @IsOptional() @IsEnum(EPaymentMethod) @AutoMap() public paymentMethod?: EPaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public $orderBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public $order?: string;
}

export class SearchBillsRequest extends ListBillsRequest {
  // @Type(() => Number) is required: query params arrive as strings and @IsInt would 400 without it.
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @AutoMap() public $page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @AutoMap() public $perPage?: number;
}
