import { Controller, Post, UseGuards, Body, Res, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport"
import { TicksService } from "./ticks.service";
import type { FastifyReply } from "fastify";
import { endSse, initSse, writeSse } from "../common/sse";
import { AiQuotaGuard } from "../common/ai-quota.guard";

@Controller('ticks')
@UseGuards(AuthGuard("jwt"))
export class TicksController {
    constructor(private readonly ticksService: TicksService) {}
    
    @Post("/stream")
    @UseGuards(AiQuotaGuard)
    async stream(
        @Body() body: { n?: number },
        @Res() reply: FastifyReply,
    ) {
        
        const n = body?.n === undefined ? 5 : Number(body?.n);

        if ( !Number.isInteger(n) || n < 1 || n > 20 ) {
            throw new BadRequestException("n 必须是 1 到 20 之间的整数");
        }

        initSse(reply);
        try {
            for await (const ev of this.ticksService.stream(n)) {
                writeSse(reply, ev);
            }
            endSse(reply);
        } catch (error) {
            writeSse(reply, { type: 'error', message: '流式输出失败' });
            endSse(reply);
        }
    }

}