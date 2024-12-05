import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.web-deployer');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const saveConfig = async (config) => {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJSON(CONFIG_FILE, config, { spaces: 2 });
};

export const loadConfig = async () => {
  try {
    return await fs.readJSON(CONFIG_FILE);
  } catch (error) {
    return null;
  }
}; 