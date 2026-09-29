ALTER TABLE "ReviewModerationEvent" ADD COLUMN "moderatorName" TEXT;
UPDATE "ReviewModerationEvent" event SET "moderatorName" = "User"."name" FROM "User" WHERE "User"."id" = event."moderatorId";
UPDATE "ReviewModerationEvent" SET "moderatorName" = 'Former administrator' WHERE "moderatorName" IS NULL;
ALTER TABLE "ReviewModerationEvent" ALTER COLUMN "moderatorName" SET NOT NULL;
ALTER TABLE "ReviewModerationEvent" DROP CONSTRAINT "ReviewModerationEvent_moderatorId_fkey";
ALTER TABLE "ReviewModerationEvent" ALTER COLUMN "moderatorId" DROP NOT NULL;
ALTER TABLE "ReviewModerationEvent" ADD CONSTRAINT "ReviewModerationEvent_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
