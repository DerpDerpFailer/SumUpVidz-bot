import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

let cache;

async function load() {
  if (cache) return cache;

  try {
    cache = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cache = {};
  }

  return cache;
}

async function persist() {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cache, null, 2));
}

export async function getAllowedChannel(guildId) {
  const config = await load();
  return config[guildId]?.channelId ?? null;
}

export async function setAllowedChannel(guildId, channelId) {
  const config = await load();
  config[guildId] = { channelId };
  await persist();
}
