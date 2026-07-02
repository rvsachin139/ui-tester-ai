import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestProfile } from './entities/test-profile.entity';
import { TestProfileCombo } from './entities/test-profile-combo.entity';
import { Device } from '../devices/entities/device.entity';
import { CreateProfileDto } from './dto/create-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(TestProfile)
    private readonly profileRepo: Repository<TestProfile>,
    @InjectRepository(TestProfileCombo)
    private readonly comboRepo: Repository<TestProfileCombo>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async findAll(): Promise<TestProfile[]> {
    return this.profileRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<TestProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: ['combos', 'combos.device'],
    });
    if (!profile) throw new NotFoundException(`Profile #${id} not found`);
    return profile;
  }

  async create(dto: CreateProfileDto): Promise<TestProfile> {
    const profile = this.profileRepo.create({
      name: dto.name,
      description: dto.description || null,
    });
    const saved = await this.profileRepo.save(profile);

    if (dto.combos?.length) {
      const combos = [];
      for (const c of dto.combos) {
        const device = await this.deviceRepo.findOneBy({ deviceId: c.deviceId });
        if (device) {
          combos.push(
            this.comboRepo.create({
              profileId: saved.id,
              deviceId: device.id,
              browserKey: c.browserKey,
            }),
          );
        }
      }
      await this.comboRepo.save(combos);
    }

    return this.findOne(saved.id);
  }

  async remove(id: number): Promise<void> {
    const profile = await this.findOne(id);
    await this.profileRepo.remove(profile);
  }

  async getCombos(profileId: number): Promise<TestProfileCombo[]> {
    return this.comboRepo.find({
      where: { profileId },
      relations: ['device'],
      order: { id: 'ASC' },
    });
  }
}
