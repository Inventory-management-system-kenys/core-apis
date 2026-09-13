import { createMap, forMember, mapFrom, Mapper } from '@automapper/core';
import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { Injectable } from '@nestjs/common';
import { ActivityLogEntity } from '../../../../infrastructure/persistence/entities/activity-log.entity';
import { ActivityLog } from '../domain';
import { CreateActivityLogRequest, ActivityLogResponse } from '../models';
import { CreateActivityLogCommand } from '../commands';

@Injectable()
export class ActivityLogProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) { super(mapper); }

  public get profile() {
    return (mapper: Mapper) => {
      createMap(
        mapper,
        ActivityLogEntity,
        ActivityLog,
        forMember((d) => d.entityName, mapFrom((s) => s.entityType ?? '')),
        forMember((d) => d.details, mapFrom((s) => s.metadata)),
      );
      createMap(
        mapper,
        ActivityLog,
        ActivityLogEntity,
        forMember((d) => d.entityType, mapFrom((s) => s.entityName)),
        forMember((d) => d.metadata, mapFrom((s) => s.details)),
      );
      createMap(mapper, CreateActivityLogRequest, CreateActivityLogCommand);
      createMap(mapper, ActivityLog, ActivityLogResponse);
    };
  }
}
