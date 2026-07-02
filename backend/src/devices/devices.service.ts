import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Device } from './entities/device.entity';
import { DeviceBrowser } from './entities/device-browser.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { AssignBrowserDto } from './dto/assign-browser.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceBrowser)
    private readonly browserRepo: Repository<DeviceBrowser>,
  ) {}

  async getSets(): Promise<string[]> {
    const result = await this.deviceRepo.query(
      `SELECT DISTINCT set_key FROM devices WHERE is_active = 1 ORDER BY FIELD(set_key, 'desktop','tablet','mobile')`,
    );
    return result.map((r: { set_key: string }) => r.set_key);
  }

  async findBySet(setKey: string): Promise<Device[]> {
    return this.deviceRepo.find({
      where: { setKey, isActive: true },
      order: { sortOrder: 'ASC' },
      relations: ['browsers'],
    });
  }

  async findOne(id: number): Promise<Device> {
    const device = await this.deviceRepo.findOne({
      where: { id },
      relations: ['browsers'],
    });
    if (!device) throw new NotFoundException(`Device #${id} not found`);
    return device;
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    const device = this.deviceRepo.create({
      setKey: dto.setKey,
      deviceId: dto.deviceId,
      label: dto.label,
      width: dto.width,
      height: dto.height,
      os: dto.os || null,
      playwrightDevice: dto.playwrightDevice || null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.deviceRepo.save(device);
  }

  async remove(id: number): Promise<void> {
    const device = await this.findOne(id);
    await this.deviceRepo.remove(device);
  }

  async getBrowsers(deviceId: number): Promise<DeviceBrowser[]> {
    return this.browserRepo.find({
      where: { deviceId },
      order: { sortOrder: 'ASC' },
    });
  }

  async assignBrowser(deviceId: number, dto: AssignBrowserDto): Promise<DeviceBrowser> {
    const device = await this.findOne(deviceId);
    const browser = this.browserRepo.create({
      deviceId: device.id,
      browserKey: dto.browserKey,
      isDefault: dto.isDefault ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.browserRepo.save(browser);
  }

  async removeBrowser(deviceId: number, browserKey: string): Promise<void> {
    const browser = await this.browserRepo.findOneBy({ deviceId, browserKey });
    if (browser) await this.browserRepo.remove(browser);
  }
}
