import fs from 'fs-extra';
import path from 'path';

const CONFIG_DIR = '.cscc-deploy';
const CONFIG_FILE = 'config.json';

export const saveConfig = async (config) => {
  const configDir = path.resolve(process.cwd(), CONFIG_DIR);
  const configFile = path.join(configDir, CONFIG_FILE);
  await fs.ensureDir(configDir);
  await fs.writeJSON(configFile, config, { spaces: 2 });
};

export const loadConfig = async () => {
  try {
    const configDir = path.resolve(process.cwd(), CONFIG_DIR);
    const configFile = path.join(configDir, CONFIG_FILE);
    return await fs.readJSON(configFile);
  } catch (error) {
    return null;
  }
};