import { IsNotEmpty, IsString } from 'class-validator';

export class GetDocumentDto {
  @IsNotEmpty()
  @IsString()
  slugId: string;
}
