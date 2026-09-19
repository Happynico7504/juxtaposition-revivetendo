import mongoose from 'mongoose';
import { logger } from '@/logger';
import { Community } from '@/models/community';
import { Content } from '@/models/content';
import { Conversation } from '@/models/conversation';
import { Endpoint } from '@/models/endpoint';
import { Post } from '@/models/post';
import { Settings } from '@/models/settings';
import { config } from '@/config';
import type { HydratedEndpointDocument } from '@/models/endpoint';
import type { HydratedConversationDocument } from '@/models/conversation';
import type { HydratedContentDocument } from '@/types/mongoose/content';
import type { HydratedSettingsDocument } from '@/types/mongoose/settings';
import type { HydratedPostDocument, IPostInput } from '@/types/mongoose/post';
import type { HydratedCommunityDocument } from '@/types/mongoose/community';

let connection: mongoose.Connection;
mongoose.set('strictQuery', true);

export async function connect(): Promise<void> {
	connection = mongoose.connection;
	connection.on('connected', () => {
		logger.info('MongoDB connected');
	});
	connection.on('error', err => logger.error(err, 'Database connection error'));
	connection.on('close', () => {
		connection.removeAllListeners();
	});

	await mongoose.connect(config.mongoose.uri);
}

function verifyConnected(): void {
	if (!connection) {
		connect();
	}
}

export async function getMostPopularCommunities(limit: number): Promise<HydratedCommunityDocument[]> {
	verifyConnected();

	return Community.find({ parent: null, type: 0 }).sort({ followers: -1 }).limit(limit);
}

export async function getNewCommunities(limit: number): Promise<HydratedCommunityDocument[]> {
	verifyConnected();

	return Community.find({ parent: null, type: 0 }).sort([['created_at', -1]]).limit(limit);
}

export async function getSubCommunities(parentCommunityID: string): Promise<HydratedCommunityDocument[]> {
	verifyConnected();

	return Community.find({
		parent: parentCommunityID
	});
}

export async function getCommunityByTitleID(titleID: string): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	return Community.findOne({
		title_id: titleID
	});
}

// Resolves a title_id to the shared "Online Banter Community" - the community WSC's
// thought posts live in - for the callers (GET /:communityID/posts and newPost) that
// receive community_id=0 with a search_key, which the real client means as "resolve
// it for me", not "give me the main community".
//
// The original service had a separate "Online Banter Community" (US) / "Custom
// Callout Community" (EU, JP) per region. We deliberately share ONE across all
// regions instead: any title_id that has such a community resolves to the same
// "Online Banter Community", so players from every region read and write the same
// thoughts. The regional Custom Callout communities stay in place (they are still
// listed under their region's main community) but no longer receive posts.
//
// Every sub-community under a region shares its main community's title_id array, so
// a plain findOne by title_id just returns whichever the database happens to return
// first (in practice the main community) - hence the explicit name match. Falls back
// to getCommunityByTitleID for any title_id without a banter/callout community.
const SHARED_BANTER_NAME = 'Online Banter Community';
const REGIONAL_BANTER_NAMES = [SHARED_BANTER_NAME, 'Custom Callout Community'];

export async function getCommunityByTitleIDPreferBanter(titleID: string): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	const regional = await Community.findOne({
		title_id: titleID,
		name: { $in: REGIONAL_BANTER_NAMES }
	});

	if (regional) {
		// Oldest one wins so the choice is stable if a second ever gets created.
		const shared = await Community.findOne({ name: SHARED_BANTER_NAME }).sort({ _id: 1 });
		return shared ?? regional;
	}

	return getCommunityByTitleID(titleID);
}

// The single community all regions store banters in (oldest "Online Banter Community").
export async function getSharedBanterCommunity(): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	return Community.findOne({ name: SHARED_BANTER_NAME }).sort({ _id: 1 });
}

// The requester's own region's banter/callout community (US "Online Banter Community",
// EU/JP "Custom Callout Community") - the one their community list advertises with the
// "comment" app_data - or null if their title has none. Banter posts are STORED in the
// single shared Online Banter community, but each console only knows the community ID it
// got from its own region's list, so responses report that regional ID (see posts.search).
export async function getRegionalBanterCommunity(titleID: string): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	return Community.findOne({
		title_id: titleID,
		name: { $in: REGIONAL_BANTER_NAMES }
	});
}

export async function getCommunityByTitleIDs(titleIDs: string[]): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	return Community.findOne({
		title_id: { $in: titleIDs }
	});
}

