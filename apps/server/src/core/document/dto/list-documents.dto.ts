import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListDocumentsDto {
  @IsNotEmpty()
  @IsString()
  space: string;
}
