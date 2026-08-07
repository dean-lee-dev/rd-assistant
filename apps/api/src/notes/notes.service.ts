import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {  Repository } from 'typeorm';
import { Note } from '../entities';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
    constructor(
        @InjectRepository(Note) private readonly notes: Repository<Note>,
    ) {}

    /**
     * 查询所有备忘录
     * @returns 备忘录列表 {total: number, items: Note[]} 其中items{@link Note}
     */
    async getAllNotes(): Promise<{total: number, items: Note[]}> {
        const notes = await this.notes.find({ order: { id: 'DESC' } });
        return {
            total: notes.length,
            items: notes
        }
    }

    /**
     * 添加备忘录
     * @param dto: 备忘录内容 见{@link CreateNoteDto}
     * @returns 备忘录对象
     */
    async createNote(dto: CreateNoteDto): Promise<Note> {
        const note = this.notes.create({
            title: dto.title,
            content: dto.content
        });
        await this.notes.save(note);
        return note;
    }
}