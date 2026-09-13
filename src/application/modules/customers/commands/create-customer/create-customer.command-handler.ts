import { Inject } from '@nestjs/common';
import { ICommandHandler } from '@nestjs/cqrs';
import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CommandHandlerStrict } from '../../../../../common';
import { EActivityAction } from '../../../../../infrastructure/persistence/entities/activity-log.entity';
import { CUSTOMER_REPO, CUSTOMER_TYPE_RULE_REPO } from '../../../../constants';
import { ActivityLogService } from '../../../../shared';
import { ICustomerTypeRuleRepo } from '../../../billing-settings';
import { Customer } from '../../domain';
import { ICustomerRepo } from '../../i-customer.repo';
import { CreateCustomerCommand } from './create-customer.command';

@CommandHandlerStrict(CreateCustomerCommand)
export class CreateCustomerCommandHandler implements ICommandHandler<CreateCustomerCommand, Customer> {
  constructor(
    @Inject(CUSTOMER_REPO) private readonly repo: ICustomerRepo,
    @Inject(CUSTOMER_TYPE_RULE_REPO) private readonly typeRuleRepo: ICustomerTypeRuleRepo,
    private readonly activityLog: ActivityLogService,
    @InjectMapper() private readonly mapper: Mapper,
    @InjectPinoLogger(CreateCustomerCommandHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(command: CreateCustomerCommand): Promise<Customer> {
    this.logger.info(`Executing ${CreateCustomerCommand.name}`);
    const customer = this.mapper.map(command, CreateCustomerCommand, Customer);
    if (customer.creditLimit == null && customer.customerType) {
      const rule = await this.typeRuleRepo.findOneAsync({
        organizationId: customer.organizationId,
        customerType: customer.customerType,
      });
      if (rule?.defaultCreditLimit != null) {
        customer.creditLimit = rule.defaultCreditLimit;
      }
    }
    const created = await this.repo.createAsync(customer);
    this.activityLog.record({
      action: EActivityAction.CustomerCreated,
      entityType: 'Customer',
      entityId: created.id,
      organizationId: command.organizationId,
      metadata: { name: created.name, customerType: created.customerType },
    });
    return created;
  }
}
