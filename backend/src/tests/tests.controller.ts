import { Controller, Post, Get, Param, Body, NotFoundException, BadRequestException, Delete } from '@nestjs/common';
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

  @Get('active')
  getActiveSessions(): any {
    return this.tests.getActiveSessions();
  }

  @Delete('active/:id')
  cancelSession(@Param('id') id: string): any {
    const cancelled = this.tests.cancelTest(id);
    if (!cancelled) throw new NotFoundException(`Active session #${id} not found`);
    return { sessionId: id, status: 'cancelled' };
  }
}
