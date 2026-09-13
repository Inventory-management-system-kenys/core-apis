import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared';
import { CLERK_SERVICE, ClerkService } from '../../../common';
import { UsersController } from './users.controller';
import { UserCommandHandlers } from './commands';
import { UserQueryHandlers } from './queries';
import { UserProfile } from './mapper';

@Module({
  imports:     [CqrsModule, SharedModule],
  controllers: [UsersController],
  providers:   [
    { provide: CLERK_SERVICE, useClass: ClerkService },
    ...UserCommandHandlers,
    ...UserQueryHandlers,
    UserProfile,
  ],
})
export class UsersModule {}
