import { Module } from "@nestjs/common";
import { TicksController } from "./ticks.controller";
import { TicksService } from "./ticks.service";
import { AiQuotaGuard } from "../common/ai-quota.guard";
@Module({
    controllers: [TicksController],
    providers: [TicksService, AiQuotaGuard ],
    imports: [],
})
export class TicksModule {}