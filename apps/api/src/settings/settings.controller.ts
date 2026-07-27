import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString } from 'class-validator';
import { AiService } from '../ai/ai.service';

class UpdateAiDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

@Controller('settings/ai')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  constructor(private readonly ai: AiService) {}

  @Get()
  get() {
    return this.ai.getPublicSetting();
  }

  @Put()
  update(@Body() dto: UpdateAiDto) {
    return this.ai.updateSetting(dto);
  }

  @Post('test')
  test() {
    return this.ai.testConnection();
  }

  @Post('usage/reset')
  resetUsage() {
    return this.ai.resetUsage();
  }
}
