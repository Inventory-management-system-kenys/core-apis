import { AutoMap } from '@automapper/classes';
import { ELocationType } from 'src/infrastructure/persistence/entities';

export class Location {
  @AutoMap() public id: string;
  @AutoMap() public organizationId: string;
  @AutoMap() public branchId?: string;
  @AutoMap() public name: string;
  @AutoMap(() => String) public type: ELocationType;
  @AutoMap() public imageKey?: string;
  @AutoMap() public address?: string;
  @AutoMap() public city?: string;
  @AutoMap() public state?: string;
  @AutoMap() public country?: string;
  @AutoMap() public phone?: string;
  @AutoMap() public isActive: boolean;
  @AutoMap(() => Date) public createdAt?: Date;
  @AutoMap(() => Date) public updatedAt?: Date;
}

export interface LocationFilter {
  search?: string;
  type?: ELocationType;
  isActive?: boolean;
  organizationId?: string;
}
