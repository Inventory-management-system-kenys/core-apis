import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityLogResponse {
  @ApiProperty() @AutoMap() public id: string;
  @ApiProperty() @AutoMap() public organizationId: string;
  @ApiPropertyOptional() @AutoMap() public userId?: string;
  @ApiProperty() @AutoMap() public action: string;
  @ApiProperty() @AutoMap() public entityName: string;
  @ApiProperty() @AutoMap() public entityId: string;
  @ApiPropertyOptional() @AutoMap() public details?: Record<string, any>;
  @ApiPropertyOptional() @AutoMap(() => Date) public createdAt?: Date;
}
