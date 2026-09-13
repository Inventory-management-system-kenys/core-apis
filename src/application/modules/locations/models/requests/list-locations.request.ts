import { AutoMap } from '@automapper/classes';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EOrder, Filter } from 'src/common';
import { ELocationType } from 'src/infrastructure/persistence/entities';
import { LocationFilter } from '../../domain';

export class ListLocationsRequest implements Filter<LocationFilter> {
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public organizationId?: string;
  @ApiPropertyOptional({ enum: ELocationType }) @IsOptional() @IsEnum(ELocationType) @AutoMap(() => String) public type?: ELocationType;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => { if (value === 'true') return true; if (value === 'false') return false; return undefined; })
  @IsBoolean()
  @AutoMap()
  public isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString({ each: true }) @AutoMap(() => Array) public $ids?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @AutoMap() public $orderBy?: string;
  @ApiPropertyOptional({ enum: EOrder }) @IsOptional() @IsEnum(EOrder) @AutoMap(() => String) public $order?: EOrder;
}
