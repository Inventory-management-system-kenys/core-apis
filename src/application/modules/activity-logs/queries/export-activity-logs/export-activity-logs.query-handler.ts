import { Inject } from '@nestjs/common';
import { IQueryHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QueryHandlerStrict } from '../../../../../common';
import { PDF_EXPORT_SERVICE, IPdfExportService, PdfDocument } from '../../../../../common';
import { ACTIVITY_LOG_REPO } from '../../../../constants';
import { IActivityLogRepo } from '../..';
import { ExportActivityLogsQuery } from './export-activity-logs.query';

@QueryHandlerStrict(ExportActivityLogsQuery)
export class ExportActivityLogsQueryHandler implements IQueryHandler<ExportActivityLogsQuery, PdfDocument> {
  public constructor(
    @Inject(ACTIVITY_LOG_REPO) private readonly repo: IActivityLogRepo,
    @Inject(PDF_EXPORT_SERVICE) private readonly pdfService: IPdfExportService,
    @InjectPinoLogger(ExportActivityLogsQueryHandler.name) private readonly logger: PinoLogger,
  ) {}

  public async execute(query: ExportActivityLogsQuery): Promise<PdfDocument> {
    this.logger.info(`Executing ${ExportActivityLogsQuery.name}`);
    const logs = await this.repo.listAllForExportAsync({
      organizationId: query.organizationId,
      action: query.action,
      userId: query.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    const rows = logs.map((log) => ({
      when: log.createdAt ? new Date(log.createdAt).toLocaleString('en-KE') : '—',
      action: log.action,
      entityType: log.entityType ?? '—',
      entityId: log.entityId ? `#${log.entityId.slice(-6).toUpperCase()}` : '—',
      actorName: log.actorName ?? log.userId ?? '—',
    }));

    const dateLabel = [query.dateFrom, query.dateTo].filter(Boolean).join(' → ') || 'All dates';
    const filename = `activity-log-${Date.now()}.pdf`;

    return this.pdfService.generateFromTemplateAsync('activity-log', { rows, dateLabel }, filename);
  }
}
