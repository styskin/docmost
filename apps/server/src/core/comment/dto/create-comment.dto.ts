import {
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestionDto {
  @IsString()
  text_to_replace: string;

  @IsString()
  text_replacement: string;

  @IsString()
  reason: string;

  @IsString()
  text_before: string;

  @IsString()
  text_after: string;
}

export class CreateCommentDto {
  @IsString()
  pageId: string;

  @IsJSON()
  content: any;

  @IsOptional()
  @IsString()
  selection: string;

  @IsOptional()
  @IsUUID()
  parentCommentId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestionDto)
  suggestions?: SuggestionDto[];
}
