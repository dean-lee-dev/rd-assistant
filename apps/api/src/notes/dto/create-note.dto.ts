import { IsOptional, IsString, IsNotEmpty, MaxLength, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNoteDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title!: string;
  
    @IsOptional()
    @IsString()
    content?: string;

}

export class UpdateNoteDto {
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    title?: string;

    @IsOptional()
    @IsString()
    content?: string;
}

export class ListNotesQueryDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    @Type(() => Number)
    pageSize: number = 10;

    @IsOptional()
    @IsString()
    q?: string;
}