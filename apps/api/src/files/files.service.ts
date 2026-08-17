import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from "../common/paths";
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesService {
    constructor(private readonly prisma: PrismaService) {}

    async uploadFile(file: { buffer: Buffer, originalname: string, mimetype: string, size: number, extension: string }) {
        const { buffer, originalname, mimetype, size, extension } = file;
        const dir = path.join(UPLOADS_DIR, 'files');
        const storeName = uuidv4() + `.${extension}`;
        await fs.promises.writeFile(path.join(dir, storeName), buffer);
        const uploadedFile = await this.prisma.uploadedFile.create({
            data: {
                originalName: originalname,
                mimeType: mimetype,
                relativePath: `files/${storeName}`,
                storeName: storeName,
                size,
            }
        })
        return {
            id: uploadedFile.id,
            originalName: uploadedFile.originalName,
            storeName: uploadedFile.storeName,
            size: uploadedFile.size,
            createdAt: uploadedFile.createdAt,
            url: `/uploads/files/${storeName}`
        }
    }

    async getFilesList() {
        const list = await this.prisma.uploadedFile.findMany({orderBy:{id:'desc'}});
        return {
            total: list.length,
            items : list.map(item => ({
                ...item,
                url: `/uploads/files/${item.storeName}`
            })),
        }
    }
}