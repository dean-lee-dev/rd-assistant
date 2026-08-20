import { Body, Controller, Get, Post, UseGuards, HttpStatus,Query,UseInterceptors,
         ParseIntPipe, Param, Patch,Delete, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Note } from '@prisma/client';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto, ListNotesQueryDto } from './dto/create-note.dto';
import { NotesLogInterceptor } from './notes-log.interceptor';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TrimPipe } from '../common/trim.pipe';

@Controller('notes')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(NotesLogInterceptor)
export class NotesController {
  constructor(private readonly noteService: NotesService) {}

  /**
   * 查询所有备忘录
   * @returns 备忘录列表 {total: number, items: Note[]} 其中items{@link Note}
   */
  @Get()
  get(@Query() query: ListNotesQueryDto): Promise<{ total: number; page: number; pageSize: number; items: Note[] }> {
    return this.noteService.getAllNotes(query.page, query.pageSize, query.q);
  }

  /**
   * 添加备忘录
   * @param dto: 备忘录内容 见{@link CreateNoteDto}
   * @returns 备忘录对象{@link Note}
   */
  @Post()
  create(@Body(TrimPipe<CreateNoteDto>) dto: CreateNoteDto): Promise<Note> {
    return this.noteService.createNote(dto);
  }

  @Get('me')
  getMeNotes(@CurrentUser() user: JwtUser): JwtUser {
    return user;
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number): Promise<Note> {
    return this.noteService.getNoteById(id);
  }


  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body(TrimPipe<UpdateNoteDto>) dto: UpdateNoteDto): Promise<Note> {
    if ( dto.title !== undefined || dto.content !== undefined ) {
      return this.noteService.updateNoteById(id, dto);
      
    }
    throw new BadRequestException('标题和内容不能同时为空');
  }


  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.noteService.deleteNoteById(id);
  }
}
