import { Module } from "@nestjs/common";
import { Job, Worker } from "bullmq"
import { WorktimeService } from "./worktime/worktime.service";
import { WorktimeModule } from "./worktime/worktime.module";
import { PrismaModule } from "./prisma/prisma.module";
import Redis from "ioredis";
@Module({
    imports: [
        WorktimeModule,
        PrismaModule
    ],
  })
  export class WorkerModule {
    private worker!: Worker;
    constructor(
        private readonly worktimeService: WorktimeService
    ) {
    }

    onModuleInit() {
        this.worker = new Worker("weekly-report", (job)=>{
            return this.handleJob(job);
        }, {
            connection: new Redis(process.env.REDIS_URL as string, {
                maxRetriesPerRequest: null
            })
        });
    }

    private async handleJob(job: Job) {
        const { importId } = job.data;
        const report = await this.worktimeService.generateReport(importId);
        return {
            reportId: report.id
        };
    }

    onModuleDestroy() {
        this.worker.close();
    }
  }