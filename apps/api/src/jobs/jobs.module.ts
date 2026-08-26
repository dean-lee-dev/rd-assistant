import { Module } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { JobsController } from "./jobs.controller";
import { AiQuotaGuard } from "../common/ai-quota.guard";

@Module({
    imports: [],
    controllers: [JobsController],
    providers: [JobsService, AiQuotaGuard],
})
export class JobsModule {}