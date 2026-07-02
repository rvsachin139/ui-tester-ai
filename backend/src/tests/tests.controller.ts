import { Controller, Post, Get, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { TestsService } from './tests.service';

class RunTestDto {
  url: string;
  profileId?: number;
  instructions?: string;
  projectPath?: string;
  socketId?: string;
}

@Controller('tests')
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Post('run')
  async run(@Body() dto: RunTestDto): Promise<any> {
    if (!dto.url) throw new NotFoundException('url is required');
    return this.tests.runTest({
      url: dto.url,
      profileId: dto.profileId,
      instructions: dto.instructions,
      projectPath: dto.projectPath,
      socketId: dto.socketId,
    });
  }

  @Get('sessions')
  listSessions(): any[] {
    return this.tests.listSessions();
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string): any {
    return this.tests.getSession(id);
  }
}
