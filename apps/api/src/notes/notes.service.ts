import { Injectable, NotFoundException } from '@nestjs/common';
import type { Note } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询所有备忘录
   * @returns 备忘录列表 {total: number, items: Note[]} 其中items{@link Note}
   */
  async getAllNotes(): Promise<{ total: number; items: Note[] }> {
    const notes = await this.prisma.note.findMany({ orderBy: { id: 'desc' } });
    return {
      total: notes.length,
      items: notes,
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
    const note = await this.prisma.note.findUnique({
      where: { id },
    });
    if ( !note ) {
      throw new NotFoundException('备忘录不存在');
    }
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
    const note = await this.prisma.note.findUnique({
      where: { id },
    });
    if ( !note ) {
      throw new NotFoundException('备忘录不存在');
    }
    return this.prisma.note.update({
      where: { id },
      data
    })
  }


  async deleteNoteById(id: number): Promise<Note> {
    const note = await this.prisma.note.findUnique({
      where: { id },
    });
    if ( !note ) {
      throw new NotFoundException('备忘录不存在');
    }
    return this.prisma.note.delete({
      where: { id },
    });
  }
}
