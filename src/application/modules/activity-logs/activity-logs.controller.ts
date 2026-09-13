import { Controller, Get, HttpCode, HttpStatus, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Response } from 'express';
import { AuthenticatedUser, ClerkAuthGuard, CqrsMediator, CurrentUser, assertOrgOwnership, requireOrganizationId } from '../../../common';
import { ActivityLog } from './domain';
import { ActivityLogResponse, PaginatedActivityLogResponse } from './models';
import { GetActivityLogQuery, ListActivityLogsQuery, ExportActivityLogsQuery } from './queries';
import { EActivityAction } from '../../../infrastructure/persistence/entities/activity-log.entity';
import { PdfDocument } from '../../../common';

@ApiBearerAuth()
@ApiTags('ActivityLogs')
@UseGuards(ClerkAuthGuard)
@Controller({ path: 'activity-logs', version: '1' })
export class ActivityLogsController {
  constructor(
    protected readonly mediator: CqrsMediator,
    @InjectPinoLogger(ActivityLogsController.name) protected readonly logger: PinoLogger,
  ) {}

  @ApiOperation({ summary: 'List activity logs with filters and pagination' })
  @ApiOkResponse({ type: PaginatedActivityLogResponse })
  @ApiQuery({ name: 'action', required: false, isArray: true, enum: EActivityAction })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @HttpCode(HttpStatus.OK)
  @Get('list')
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('action') action?: EActivityAction | EActivityAction[],
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedActivityLogResponse> {
    const query = new ListActivityLogsQuery();
    query.organizationId = requireOrganizationId(user);
    query.action = action ? (Array.isArray(action) ? action : [action]) : undefined;
    query.userId = userId;
    query.dateFrom = dateFrom;
    query.dateTo = dateTo;
    query.page = page ? parseInt(page, 10) : undefined;
    query.limit = limit ? parseInt(limit, 10) : undefined;
    return this.mediator.execute<ListActivityLogsQuery, PaginatedActivityLogResponse>(query);
  }

  @ApiOperation({ summary: 'Export activity logs as PDF' })
  @ApiQuery({ name: 'action', required: false, isArray: true, enum: EActivityAction })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @HttpCode(HttpStatus.OK)
  @Get('export')
  public async export(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('action') action?: EActivityAction | EActivityAction[],
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<void> {
    const query = new ExportActivityLogsQuery();
    query.organizationId = requireOrganizationId(user);
    query.action = action ? (Array.isArray(action) ? action : [action]) : undefined;
    query.userId = userId;
    query.dateFrom = dateFrom;
    query.dateTo = dateTo;
    const doc: PdfDocument = await this.mediator.execute<ExportActivityLogsQuery, PdfDocument>(query);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${doc.filename}"` });
    res.send(doc.buffer);
  }

  @ApiOperation({ summary: 'Get activity log by ID' })
  @ApiOkResponse({ type: ActivityLogResponse })
  @ApiParam({ name: 'id', description: 'ActivityLog UUID' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  public async getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<ActivityLogResponse> {
    const query = new GetActivityLogQuery();
    query.id = id;
    const result = await this.mediator.execute<GetActivityLogQuery, ActivityLog>(query);
    assertOrgOwnership(user, result.organizationId, 'activity-log');
    return result as unknown as ActivityLogResponse;
  }
}
