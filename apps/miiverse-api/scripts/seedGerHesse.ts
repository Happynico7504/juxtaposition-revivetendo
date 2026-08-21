/**
 * One-off: add the "GER Hesse" Wii Sports Club community, which Archiverse never
 * archived (it's missing entirely from seedWscClubs.ts's 33 clubs).
 *
 * Reverse-engineered from wsc.rpx: before calling nn::olv::StartPortalApp, WSC's
 * club-info screen searches the already-downloaded community list for an entry
 * whose GetAppData() matches a "%03d"-formatted 3-digit club code (the same code
 * already visible in wsc-secure's DataStore tags, e.g. eu_033_ave for GER Hesse).
 * If no entry matches, WSC bails out locally with error 115-9999 and never calls
 * nn::olv at all - which is why every seeded club (all with app_data: '') failed,
 * and why Hesse specifically failed outright since it didn't exist as a community.
 *
 * Run from apps/miiverse-api with: npx tsx scripts/seedGerHesse.ts
 */
import crypto from 'node:crypto';
import { connect } from '@/database';
import { Community } from '@/models/community';
import { logger } from '@/logger';

const PARENT_COMMUNITY_ID = '1350269191'; // existing "Wii Sports Club" main community

async function main(): Promise<void> {
	await connect();

	const parent = await Community.findOne({ community_id: PARENT_COMMUNITY_ID });
	if (!parent) {
		throw new Error(`Parent community ${PARENT_COMMUNITY_ID} not found`);
	}

	const existing = await Community.findOne({ name: 'GER Hesse Club' });
	if (existing) {
		logger.info('GER Hesse Club already exists - updating app_data to 033 only');
		existing.app_data = '033';
		await existing.save();
		process.exit(0);
	}

	const newCommunityId = crypto.randomInt(0x80000, 0xFFFFFFFF).toString();
	const newOliveCommunityId = crypto.randomInt(0x80000, 0xFFFFFFFF).toString();

	await Community.create({
		platform_id: 0, // WiiU
		name: 'GER Hesse Club',
		description: 'The official Wii Sports Club community for GER Hesse.',
		open: true,
		allows_comments: true,
		type: 1, // Sub-Community
		parent: PARENT_COMMUNITY_ID,
		owner: parent.owner,
		created_at: new Date(),
		empathy_count: 0,
		followers: 0,
		has_shop_page: 0,
		icon: parent.icon,
		icon_paths: parent.icon_paths,
		title_id: parent.title_id,
		community_id: newCommunityId,
		olive_community_id: newOliveCommunityId,
		is_recommended: 0,
		app_data: '033'
	});

	logger.success(`Created "GER Hesse Club" (${newCommunityId}) with app_data=033`);
	process.exit(0);
}

main().catch((err) => {
	logger.error(err, 'Fatal error in seedGerHesse');
	process.exit(1);
});
