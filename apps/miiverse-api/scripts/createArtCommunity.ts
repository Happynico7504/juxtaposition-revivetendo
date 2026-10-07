/**
 * Creates the "Art Community": a general (non-game) community for Wii U and 3DS,
 * with headers and icon rendered by scripts/art/render_art_community.py (Pillow).
 *
 * Like Off-topic it has three made-up title IDs: Wara Wara Plaza only lists
 * communities with 3+ title IDs, and topics.ts gives posts without a title ID the
 * community's first one. The IDs are random 16-digit numbers no community uses.
 *
 * Run from apps/miiverse-api with:
 *   python3 scripts/art/render_art_community.py /tmp/art
 *   npx tsx scripts/createArtCommunity.ts /tmp/art
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { connect } from '@/database';
import { Community } from '@/models/community';
import { uploadIcons, uploadHeaders, initImageProcessing } from '@/images';
import { generateCommunityId } from '@/services/internal/utils/communities';
import { setupS3 } from '@/s3';
import { logger } from '@/logger';

const NAME = 'Art Community';
const DESCRIPTION = 'Share your drawings, paintings and pixel art with everyone!';
const OWNER = 1435853600; // NicoChristmann4

// fakeTitleIds returns n random 16-digit title IDs in the same range as
// Off-topic's, none of them used by any community.
async function fakeTitleIds(n: number): Promise<string[]> {
	const ids: string[] = [];
	while (ids.length < n) {
		const id = (1_400_000_000_000_000n + crypto.randomBytes(8).readBigUInt64BE() % 200_000_000_000_000n).toString();
		if (!ids.includes(id) && !await Community.exists({ title_id: id })) {
			ids.push(id);
		}
	}
	return ids;
}

async function main(): Promise<void> {
	const dir = process.argv[2];
	if (!dir) {
		throw new Error('usage: createArtCommunity.ts <dir with 3DS.png, WiiU.png, icon.png>');
	}
	await connect();
	await initImageProcessing();
	setupS3();

	if (await Community.exists({ name: NAME })) {
		logger.info(`"${NAME}" already exists, nothing to do`);
		process.exit(0);
	}

	const communityId = await generateCommunityId();
	const icons = await uploadIcons({ icon: fs.readFileSync(path.join(dir, 'icon.png')), communityId });
	const headers = await uploadHeaders({
		ctr_header: fs.readFileSync(path.join(dir, '3DS.png')),
		wup_header: fs.readFileSync(path.join(dir, 'WiiU.png')),
		communityId
	});
	if (!icons || !headers) {
		throw new Error('uploading the images failed');
	}

	const community = await Community.create({
		platform_id: 2, // Wii U and 3DS
		name: NAME,
		description: DESCRIPTION,
		open: true,
		allows_comments: true,
		type: 0, // Main Community
		parent: null,
		owner: OWNER,
		created_at: new Date(),
		empathy_count: 0,
		followers: 0,
		has_shop_page: 0,
		icon: icons.tgaBlob,
		ctr_header: headers.ctr,
		wup_header: headers.wup,
		icon_paths: {
			32: icons.icon32,
			48: icons.icon48,
			64: icons.icon64,
			96: icons.icon96,
			128: icons.icon128
		},
		title_id: await fakeTitleIds(3),
		community_id: communityId,
		olive_community_id: communityId,
		is_recommended: 0,
		app_data: '',
		shot_mode: 'allow',
		shot_extra_title_id: []
	});
	logger.success(`Created "${NAME}" [${community.olive_community_id}] with title IDs ${community.title_id.join(', ')}`);
	process.exit(0);
}

main().catch((err) => {
	logger.error(err, 'creating the art community failed');
	process.exit(1);
});
