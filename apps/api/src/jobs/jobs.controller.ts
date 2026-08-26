import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JobsService } from "./jobs.service";
import { AiQuotaGuard } from "../common/ai-quota.guard";
import { IsOptional,IsInt  } from "class-validator";
import { Type } from "class-transformer";

export class CreateJobDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    importId?: number;

}


@Controller('jobs')
@UseGuards(AuthGuard("jwt"))
export class JobsController {

    constructor(private readonly jobsService: JobsService) {}


    @Post("weekly-report")
    @UseGuards(AiQuotaGuard)
    createJob(@Body() body: CreateJobDto) {
        return this.jobsService.createJob(body.importId);
    }

    @Get("/:id")
    getJob(@Param("id") id: string) {
        return this.jobsService.getJob(id);
    }
}