import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ClerkAuthGuard, CqrsMediator, CurrentUser, AuthenticatedUser, Roles, RolesGuard, assertOrgOwnership, assertLocationAccess } from 'src/common';
import { ERole } from 'src/infrastructure/persistence/entities/role.entity';
import {
  AcceptStockTransferRequestCommand,
  CancelStockTransferRequestCommand,
  ClaimStockTransferRequestCommand,
  RaiseStockTransferRequestCommand,
} from './commands';
import { StockTransferRequest } from './domain';
import {
  AcceptStockTransferRequestRequest,
  RaiseStockTransferRequestRequest,
  StockTransferRequestResponse,
} from './models';
import {
  GetStockTransferRequestQuery,
  ListMyStockTransferRequestsQuery,
  ListOpenStockTransferRequestsQuery,
  StockTransferRequestWithFulfillability,
} from './queries';

@ApiBearerAuth()
@ApiTags('Stock Transfer Requests')
@Controller({ path: 'stock-transfer-requests', version: '1' })
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(ERole.OrgAdmin, ERole.SuperAdmin, ERole.BranchManager)
export class StockTransferRequestsController {
  constructor(
    protected readonly mediator: CqrsMediator,
    @InjectMapper() protected readonly mapper: Mapper,
    @InjectPinoLogger(StockTransferRequestsController.name) protected readonly logger: PinoLogger,
  ) {}

  @ApiOperation({ summary: "List the current store's own stock transfer requests" })
  @ApiOkResponse({ type: [StockTransferRequestResponse] })
  @ApiQuery({ name: 'locationId', description: 'The requesting store location UUID' })
  @HttpCode(HttpStatus.OK)
  @Get('mine')
  public async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId: string,
  ): Promise<StockTransferRequestResponse[]> {
    if (locationId) assertLocationAccess(user, locationId);
    const query              = new ListMyStockTransferRequestsQuery();
    query.organizationId     = user.organizationId;
    query.locationId         = locationId;
    const results = await this.mediator.execute<ListMyStockTransferRequestsQuery, StockTransferRequest[]>(query);
    return this.mapper.mapArray(results, StockTransferRequest, StockTransferRequestResponse);
  }

  @ApiOperation({ summary: "List all OPEN requests across the org (excluding caller's store), with canFulfill flag" })
  @ApiOkResponse({ type: [StockTransferRequestResponse] })
  @ApiQuery({ name: 'locationId', description: 'The viewer store location UUID (used for stock check)' })
  @HttpCode(HttpStatus.OK)
  @Get('open')
  public async listOpen(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId: string,
  ): Promise<StockTransferRequestResponse[]> {
    if (locationId) assertLocationAccess(user, locationId);
    const query                = new ListOpenStockTransferRequestsQuery();
    query.organizationId       = user.organizationId;
    query.viewerLocationId     = locationId;
    const results = await this.mediator.execute<ListOpenStockTransferRequestsQuery, StockTransferRequestWithFulfillability[]>(query);
    return results.map((result) => {
      const response          = this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
      response.canFulfill     = result.canFulfill;
      response.availableStock = result.availableStock;
      return response;
    });
  }

  @ApiOperation({ summary: 'Get a stock transfer request by ID' })
  @ApiOkResponse({ type: StockTransferRequestResponse })
  @ApiParam({ name: 'id', description: 'StockTransferRequest UUID' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  public async getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<StockTransferRequestResponse> {
    const query = new GetStockTransferRequestQuery();
    query.id    = id;
    const result = await this.mediator.execute<GetStockTransferRequestQuery, StockTransferRequest>(query);
    assertOrgOwnership(user, result.organizationId, 'stock-transfer-request');
    return this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
  }

  @ApiOperation({ summary: 'Raise a new stock transfer request' })
  @ApiCreatedResponse({ type: StockTransferRequestResponse })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  public async raise(@CurrentUser() user: AuthenticatedUser, @Body() body: RaiseStockTransferRequestRequest): Promise<StockTransferRequestResponse> {
    assertLocationAccess(user, body.requestingLocationId);
    const command              = this.mapper.map(body, RaiseStockTransferRequestRequest, RaiseStockTransferRequestCommand);
    command.organizationId     = user.organizationId;
    command.requestingUserId   = user.dbUserId;
    const result = await this.mediator.execute<RaiseStockTransferRequestCommand, StockTransferRequest>(command);
    return this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
  }

  @ApiOperation({ summary: 'Accept a stock transfer request — deducts stock from accepting store' })
  @ApiOkResponse({ type: StockTransferRequestResponse })
  @ApiParam({ name: 'id', description: 'StockTransferRequest UUID' })
  @HttpCode(HttpStatus.OK)
  @Put(':id/accept')
  public async accept(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AcceptStockTransferRequestRequest,
  ): Promise<StockTransferRequestResponse> {
    assertLocationAccess(user, body.acceptingLocationId);
    const command              = this.mapper.map(body, AcceptStockTransferRequestRequest, AcceptStockTransferRequestCommand);
    command.requestId          = id;
    command.organizationId     = user.organizationId;
    command.acceptingUserId    = user.dbUserId;
    const result = await this.mediator.execute<AcceptStockTransferRequestCommand, StockTransferRequest>(command);
    return this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
  }

  @ApiOperation({ summary: 'Claim (mark as received) an accepted stock transfer request — adds stock to requesting store' })
  @ApiOkResponse({ type: StockTransferRequestResponse })
  @ApiParam({ name: 'id', description: 'StockTransferRequest UUID' })
  @HttpCode(HttpStatus.OK)
  @Put(':id/claim')
  public async claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<StockTransferRequestResponse> {
    const query = new GetStockTransferRequestQuery();
    query.id    = id;
    const existing = await this.mediator.execute<GetStockTransferRequestQuery, StockTransferRequest>(query);
    assertOrgOwnership(user, existing.organizationId, 'stock-transfer-request');
    assertLocationAccess(user, existing.requestingLocationId);
    const command              = new ClaimStockTransferRequestCommand();
    command.requestId          = id;
    command.organizationId     = user.organizationId;
    command.claimingUserId     = user.dbUserId;
    const result = await this.mediator.execute<ClaimStockTransferRequestCommand, StockTransferRequest>(command);
    return this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
  }

  @ApiOperation({ summary: 'Cancel an OPEN stock transfer request' })
  @ApiOkResponse({ type: StockTransferRequestResponse })
  @ApiParam({ name: 'id', description: 'StockTransferRequest UUID' })
  @HttpCode(HttpStatus.OK)
  @Put(':id/cancel')
  public async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<StockTransferRequestResponse> {
    const query = new GetStockTransferRequestQuery();
    query.id    = id;
    const existing = await this.mediator.execute<GetStockTransferRequestQuery, StockTransferRequest>(query);
    assertOrgOwnership(user, existing.organizationId, 'stock-transfer-request');
    assertLocationAccess(user, existing.requestingLocationId);
    const command              = new CancelStockTransferRequestCommand();
    command.requestId          = id;
    command.organizationId     = user.organizationId;
    command.cancelledByUserId  = user.dbUserId;
    const result = await this.mediator.execute<CancelStockTransferRequestCommand, StockTransferRequest>(command);
    return this.mapper.map(result, StockTransferRequest, StockTransferRequestResponse);
  }
}
