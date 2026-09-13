import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ClerkAuthGuard, CqrsMediator, RolesGuard, CurrentUser, AuthenticatedUser, assertOrgOwnership } from '../../../common';
import { GetLocationQuery } from '../locations/queries';
import { Location } from '../locations/domain';
import { GetOrderQuery } from '../orders/queries';
import { Order } from '../orders/domain';
import { CreateInvoiceCommand } from './commands';
import { Invoice } from './domain';
import { CreateInvoiceRequest, InvoiceResponse } from './models';
import { GetInvoiceQuery } from './queries';

@ApiBearerAuth()
@ApiTags('Invoices')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    protected readonly mediator: CqrsMediator,
    @InjectMapper() protected readonly mapper: Mapper,
    @InjectPinoLogger(InvoicesController.name) protected readonly logger: PinoLogger,
  ) {}

  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiOkResponse({ type: InvoiceResponse })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  public async getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<InvoiceResponse> {
    const query = new GetInvoiceQuery();
    query.id = id;
    const result = await this.mediator.execute<GetInvoiceQuery, Invoice>(query);

    const orderQuery = new GetOrderQuery();
    orderQuery.id = result.orderId;
    const order = await this.mediator.execute<GetOrderQuery, Order>(orderQuery);

    const locationQuery = new GetLocationQuery();
    locationQuery.id = order.locationId;
    const location = await this.mediator.execute<GetLocationQuery, Location>(locationQuery);
    assertOrgOwnership(user, location.organizationId, 'invoice');

    return this.mapper.map(result, Invoice, InvoiceResponse);
  }

  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiCreatedResponse({ type: InvoiceResponse })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  public async create(@Body() body: CreateInvoiceRequest, @CurrentUser() user: AuthenticatedUser): Promise<InvoiceResponse> {
    const command = this.mapper.map(body, CreateInvoiceRequest, CreateInvoiceCommand);

    const orderQuery = new GetOrderQuery();
    orderQuery.id = command.orderId;
    const order = await this.mediator.execute<GetOrderQuery, Order>(orderQuery);

    const locationQuery = new GetLocationQuery();
    locationQuery.id = order.locationId;
    const location = await this.mediator.execute<GetLocationQuery, Location>(locationQuery);
    assertOrgOwnership(user, location.organizationId, 'invoice');
    command.organizationId = location.organizationId;
    command.actorId = user.dbUserId;

    const result  = await this.mediator.execute<CreateInvoiceCommand, Invoice>(command);
    return this.mapper.map(result, Invoice, InvoiceResponse);
  }
}
