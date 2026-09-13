import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository, In } from 'typeorm';
import { BaseRepo, Filter, PageableFilter } from '../../../common';
import { LocationEntity } from '../entities';
import { Location, LocationFilter } from '../../../application/modules/locations/domain';
import { ILocationRepo } from 'src/application/modules/locations';

@Injectable()
export class LocationRepo
  extends BaseRepo<LocationEntity, Location, string, PageableFilter<LocationFilter>, Filter<LocationFilter>>
  implements ILocationRepo
{
  constructor(
    @InjectRepository(LocationEntity) internalRepo: Repository<LocationEntity>,
    @InjectMapper() mapper: Mapper,
    @InjectPinoLogger(LocationRepo.name) logger: PinoLogger,
  ) {
    super(internalRepo, mapper, logger, LocationEntity, Location);
  }

  public override get idColumnName(): keyof LocationEntity {
    return 'id';
  }

  public override get softDeleteEnabled(): boolean {
    return true;
  }

  public async findIdsByBranchIdAsync(branchId: string): Promise<string[]> {
    const rows = await this.internalRepo.find({ where: { branchId }, select: ['id'] });
    return rows.map((row) => row.id);
  }

  public async findByBranchIdsAsync(branchIds: string[]): Promise<{ id: string; branchId: string }[]> {
    if (!branchIds.length) return [];
    const rows = await this.internalRepo.find({
      where: { branchId: In(branchIds) },
      select: ['id', 'branchId'],
    });
    return rows.map((row) => ({ id: row.id, branchId: row.branchId! }));
  }

  public async findIdsByBranchIdsAsync(branchIds: string[]): Promise<string[]> {
    if (!branchIds.length) return [];
    const rows = await this.internalRepo.find({
      where: { branchId: In(branchIds) },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }

  public async assignBranchAsync(branchId: string, locationIds: string[]): Promise<void> {
    if (!locationIds.length) return;
    await this.internalRepo.update({ id: In(locationIds) }, { branchId });
  }
}
