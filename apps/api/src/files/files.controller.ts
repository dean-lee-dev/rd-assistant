
import { Controller, Post, UseGuards, Get, Req } from "@nestjs/common";
import { FilesService } from "./files.service";
import { AuthGuard } from "@nestjs/passport";
import { readFileUpload } from "../common/upload";
import type {  FastifyRequest } from 'fastify';

@Controller('files')
@UseGuards(AuthGuard('jwt'))
export class FilesController {
    constructor(private readonly filesService: FilesService) {}

    @Post()
    async uploadFile(@Req() req: FastifyRequest) {
        const file = await readFileUpload(req, 2*1024*1024);
        return this.filesService.uploadFile(file);
    }

    @Get()
    getFilesList() {
        return this.filesService.getFilesList();
    }
}