/**
 * One-off seed script: creates the real Wii Sports Club country/region Miiverse
 * sub-communities under the existing "Wii Sports Club" main community, using data
 * scraped from Archiverse (archiverse.pretendo.network), which mirrors real Wayback
 * Machine captures of the original Nintendo service.
 *
 * community_id/olive_community_id are set to the real archived community IDs (not
 * randomly generated) so they match what the original game/console may reference.
 *
 * Run from apps/miiverse-api with: npx tsx scripts/seedWscClubs.ts
 */
import { connect } from '@/database';
import { Community } from '@/models/community';
import { uploadIcons, initImageProcessing } from '@/images';
import { setupS3 } from '@/s3';
import { logger } from '@/logger';

const PARENT_COMMUNITY_ID = '1350269191'; // existing "Wii Sports Club" main community

type ClubEntry = {
	name: string;
	game_id: string;
	icon: string;
	region: 'America' | 'Europe';
};

const clubs: ClubEntry[] = [
	{ name: 'Puerto Rico Club', game_id: '14866558073079496103', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefacfvDqdyY', region: 'America' },
	{ name: 'Paraguay Club', game_id: '14866558073079496062', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefX4kcndUez', region: 'America' },
	{ name: 'Panama Club', game_id: '14866558073079496043', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/oip/zlCfzRKeBVcSIssotj', region: 'America' },
	{ name: 'Nicaragua Club', game_id: '14866558073079496034', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefWIePYdJbB', region: 'America' },
	{ name: 'Honduras Club', game_id: '14866558073079496014', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefU4D3mJhta', region: 'America' },
	{ name: 'Guatemala Club', game_id: '14866558073079495996', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefTwxww1RRL', region: 'America' },
	{ name: 'El Salvador Club', game_id: '14866558073079495980', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefSwchjQ9Du', region: 'America' },
	{ name: 'Ecuador Club', game_id: '14866558073079495969', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefSEb8TLQTv', region: 'America' },
	{ name: 'Peru Club', game_id: '14866558073079496082', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefZI3X5oOfw', region: 'America' },
	{ name: 'Dominican Republic Club', game_id: '14866558073079495957', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefRUK8AAm2v', region: 'America' },
	{ name: 'Colombia Club', game_id: '14866558073079495931', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefPsruyYw7d', region: 'America' },
	{ name: 'Chile Club', game_id: '14866558073079495919', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefO88aJ_osL', region: 'America' },
	{ name: 'Argentina Club', game_id: '14866558073079495902', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefN4meHkYLa', region: 'America' },
	{ name: 'Brazil Club', game_id: '14866558073079495889', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefNEgP7i-TX', region: 'America' },
	{ name: 'Mexico Club', game_id: '14866558073079495876', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefMQEtrNGCp', region: 'America' },
	{ name: 'Yukon Club', game_id: '14866558073079495856', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefLAGYN2xt0', region: 'America' },
	{ name: 'Saskatchewan Club', game_id: '14866558073079495844', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefKQImhP-j5', region: 'America' },
	{ name: 'Costa Rica Club', game_id: '14866558073079495946', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefQoIm7l7qL', region: 'America' },
	{ name: 'Venezuela Club', game_id: '14866558073079496141', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefc0dwcQ2vH', region: 'America' },
	{ name: 'Uruguay Club', game_id: '14866558073079496123', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefbsZYNU5wk', region: 'America' },
	{ name: 'Quebec Club', game_id: '14866558073079495829', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKefJUYqlJOYQ', region: 'America' },
	{ name: 'ESP Canary Islands Club', game_id: '14866558073079719401', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5ekrO6rFcg', region: 'Europe' },
	{ name: 'ESP Baleares Club', game_id: '14866558073079719376', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5dAU6-0RN9', region: 'Europe' },
	{ name: 'Denmark Club', game_id: '14866558073079719362', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5cIt-zm-4J', region: 'Europe' },
	{ name: 'Czech Republic Club', game_id: '14866558073079719351', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5bc75o-yVh', region: 'Europe' },
	{ name: 'BEL Wallonia Club', game_id: '14866558073079719329', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5aEZwb-Wlr', region: 'Europe' },
	{ name: 'BEL Flanders Club', game_id: '14866558073079719316', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5ZQXiPrszy', region: 'Europe' },
	{ name: 'BEL Brussels Club', game_id: '14866558073079719302', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5YY3eVFMWL', region: 'Europe' },
	{ name: 'AUT West Club', game_id: '14866558073079719284', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5XQ1bp3AKu', region: 'Europe' },
	{ name: 'AUT East Club', game_id: '14866558073079719244', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5UwvFfEgCf', region: 'Europe' },
	{ name: 'AUT South Club', game_id: '14866558073079719256', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5VgYBYWkei', region: 'Europe' },
	{ name: 'Australia Club', game_id: '14866558073079719227', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5TsV-5sQl1', region: 'Europe' },
	{ name: 'Other Club', game_id: '14866558073079719208', icon: 'https://web.archive.org/web/20171014154111im_/https://d3esbfg30x759i.cloudfront.net/cip/zlCfzRKh5SgUkHB-5v', region: 'Europe' }
];

async function fetchIconPng(url: string): Promise<Buffer> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch icon ${url}: HTTP ${res.status}`);
	}
	return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
	await connect();
	await initImageProcessing();
	setupS3();

	const parent = await Community.findOne({ community_id: PARENT_COMMUNITY_ID });
	if (!parent) {
		throw new Error(`Parent community ${PARENT_COMMUNITY_ID} not found`);
	}

	let created = 0;
	let skipped = 0;
	let failed = 0;

	for (const club of clubs) {
		const existing = await Community.findOne({ olive_community_id: club.game_id });
		if (existing) {
			logger.info(`Skipping "${club.name}" (${club.game_id}) - already exists`);
			skipped++;
			continue;
		}

		try {
			const iconBuf = await fetchIconPng(club.icon);
			const icons = await uploadIcons({ icon: iconBuf, communityId: club.game_id });
			if (!icons) {
				throw new Error('uploadIcons returned null (bad/undersized image?)');
			}

			await Community.create({
				platform_id: 0, // WiiU
				name: club.name,
				description: `The official Wii Sports Club community for ${club.name.replace(/ Club$/, '')}.`,
				open: true,
				allows_comments: true,
				type: 1, // Sub-Community
				parent: PARENT_COMMUNITY_ID,
				owner: parent.owner,
				created_at: new Date(),
				empathy_count: 0,
				followers: 0,
				has_shop_page: 0,
				icon: icons.tgaBlob,
				icon_paths: {
					32: icons.icon32,
					48: icons.icon48,
					64: icons.icon64,
					96: icons.icon96,
					128: icons.icon128
				},
				title_id: parent.title_id,
				community_id: club.game_id,
				olive_community_id: club.game_id,
				is_recommended: 0,
				app_data: ''
			});

			logger.success(`Created "${club.name}" (${club.game_id}) [${club.region}]`);
			created++;
		} catch (err) {
			logger.error(err, `Failed to create "${club.name}" (${club.game_id})`);
			failed++;
		}
	}

	logger.info(`Done. Created ${created}, skipped ${skipped}, failed ${failed}.`);
	process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
	logger.error(err, 'Fatal error in seedWscClubs');
	process.exit(1);
});
