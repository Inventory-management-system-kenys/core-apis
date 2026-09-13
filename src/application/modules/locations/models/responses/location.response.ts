import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ELocationType } from 'src/infrastructure/persistence/entities';

export class LocationResponse {
  @ApiProperty() @AutoMap() public id: string;
  @ApiProperty() @AutoMap() public organizationId: string;
  @ApiPropertyOptional() @AutoMap() public branchId?: string;
  @ApiProperty() @AutoMap() public name: string;
  @ApiProperty({ enum: ELocationType }) @AutoMap(() => String) public type: ELocationType;
  @ApiPropertyOptional() @AutoMap() public imageKey?: string;
  @ApiPropertyOptional() @AutoMap() public address?: string;
  @ApiPropertyOptional() @AutoMap() public city?: string;
  @ApiPropertyOptional() @AutoMap() public state?: string;
  @ApiPropertyOptional() @AutoMap() public country?: string;
  @ApiPropertyOptional() @AutoMap() public phone?: string;
  @ApiProperty() @AutoMap() public isActive: boolean;
  @ApiPropertyOptional() @AutoMap(() => Date) public createdAt?: Date;
  @ApiPropertyOptional() @AutoMap(() => Date) public updatedAt?: Date;
}

export class LocationsPagedResponse {
  @ApiProperty({ type: [LocationResponse] }) public items: LocationResponse[];
  @ApiProperty() public page: number;
  @ApiProperty() public perPage: number;
  @ApiProperty() public totalCount: number;
  @ApiProperty() public totalPages: number;
}
