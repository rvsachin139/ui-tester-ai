import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });
config({ path: join(__dirname, '../../.env.test'), override: true });

export const typeOrmOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ui_tester_ai',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  synchronize: true,
  charset: 'utf8mb4',
};

const dataSource = new DataSource(typeOrmOptions);
export default dataSource;
