import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789278719843 implements MigrationInterface {
    name = 'Migration1789278719843'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."locations" DROP CONSTRAINT "FK__locations__parent"`);
        await queryRunner.query(`ALTER TABLE "core"."locations" DROP COLUMN "parent_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."locations" ADD "parent_id" uuid`);
        await queryRunner.query(`ALTER TABLE "core"."locations" ADD CONSTRAINT "FK__locations__parent" FOREIGN KEY ("parent_id") REFERENCES "core"."locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
