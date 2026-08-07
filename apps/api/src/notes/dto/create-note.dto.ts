import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';


export class CreateNoteDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title!: string;
  
    @IsOptional()
    @IsString()
    content?: string;

}