import fs from 'node:fs';
import path from 'node:path';
import {config} from './config';

export const dirs = {
  projects: path.join(config.storageDir, 'projects'),
  uploads: path.join(config.storageDir, 'uploads'),
  renders: path.join(config.storageDir, 'renders'),
};

export const ensureStorage = (): void => {
  Object.values(dirs).forEach((dir) => fs.mkdirSync(dir, {recursive: true}));
};

export const SAFE_ID = /^[a-zA-Z0-9-]{1,80}$/;

export const readJson = <T>(file: string): T | null => {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
};

export const writeJson = (file: string, data: unknown): void => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
