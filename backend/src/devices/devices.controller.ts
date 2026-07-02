import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { AssignBrowserDto } from './dto/assign-browser.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Get('sets')
  getSets() {
    return this.service.getSets();
  }

  @Get('set/:setKey')
  findBySet(@Param('setKey') setKey: string) {
    return this.service.findBySet(setKey);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Get(':id/browsers')
  getBrowsers(@Param('id') id: string) {
    return this.service.getBrowsers(+id);
  }

  @Post(':id/browsers')
  assignBrowser(@Param('id') id: string, @Body() dto: AssignBrowserDto) {
    return this.service.assignBrowser(+id, dto);
  }

  @Delete(':id/browsers/:browserKey')
  removeBrowser(@Param('id') id: string, @Param('browserKey') browserKey: string) {
    return this.service.removeBrowser(+id, browserKey);
  }
}
