ALTER TABLE "link" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "link" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "link" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "link_owner_name_unique" ON "link" USING btree ("owner_id","name") WHERE "link"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "link_owner_created_idx" ON "link" USING btree ("owner_id","created_at");