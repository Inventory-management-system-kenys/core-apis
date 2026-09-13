import { createMap, Mapper } from '@automapper/core';
import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { Injectable } from '@nestjs/common';
import { ActivityLogEntity } from '../../../../infrastructure/persistence/entities/activity-log.entity';
import { ActivityLog } from '../domain';
import { ActivityLogResponse } from '../models';

@Injectable()
export class ActivityLogProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) { super(mapper); }

  public get profile() {
    return (mapper: Mapper) => {
      createMap(mapper, ActivityLogEntity, ActivityLog);
      createMap(mapper, ActivityLog, ActivityLogResponse);
    };
  }
}
