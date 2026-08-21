import { Injectable } from '@nestjs/common';
import type { Note, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询所有备忘录
   * @returns 备忘录列表 {total: number, items: Note[]} 其中items{@link Note}
   */
  async getAllNotes(page: number, pageSize: number, q?: string): Promise<{ total: number; page: number; pageSize: number; items: Note[] }> {
    const where: Prisma.NoteWhereInput | undefined = q ? {
      OR: [
        { title: { contains: q } },
        { content: { contains: q } },
      ]
    } : undefined;
    const [ total, items ] = await Promise.all([
      this.prisma.note.count({
        where
      }),
      this.prisma.note.findMany({
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        where
      }),
    ]);
    return {
      total: total,
      page: page,
      pageSize: pageSize,
      items: items,
    };
  }

  /**
   * 添加备忘录
   * @param dto: 备忘录内容 见{@link CreateNoteDto}
   * @returns 备忘录对象
   */
  async createNote(dto: CreateNoteDto): Promise<Note> {
    return this.prisma.note.create({
      data: {
        title: dto.title,
        content: dto.content ?? null,
      },
    });
  }

  async getNoteById(id: number): Promise<Note> {
    const note = await this.prisma.note.findUniqueOrThrow({
      where: { id },
    });
    return note
  }

  async updateNoteById(id: number, dto: UpdateNoteDto): Promise<Note> {
    let data: { title?: string, content?: string } = {};
    if ( dto.title !== undefined ) {
      data.title = dto.title ?? undefined;
    }
    if ( dto.content !== undefined ) {
      data.content = dto.content ?? undefined;
    }
    return this.prisma.note.update({
      where: { id },
      data
    })
  }


  async deleteNoteById(id: number): Promise<Note> {
    return this.prisma.note.delete({
      where: { id },
    });
  }
}
