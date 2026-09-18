/**
 * Full rebuild of the Wii Sports Club Miiverse community tree from real Archiverse
 * data (archiverse.pretendo.network), which mirrors Wayback Machine captures of the
 * original Nintendo service. Replaces the old single shared "Wii Sports Club" main
 * community (which never matched real Miiverse's structure - each region actually
 * ran its own separate community tree) with 3 real regional main communities plus
 * every real sub-community (country/state/prefecture clubs + specials like "World
 * Club"/"Custom Callout Community") under each.
 *
 * community_id/olive_community_id use the real archived GameID values (not randomly
 * generated), matching the existing convention from seedWscClubs.ts/seedGerHesse.ts.
 *
 * Run from apps/miiverse-api with: npx tsx scripts/seedWscAllRegions.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Gravity, ImageMagick, MagickColors, MagickFormat } from '@imagemagick/magick-wasm';
import { connect } from '@/database';
import { Community } from '@/models/community';
import { uploadIcons, uploadHeaders, initImageProcessing } from '@/images';
import { setupS3 } from '@/s3';
import { logger } from '@/logger';

type Region = 'America' | 'Europe' | 'Japan';

type Entry = {
	GameID: string;
	TitleID: string;
	CommunityTitle: string;
	CommunityBanner: string;
	CommunityIconUrl: string;
	Badge: string | null;
	GameTitle: string;
	NumPosts: number;
	Region: Region;
};

// Real Nintendo Wii U title IDs (confirmed via WiiUBrew, cross-checked against the
// AWSJ/AWSE/AWSP product codes) for each region's base game, plus the closest
// adjacent variant IDs recovered from the old shared community's title_id array.
const titleIdsByRegion: Record<Region, string[]> = {
	America: ['1407375153319168', '1407375153318912', '1407375153685760', '1407375153686016', '1407375153686272'], // 0144D00 (base) + 0144C00 + 19E500/19E600/19E700 DLC variants
	Europe: ['1407375153319424', '1407375153685761', '1407375153686017', '1407375153686273'], // 0144E00 (base) + 19E501/19E601/19E701 DLC variants
	Japan: ['1407375153230080', '1407375153230081', '1407375153230082', '1407375153685762', '1407375153686018', '1407375153686274'] // 012F100 (base) + F101/F102 + 19E502/19E602/19E702 DLC variants
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function loadData(file: string): Entry[] {
	const raw = fs.readFileSync(path.join(scriptDir, 'data', file), 'utf-8');
	return JSON.parse(raw) as Entry[];
}

const allData: Entry[] = [
	...loadData('wscAmerica.json'),
	...loadData('wscEurope.json'),
	...loadData('wscJapan.json')
];

// CommunityBanner assets from Archiverse are actually JPEGs, not PNGs, but
// images.ts's uploadHeaders() hardcodes ImageMagick to read its input as 'PNG' -
// that's fine for the admin UI (which always uploads real PNGs) but chokes on
// these ("ImproperImageHeader" - PNG's magic-number check fails on JPEG bytes).
// Both header helpers below auto-detect the real input format via ImageMagick.read
// and re-encode to PNG as part of their resize/pad step.

// images.ts's processCtrHeader technically accepts 400x168 as input and pads it up
// to 400x220 internally, but do that padding explicitly here too (same white
// background + North gravity it uses) so the header going in is unambiguously
// exactly 400x220, not relying on that fallback branch.
function toCtrHeaderPng(buf: Buffer): Buffer {
	return ImageMagick.read(buf, (image) => {
		image.backgroundColor = MagickColors.White;
		image.extent(400, 220, Gravity.North);
		return image.write(MagickFormat.Png, Buffer.from);
	});
}

// images.ts's processWupHeader requires exactly 1280x180 - a completely different
// aspect ratio Archiverse never had art for. Scale to fill the 180px height, then
// letterbox (white-pad) the width out to 1280 so the real artwork survives
// undistorted and uncropped, matching processCtrHeader's own 168->220 padding
// approach rather than stretching or cropping it.
function toWupHeaderPng(buf: Buffer): Buffer {
	return ImageMagick.read(buf, (image) => {
		const targetHeight = 180;
		const targetWidth = Math.round((image.width / image.height) * targetHeight);
		image.resize(targetWidth, targetHeight);
		image.backgroundColor = MagickColors.White;
		image.extent(1280, 180, Gravity.Center);
		return image.write(MagickFormat.Png, Buffer.from);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wayback Machine intermittently throttles rapid sequential fetches (~426 images
// total here) - a request that 302s to a nearby snapshot or gets a degraded/empty
// response looks identical to a real missing asset until retried a moment later.
// Retry with backoff, and fetchImage always pauses briefly first to keep the
// overall request rate low enough that we don't trip the limiter in the first place.
async function fetchImageUncached(url: string, attempt = 1): Promise<Buffer> {
	await sleep(300);
	const res = await fetch(url);
	if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/plain')) {
		if (attempt < 5) {
			await sleep(1000 * attempt);
			return fetchImageUncached(url, attempt + 1);
		}
		throw new Error(`HTTP ${res.status} fetching ${url} (gave up after ${attempt} attempts)`);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length === 0) {
		if (attempt < 5) {
			await sleep(1000 * attempt);
			return fetchImageUncached(url, attempt + 1);
		}
		throw new Error(`Empty body fetching ${url} (gave up after ${attempt} attempts)`);
	}
	return buf;
}

// Many entries share the exact same source image (e.g. Japan's Main + Custom
// Callout communities both use tip/AAUAABAS8QA1Z-xge0; several minor America clubs
// reuse the generic oip/... icon) - cache by URL so each unique asset is only
// fetched from Wayback once instead of once per community that happens to share it.
const imageCache = new Map<string, Promise<Buffer>>();

function fetchImage(url: string): Promise<Buffer> {
	let pending = imageCache.get(url);
	if (!pending) {
		pending = fetchImageUncached(url);
		imageCache.set(url, pending);
	}
	return pending;
}

async function main(): Promise<void> {
	await connect();
	await initImageProcessing();
	setupS3();

	let created = 0;
	let skipped = 0;
	let failed = 0;

	// Pass 1: main communities, one per region, so subs can reference their real parent.
	const mainCommunityIdByRegion: Record<Region, string> = { America: '', Europe: '', Japan: '' };

	for (const region of ['America', 'Europe', 'Japan'] as Region[]) {
		const main = allData.find((e) => e.Region === region && e.Badge === 'Main Community');
		if (!main) {
			throw new Error(`No Main Community entry found for ${region}`);
		}
		mainCommunityIdByRegion[region] = main.GameID;

		const existing = await Community.findOne({ community_id: main.GameID });
		if (existing) {
			logger.info(`Skipping main "${main.CommunityTitle}" (${region}) - already exists`);
			skipped++;
			continue;
		}

		try {
			const iconBuf = await fetchImage(main.CommunityIconUrl);
			const bannerBuf = await fetchImage(main.CommunityBanner);
			const icons = await uploadIcons({ icon: iconBuf, communityId: main.GameID });
			if (!icons) {
				throw new Error('uploadIcons returned null');
			}
			const ctrHeaderPng = toCtrHeaderPng(bannerBuf);
			const wupHeaderPng = toWupHeaderPng(bannerBuf);
			const headers = await uploadHeaders({ ctr_header: ctrHeaderPng, wup_header: wupHeaderPng, communityId: main.GameID });

			await Community.create({
				platform_id: 0, // WiiU
				name: main.CommunityTitle,
				description: `The official Wii Sports Club community for ${region}.`,
				open: true,
				allows_comments: true,
				type: 0, // Main Community
				parent: null,
				owner: 1435853600,
				created_at: new Date(),
				empathy_count: 0,
				followers: 0,
				has_shop_page: 0,
				icon: icons.tgaBlob,
				ctr_header: headers?.ctr ?? undefined,
				wup_header: headers?.wup ?? undefined,
				icon_paths: {
					32: icons.icon32,
					48: icons.icon48,
					64: icons.icon64,
					96: icons.icon96,
					128: icons.icon128
				},
				title_id: titleIdsByRegion[region],
				community_id: main.GameID,
				olive_community_id: main.GameID,
				is_recommended: 1,
				app_data: ''
			});

			logger.success(`Created main "${main.CommunityTitle}" (${region}) [${main.GameID}]`);
			created++;
		} catch (err) {
			logger.error(err, `Failed to create main "${main.CommunityTitle}" (${region})`);
			failed++;
		}
	}

	// Pass 2: every sub-community, parented under its region's real main community.
	for (const entry of allData) {
		if (entry.Badge === 'Main Community') {
			continue;
		}

		const existing = await Community.findOne({ community_id: entry.GameID });
		if (existing) {
			logger.info(`Skipping "${entry.CommunityTitle}" (${entry.Region}) - already exists`);
			skipped++;
			continue;
		}

		try {
			const iconBuf = await fetchImage(entry.CommunityIconUrl);
			const bannerBuf = await fetchImage(entry.CommunityBanner);
			const icons = await uploadIcons({ icon: iconBuf, communityId: entry.GameID });
			if (!icons) {
				throw new Error('uploadIcons returned null');
			}
			const ctrHeaderPng = toCtrHeaderPng(bannerBuf);
			const wupHeaderPng = toWupHeaderPng(bannerBuf);
			const headers = await uploadHeaders({ ctr_header: ctrHeaderPng, wup_header: wupHeaderPng, communityId: entry.GameID });

			// GER Hesse is the one club whose real in-game club code (used by WSC's
			// local club-info screen to match app_data) has been reverse-engineered
			// so far - see seedGerHesse.ts. Everything else keeps app_data empty
			// until the rest of the code table is recovered from wsc.rpx.
			const appData = entry.CommunityTitle === 'GER Hesse Club' ? '033' : '';

			await Community.create({
				platform_id: 0,
				name: entry.CommunityTitle,
				description: `The official Wii Sports Club community for ${entry.CommunityTitle.replace(/ Club$/, '')}.`,
				open: true,
				allows_comments: true,
				type: 1, // Sub-Community
				parent: mainCommunityIdByRegion[entry.Region],
				owner: 1435853600,
				created_at: new Date(),
				empathy_count: 0,
				followers: 0,
				has_shop_page: 0,
				icon: icons.tgaBlob,
				ctr_header: headers?.ctr ?? undefined,
				wup_header: headers?.wup ?? undefined,
				icon_paths: {
					32: icons.icon32,
					48: icons.icon48,
					64: icons.icon64,
					96: icons.icon96,
					128: icons.icon128
				},
				title_id: titleIdsByRegion[entry.Region],
				community_id: entry.GameID,
				olive_community_id: entry.GameID,
				is_recommended: 0,
				app_data: appData
			});

			logger.success(`Created "${entry.CommunityTitle}" (${entry.Region}) [${entry.GameID}]`);
			created++;
		} catch (err) {
			logger.error(err, `Failed to create "${entry.CommunityTitle}" (${entry.Region})`);
			failed++;
		}
	}

	logger.info(`Done. Created ${created}, skipped ${skipped}, failed ${failed}.`);
	process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
	logger.error(err, 'Fatal error in seedWscAllRegions');
	process.exit(1);
});
