import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class AssignBrowserDto {
  @IsString()
  browserKey: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
