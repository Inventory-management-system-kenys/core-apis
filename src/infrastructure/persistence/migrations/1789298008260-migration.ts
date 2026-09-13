import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789298008260 implements MigrationInterface {
    name = 'Migration1789298008260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "core"."deployment_checks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "label" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_deployment_checks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "core"."activity_logs" ADD "actor_name" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "core"."locations" ADD "parent_id" uuid`);
        await queryRunner.query(`ALTER TYPE "core"."activity_logs_action_enum" RENAME TO "activity_logs_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "core"."activity_logs_action_enum" AS ENUM('auth.login', 'auth.logout', 'auth.login_failed', 'product.created', 'product.updated', 'product.deleted', 'product.enabled', 'product.disabled', 'product.price_changed', 'stock.added', 'stock.removed', 'stock.adjusted', 'stock.transferred', 'stock.damaged', 'stock.written_off', 'stock.reserved', 'stock.reservation_released', 'sale.created', 'sale.confirmed', 'sale.voided', 'sale.payment_received', 'sale.refunded', 'purchase_order.created', 'purchase_order.sent', 'purchase_order.goods_received', 'purchase_order.cancelled', 'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.voided', 'bill.created', 'bill.paid', 'customer.created', 'customer.updated', 'customer.credit_limit_changed', 'customer.deactivated', 'supplier.created', 'supplier.updated', 'supplier.deactivated', 'user.created', 'user.updated', 'user.role_changed', 'user.deactivated', 'user.reactivated', 'branch.created', 'branch.updated', 'report.generated', 'report.exported', 'org.settings_updated', 'org.module_toggled', 'org.billing_changed')`);
        await queryRunner.query(`ALTER TABLE "core"."activity_logs" ALTER COLUMN "action" TYPE "core"."activity_logs_action_enum" USING "action"::"text"::"core"."activity_logs_action_enum"`);
        await queryRunner.query(`DROP TYPE "core"."activity_logs_action_enum_old"`);
        await queryRunner.query(`ALTER TABLE "core"."locations" ADD CONSTRAINT "FK__locations__parent" FOREIGN KEY ("parent_id") REFERENCES "core"."locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."locations" DROP CONSTRAINT "FK__locations__parent"`);
        await queryRunner.query(`CREATE TYPE "core"."activity_logs_action_enum_old" AS ENUM('add_stock', 'adjust_stock', 'cancel_purchase_order', 'create_product', 'create_purchase_order', 'create_store', 'create_user', 'deactivate_user', 'delete_product', 'login', 'logout', 'receive_purchase_order', 'remove_stock', 'transfer_stock', 'update_product', 'update_store', 'update_user')`);
        await queryRunner.query(`ALTER TABLE "core"."activity_logs" ALTER COLUMN "action" TYPE "core"."activity_logs_action_enum_old" USING "action"::"text"::"core"."activity_logs_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "core"."activity_logs_action_enum"`);
        await queryRunner.query(`ALTER TYPE "core"."activity_logs_action_enum_old" RENAME TO "activity_logs_action_enum"`);
        await queryRunner.query(`ALTER TABLE "core"."locations" DROP COLUMN "parent_id"`);
        await queryRunner.query(`ALTER TABLE "core"."activity_logs" DROP COLUMN "actor_name"`);
        await queryRunner.query(`DROP TABLE "core"."deployment_checks"`);
    }

}
