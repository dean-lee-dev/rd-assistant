import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString } from 'class-validator';
import { HealthService } from './health.service';

@Controller('health')
/* @UseGuards(AuthGuard('jwt')) */
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get('stats/summary')
    @UseGuards(AuthGuard('jwt'))
    getStatsSummary() {
        return this.healthService.getStatsSummary();
    }

    @Get()
    get() {
        return {
            "ok": true,
            "service": "rd-assistant-api",
            "time": "2026-08-05T07:32:00.000Z"
        }
    }

    
}