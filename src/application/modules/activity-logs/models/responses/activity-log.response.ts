import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityLogResponse {
  @ApiProperty() @AutoMap() public id: string;
  @ApiProperty() @AutoMap() public organizationId: string;
  @ApiPropertyOptional() @AutoMap() public userId?: string;
  @ApiPropertyOptional() @AutoMap() public locationId?: string;
  @ApiProperty() @AutoMap(() => String) public action: string;
  @ApiPropertyOptional() @AutoMap() public entityType?: string;
  @ApiPropertyOptional() @AutoMap() public entityId?: string;
  @ApiPropertyOptional() @AutoMap() public actorName?: string;
  @ApiPropertyOptional() @AutoMap() public ipAddress?: string;
  @ApiPropertyOptional() @AutoMap() public userAgent?: string;
  @ApiPropertyOptional() @AutoMap() public metadata?: Record<string, unknown>;
  @ApiPropertyOptional() @AutoMap(() => Date) public createdAt?: Date;
}

export class PaginatedActivityLogResponse {
  @ApiProperty({ type: [ActivityLogResponse] }) public data: ActivityLogResponse[];
  @ApiProperty() public total: number;
  @ApiProperty() public page: number;
  @ApiProperty() public totalPages: number;
}
