import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { Note } from '../entities';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
        TypeOrmModule.forFeature([Note]),
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}