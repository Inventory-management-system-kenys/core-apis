import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateActivityLogRequest {
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() @AutoMap() public userId?: string;
  @ApiProperty() @IsNotEmpty() @IsString() @AutoMap() public action: string;
  @ApiProperty() @IsNotEmpty() @IsString() @AutoMap() public entityName: string;
  @ApiProperty() @IsNotEmpty() @IsString() @AutoMap() public entityId: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() @AutoMap() public details?: Record<string, any>;
}
