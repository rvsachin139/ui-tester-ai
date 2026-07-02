import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { AiKeysService } from './ai-keys.service';
import { CreateAiKeyDto, UpdateAiKeyDto } from './dto/create-ai-key.dto';
import { ModelRegistryService } from '../instructor/model-registry.service';

@Controller('ai-keys')
export class AiKeysController {
  constructor(
    private readonly service: AiKeysService,
    private readonly registry: ModelRegistryService,
  ) {}

  @Get('models')
  getModels() {
    return this.registry.getAll();
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('capability/:supportsImages')
  findByCapability(@Param('supportsImages') supportsImages: string) {
    return this.service.findActiveByCapability(supportsImages === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(+id);
  }

  @Post()
  create(@Body() dto: CreateAiKeyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAiKeyDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