export async function getCommunityByID(communityID: string): Promise<HydratedCommunityDocument | null> {
	verifyConnected();

	return Community.findOne({
		community_id: communityID
	});
}

// 32-bit game clients (WSC and friends) only ever see a community's ID as a u32:
// nn::olv's GetCommunityId() truncates the 64-bit community_id our seeded
// communities carry (Archiverse GameIDs), so the Miiverse applet then asks for
// e.g. 312600382 instead of 14866558073079719742 and gets a 404. Map such a
// truncated ID back to the one community whose full ID ends in the same 32 bits.
// Native communities have IDs under 32 bits and are returned unchanged.
let truncatedIdMap: { built: number; map: Map<string, string> } | null = null;
const TRUNCATED_ID_TTL_MS = 60_000;

export async function resolveCommunityIdAlias(communityID: string): Promise<string> {
	if (!/^\d{1,10}$/.test(communityID)) {
		return communityID;
	}
	verifyConnected();

	if (await Community.exists({ olive_community_id: communityID })) {
		return communityID;
	}

	const now = Date.now();
	if (!truncatedIdMap || now - truncatedIdMap.built > TRUNCATED_ID_TTL_MS) {
		const map = new Map<string, string>();
		const wide = await Community
			.find({ $expr: { $gt: [{ $strLenCP: '$olive_community_id' }, 10] } }, { olive_community_id: 1 })
			.lean();
		for (const c of wide) {
			const full = c.olive_community_id;
			if (!/^\d+$/.test(full)) {
				continue;
			}
			const truncated = (BigInt(full) & 0xFFFFFFFFn).toString();
			// Two communities sharing their low 32 bits would be ambiguous - keep
			// the first rather than silently picking a different one each time.
			if (!map.has(truncated)) {
				map.set(truncated, full);
			}
		}
		truncatedIdMap = { built: now, map };
	}

	return truncatedIdMap.map.get(communityID) ?? communityID;
}

export async function getPostByID(postID: string): Promise<HydratedPostDocument | null> {
	verifyConnected();

	return Post.findOne({
		id: postID
	});
}

export async function getPostReplies(postID: string, limit: number): Promise<HydratedPostDocument[]> {
	verifyConnected();

	return Post.find({
		parent: postID,
		removed: false,
		app_data: { $ne: null }
	}).limit(limit);
}

export async function getDuplicatePosts(pid: number, post: IPostInput, olderThanMs: number): Promise<HydratedPostDocument | null> {
	verifyConnected();

	return Post.findOne({
		pid: pid,
		body: post.body,
		screenshot: post.screenshot,
		painting: post.painting,
		created_at: {
			$gte: new Date(Date.now() - olderThanMs)
		},
		parent: null,
		removed: false
	});
}

export async function getPostsBytitleID(titleID: string[], limit: number): Promise<HydratedPostDocument[]> {
	verifyConnected();

	return Post.find({
		title_id: titleID,
		parent: null,
		removed: false
	}).sort({ created_at: -1 }).limit(limit);
}

export async function getEndpoints(): Promise<HydratedEndpointDocument[]> {
	verifyConnected();

	return Endpoint.find({});
}

export async function getEndpoint(accessLevel: string): Promise<HydratedEndpointDocument | null> {
	verifyConnected();

	return Endpoint.findOne({
		server_access_level: accessLevel
	});
}

export async function getUserSettings(pid: number): Promise<HydratedSettingsDocument | null> {
	verifyConnected();

	return Settings.findOne({ pid: pid });
}

export async function getUserContent(pid: number): Promise<HydratedContentDocument | null> {
	verifyConnected();

	return Content.findOne({ pid: pid });
}

export async function getFollowedUsers(content: HydratedContentDocument): Promise<HydratedSettingsDocument[]> {
	verifyConnected();

	return Settings.find({
		pid: content.followed_users
	});
}

export async function getConversationByUsers(pids: number[]): Promise<HydratedConversationDocument | null> {
	verifyConnected();

	return Conversation.findOne({
		$and: [
			{ 'users.pid': pids[0] },
			{ 'users.pid': pids[1] }
		]
	});
}

export async function getFriendMessages(pid: string, search_key: string[], limit: number): Promise<HydratedPostDocument[]> {
	verifyConnected();

	return Post.find({
		message_to_pid: pid,
		search_key: search_key,
		parent: null,
		removed: false
	}).sort({ created_at: 1 }).limit(limit);
}
