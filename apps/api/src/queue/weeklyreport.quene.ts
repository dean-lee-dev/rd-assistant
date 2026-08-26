import { Queue } from "bullmq";
import Redis from "ioredis";

export const WeeklyReportQueue = new Queue("weekly-report", {
    connection: new Redis(process.env.REDIS_URL as string, {
        maxRetriesPerRequest: null
    })
});