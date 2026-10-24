import { createClient } from 'redis';
import { config } from '@/config';
import { logger } from '@/logger';
import type { ParamPack } from '@/types/common/param-pack';

// Juxt is Revivetendo's default Miiverse. A Wii U player can opt into Larimar
// (/var/www/larimar, its own database) from Juxt's settings; Larimar's settings
// switch them back by deleting the key. This key is all the two share. No key,
// Redis down, or Larimar not answering all mean Juxt, so a broken Larimar can
// never lock anyone out of Miiverse.
export const larimarInstanceKey = (pid: number): string => `miiverse:instance:${pid}`;

const redis = createClient({ url: config.larimar.redisUrl });
redis.on('error', (error) => {
	logger.error(error, 'Larimar instance Redis');
});
redis.connect().catch(() => {});

async function larimarIsUp(): Promise<boolean> {
	try {
		const res = await fetch(config.larimar.healthUrl, { signal: AbortSignal.timeout(500) });
		return res.ok;
	} catch {
		return false;
	}
}

// The portal host to hand this console instead of Juxt's, or null for Juxt.
export async function larimarPortalHostFor(pid: number, paramPack: ParamPack | undefined): Promise<string | null> {
	// Wii U only: Larimar has no 3DS views yet.
	if (paramPack?.platform_id !== '1' || !redis.isOpen) {
		return null;
	}

	try {
		if (await redis.get(larimarInstanceKey(pid)) !== 'larimar') {
			return null;
		}
	} catch {
		return null;
	}

	if (!await larimarIsUp()) {
		logger.warn(`Larimar is down, sending ${pid} to Juxt`);
		return null;
	}

	return config.larimar.portalHost;
}
