import { Module } from "@nestjs/common";
import { TicksController } from "./ticks.controller";
import { TicksService } from "./ticks.service";

@Module({
    controllers: [TicksController],
    providers: [TicksService],
    imports: [],
})
export class TicksModule {}