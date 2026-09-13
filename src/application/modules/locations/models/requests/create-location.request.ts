import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ELocationType } from 'src/infrastructure/persistence/entities';

export class CreateLocationRequest {
  @ApiProperty() @IsNotEmpty() @IsString() @AutoMap() public name: string;
  @ApiProperty({ enum: ELocationType }) @IsEnum(ELocationType) @AutoMap(() => String) public type: ELocationType;
  @ApiProperty() @IsUUID() @AutoMap() public branchId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public phone?: string;
  @ApiPropertyOptional({ description: 'Required when the caller is SuperAdmin (org-less). Ignored for org-scoped callers.' })
  @IsOptional() @IsUUID() @AutoMap() public organizationId?: string;
}
