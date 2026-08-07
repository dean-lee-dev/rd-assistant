import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Note } from '@prisma/client';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Controller('notes')
@UseGuards(AuthGuard('jwt'))
export class NotesController {
  constructor(private readonly noteService: NotesService) {}

  /**
   * 查询所有备忘录
   * @returns 备忘录列表 {total: number, items: Note[]} 其中items{@link Note}
   */
  @Get()
  get(): Promise<{ total: number; items: Note[] }> {
    return this.noteService.getAllNotes();
  }

  /**
   * 添加备忘录
   * @param dto: 备忘录内容 见{@link CreateNoteDto}
   * @returns 备忘录对象{@link Note}
   */
  @Post()
  create(@Body() dto: CreateNoteDto): Promise<Note> {
    return this.noteService.createNote(dto);
  }
}
