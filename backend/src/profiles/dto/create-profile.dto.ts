import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ComboEntry {
  @IsString()
  deviceId: string;

  @IsString()
  browserKey: string;
}

export class CreateProfileDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboEntry)
  combos?: ComboEntry[];
}
