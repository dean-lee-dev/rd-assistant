import { Injectable, NotFoundException } from "@nestjs/common";
import { JobState } from "bullmq";
import { WeeklyReportQueue } from "../queue/weeklyreport.quene";

@Injectable()
export class JobsService {
    async createJob(importId: number | undefined) {
        const job = await WeeklyReportQueue.add("weekly-report", { importId });
        return {
            jobId: job.id,
            status: "queued"
        };
    }

    async getJob(jobId: string) {
        const job = await WeeklyReportQueue.getJob(jobId);

        if ( !job ) {
            throw new NotFoundException("Job not found with id: " + jobId);
        }

        let status: JobState = await job?.getState() as JobState;
        status = (status === "waiting") ? "queued" as JobState : status;
        if ( status === "completed" ) {
            return {
                jobId: job?.id,
                status,
                reportId: job?.returnvalue?.reportId
            }
        } else if ( status === "failed" ) {
            return {
                jobId: job?.id,
                status,
                error: job?.failedReason
            }
        } else {
            return {
                jobId: job?.id,
                status
            }
        }
    }
}