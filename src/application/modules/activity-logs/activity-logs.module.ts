import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogQueryHandlers } from './queries';
import { ActivityLogProfile } from './mapper';

@Module({
  imports:     [CqrsModule, SharedModule],
  controllers: [ActivityLogsController],
  providers:   [
    ...ActivityLogQueryHandlers,
    ActivityLogProfile,
  ],
})
export class ActivityLogsModule {}
