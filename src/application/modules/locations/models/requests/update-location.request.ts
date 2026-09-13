import { AutoMap } from '@automapper/classes';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ELocationType } from 'src/infrastructure/persistence/entities';

export class UpdateLocationRequest {
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public name?: string;
  @ApiPropertyOptional({ enum: ELocationType }) @IsOptional() @IsEnum(ELocationType) @AutoMap(() => String) public type?: ELocationType;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @AutoMap() public isActive?: boolean;
}
