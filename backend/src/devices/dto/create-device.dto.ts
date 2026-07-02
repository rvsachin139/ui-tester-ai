import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  setKey: string;

  @IsString()
  deviceId: string;

  @IsString()
  label: string;

  @IsNumber()
  @Min(320)
  @Max(7680)
  width: number;

  @IsNumber()
  @Min(240)
  @Max(4320)
  height: number;

  @IsOptional()
  @IsString()
  os?: string;

  @IsOptional()
  @IsString()
  playwrightDevice?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
