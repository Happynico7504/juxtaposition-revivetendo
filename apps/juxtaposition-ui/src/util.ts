import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChannel, createClient, Metadata } from 'nice-grpc';
import { AccountDefinition } from '@pretendonetwork/grpc/account/account_service';
import { AccountServiceDefinition } from '@pretendonetwork/grpc/account/v2/account_service';
import { FriendsDefinition } from '@pretendonetwork/grpc/friends/friends_service';
import { APIDefinition } from '@pretendonetwork/grpc/api/api_service';
import HashMap from 'hashmap';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { database } from '@/database';
import { COMMUNITY } from '@/models/communities';
import { logger } from '@/logger';
import { CONTENT } from '@/models/content';
import { SETTINGS } from '@/models/settings';
import { config } from '@/config';
import { SystemType } from '@/types/common/system-types';
import { TokenType } from '@/types/common/token-types';
import { AutomodLog } from '@/models/automodLog';
import type { Options as RatelimitOptions } from 'express-rate-limit';
import type { ZodType } from 'zod';
import type { ObjectCannedACL } from '@aws-sdk/client-s3';
import type { InferSchemaType } from 'mongoose';
import type { GetUserDataResponse as AccountGetUserDataResponse } from '@pretendonetwork/grpc/account/get_user_data_rpc';
import type { GetUserDataResponse as ApiGetUserDataResponse } from '@pretendonetwork/grpc/api/get_user_data_rpc';
import type { FriendRequest } from '@pretendonetwork/grpc/friends/friend_request';
import type { LoginResponse } from '@pretendonetwork/grpc/api/login_rpc';
import type { GetUserFriendPIDsResponse } from '@pretendonetwork/grpc/friends/get_user_friend_pids_rpc';
import type { RequestHandler } from 'express';
import { SystemType as V2SystemType } from '@pretendonetwork/grpc/account/v2/token_info';
import type { Config } from '@/config';
import type { ParamPack } from '@/types/common/param-pack';
import type { CommunitySchema } from '@/models/communities';
import type { AdminCommunity } from '@/api/generated';
import type { AutomodAction } from '@/models/automodLog';
import type { HydratedAutomodRuleDocument } from '@/models/automodRules';

const gRPCFriendsChannel = createChannel(`${config.grpc.friends.host}:${config.grpc.friends.port}`);
const gRPCFriendsClient = createClient(FriendsDefinition, gRPCFriendsChannel);

const gRPCAccountChannel = createChannel(`${config.grpc.account.host}:${config.grpc.account.port}`);
const gRPCAccountClient = createClient(AccountDefinition, gRPCAccountChannel);
const gRPCAccountV2Client = createClient(AccountServiceDefinition, gRPCAccountChannel);

const gRPCApiChannel = createChannel(`${config.grpc.account.host}:${config.grpc.account.port}`);
const gRPCApiClient = createClient(APIDefinition, gRPCApiChannel);

const s3 = new S3Client({
	endpoint: config.s3.endpoint,
	forcePathStyle: true,
	region: config.s3.region,
	credentials: {
		accessKeyId: config.s3.key,
		secretAccessKey: config.s3.secret
	}
});

const communityMap = new HashMap<string, string>();
const userMap = new HashMap<number, string>();

/**
 * Map from {olive_community_id, title_id} to name
 * and also title_id + '-id' to olive_community_id
 */
export function getCommunityHash(): HashMap<string, string> {
	return communityMap;
}
/**
 * Map from pid to screen_name (transformed)
 */
export function getUserHash(): HashMap<number, string> {
	return userMap;
}

refreshCache();

function refreshCache(): void {
	database.connect().then(async () => {
		for await (const community of COMMUNITY.find()) {
			updateCommunityHash(community);
		}
		logger.success('Created community index');

		const users = await SETTINGS.find({});

		for (const user of users) {
			if (user.pid === undefined || user.screen_name === undefined) {
				continue;
			}

			setName(user.pid, user.screen_name);
		}
		logger.success('Created user index of ' + users.length + ' users');
	}).catch((error) => {
		logger.error(error);
	});
}

/**
 * Updates a user's name in the user map.
 */
export function setName(pid: number, name: string): void {
	userMap.set(pid, name.replace(/[\u{0080}-\u{FFFF}]/gu, '').replace(/\u202e/g, ''));
}

/**
 * Updates a community's info in the map.
 */
export function updateCommunityHash(community: Pick<InferSchemaType<typeof CommunitySchema>, 'title_id' | 'olive_community_id' | 'name'>): void {
	if (community.title_id === undefined ||
		community.olive_community_id === undefined ||
		community.name === undefined
	) {
		return;
	}

	for (const title_id of community.title_id) {
		communityMap.set(title_id, community.name);
		communityMap.set(title_id + '-id', community.olive_community_id);
	}
	communityMap.set(community.olive_community_id, community.name);
}
export function updateCommunityHashForAdminCommunity(community: AdminCommunity): void {
	updateCommunityHash({
		name: community.name,
		olive_community_id: community.olive_community_id,
		title_id: community.titleIds
	});
}

// TODO - This doesn't belong here, just hacking it in. Gonna redo this whole server anyway so fuck it
export function getInvalidPostRegex(): RegExp {
	return /[^\p{L}\p{P}\d\n\r$^¨←→↑↓√|¦⇒⇔¤¢€£¥™©®+×÷=±∞`΄΅˘˙¸˛~˜°¹²³♭♪¬¯¼½¾♡♥●◆■▲▼☆★♀♂<> ]/gu;
}

export async function createUser(pid: number, experience: number, notifications: boolean): Promise<void> {
	const pnid = await getUserAccountData(pid);
	if (!pnid) {
		return;
	}

	const name = pnid.mii?.name ?? 'Default';

	const newSettings = {
		pid: pid,
		screen_name: name,
		game_skill: experience,
		receive_notifications: notifications
	};
	const newContent = {
		pid: pid
	};
	const newSettingsObj = new SETTINGS(newSettings);
	await newSettingsObj.save();

	const newContentObj = new CONTENT(newContent);
	await newContentObj.save();

	setName(pid, name);
}

export function decodeParamPack(paramPack: string): ParamPack {
	const values = Buffer.from(paramPack, 'base64').toString().split('\\').filter(v => v.length > 0).values();
	const entries: Record<string, string> = {};
	for (let i = 0; i < 16; i++) { /* Enforce an upper limit on ParamPack decoding */
		// Keys and values are sibling list entries
		const paramKey = values.next().value;
		const paramVal = values.next().value;
		// We hit the end of the list
		if (paramKey === undefined || paramVal === undefined) {
			break;
		}

		entries[paramKey] = paramVal;
	}

	// normalize and prevent any funny businiess from clients
	// one day this can be a proper DTO
	return {
		title_id: entries.title_id ?? '',
		access_key: entries.access_key ?? '',
		platform_id: entries.platform_id ?? '',
		region_id: entries.region_id ?? '',
		language_id: entries.language_id ?? '',
		country_id: entries.country_id ?? '',
		area_id: entries.area_id ?? '',
		network_restriction: entries.network_restriction ?? '',
		friend_restriction: entries.friend_restriction ?? '',
		rating_restriction: entries.rating_restriction ?? '',
		rating_organization: entries.rating_organization ?? '',
		transferable_id: entries.transferable_id ?? '',
		tz_name: entries.tz_name ?? '',
		utc_offset: entries.utc_offset ?? ''
	};
}

export async function getUserDataFromServiceToken(token: string): Promise<AccountGetUserDataResponse | null> {
	try {
		const userData = await gRPCAccountV2Client.exchangeIndependentServiceTokenForUserData({
			token
		}, {
			metadata: Metadata({
				'X-API-Key': config.grpc.account.apiKey
			})
		});

		const unpackedToken = userData.tokenInfo;
		if (!unpackedToken?.issueTime) {
			throw new Error('No tokenInfo/issueTime on service token');
		}

		// Only allow CTR and WUP tokens
		if (![V2SystemType.SYSTEM_TYPE_CTR, V2SystemType.SYSTEM_TYPE_WUP].includes(unpackedToken.systemType)) {
			return null;
		}

		// Check token expiry (also validated server-side; belt-and-suspenders)
		const expiryTime = 24 * 60 * 60 * 1000;
		if (new Date(unpackedToken.issueTime.getTime() + expiryTime) < new Date()) {
			return null;
		}

		const pid = userData.pnid?.pid;
		if (!pid) {
			return null;
		}

		return await getUserAccountData(pid);
	} catch (e) {
		logger.error(e, 'Failed to extract PID from service token');
		return null;
	}
}

export function getReasonMap(): string[] {
	return [
		'Spoiler',
		'Personal Information',
		'Violent Content',
		'Inappropriate/Harmful Conduct',
		'Hateful/Bullying',
		'Advertising',
		'Sexually Explicit',
		'Piracy',
		'Inappropriate Behavior in Game',
		'Other',
		'Missing Images; Reach out to Jemma with post link to fix'
	];
}

export async function uploadCDNAsset(key: string, data: Buffer, acl: ObjectCannedACL): Promise<boolean> {
	const awsPutParams = new PutObjectCommand({
		Body: data,
		Key: key,
		Bucket: config.s3.bucket,
		ACL: acl
	});
	try {
		await s3.send(awsPutParams);
		return true;
	} catch (e) {
		logger.error(e, 'Could not upload to CDN');
		return false;
	}
}

export async function getUserFriendPIDs(pid: number): Promise<number[]> {
	const response = await gRPCFriendsClient.getUserFriendPIDs({
		pid: pid
	}, {
		metadata: Metadata({
			'X-API-Key': config.grpc.friends.apiKey
		})
	}).catch((err): GetUserFriendPIDsResponse => {
		logger.error(err, `Couldn't fetch friends for user ${pid}`);
		return { pids: [] };
	});

	return response.pids;
}

export async function getUserFriendRequestsIncoming(pid: number): Promise<FriendRequest[]> {
	const response = await gRPCFriendsClient.getUserFriendRequestsIncoming({
		pid: pid
	}, {
		metadata: Metadata({
			'X-API-Key': config.grpc.friends.apiKey
		})
	});

	return response.friendRequests;
}

export async function getUserAccountData(pid: number): Promise<AccountGetUserDataResponse> {
	// getUserData is deprecated, but the alternatives aren't implemented yet...
	const result: AccountGetUserDataResponse = await gRPCAccountClient.getUserData({
		pid: pid
	}, {
		metadata: Metadata({
			'X-API-Key': config.grpc.account.apiKey
		})
	});
	return result;
}

export async function getUserDataFromToken(token: string): Promise<ApiGetUserDataResponse> {
	return gRPCApiClient.getUserData({}, {
		metadata: Metadata({
			'X-API-Key': config.grpc.account.apiKey,
			'X-Token': token
		})
	});
}

export async function passwordLogin(username: string, password: string, clientIP?: string): Promise<LoginResponse> {
	const meta: Record<string, string> = { 'X-API-Key': config.grpc.account.apiKey };
	if (clientIP) { meta['x-real-ip'] = clientIP; }
	return await gRPCApiClient.login({
		username: username,
		password: password,
		grantType: 'password'
	}, {
		metadata: Metadata(meta)
	});
}

/* Unused until refresh token auth is implemented */
// export async function refreshLogin(refreshToken: string): Promise<LoginResponse> {
// 	return await gRPCApiClient.login({
// 		refreshToken: refreshToken
// 	}, {
// 		metadata: Metadata({
// 			'X-API-Key': config.grpc.account.apiKey
// 		})
// 	});
// }

export type AutomodRuleEvaluationMatch = {
	start: number;
	end: number;
};
export type AutomodRuleEvaluation = {
	violatedRule: HydratedAutomodRuleDocument;
	matches: AutomodRuleEvaluationMatch[];
	action: AutomodAction;
} | null;

export function evaluateAutomodRules(post: any, rules: HydratedAutomodRuleDocument[]): AutomodRuleEvaluation {
	const blockRules = rules.filter(v => v.mode === 'block');
	const nonBlockRules = rules.filter(v => v.mode !== 'block');
	const orderedRules = [...blockRules, ...nonBlockRules];

	for (const rule of orderedRules) {
		let hasMatched = false;
		const matches: AutomodRuleEvaluationMatch[] = [];
		if (rule.type === 'keyword') {
			const bodyNormalized: string = (post.body ?? '').toLowerCase();
			const keywordsToCheck = rule.keyword_settings?.keywords ?? [];
			keywordsToCheck.forEach((keywordUpper) => {
				const keyword = keywordUpper.toLowerCase();
				const index = bodyNormalized.indexOf(keyword);
				if (index < 0) {
					return;
				}

				hasMatched = true;
				matches.push({
					start: index,
					end: index + keyword.length
				});
			});
		}

		if (hasMatched) {
			return {
				action: rule.mode === 'block' ? 'blocked' : 'logged',
				matches,
				violatedRule: rule
			};
		}
	}

	return null; // No rules apply to this post
}

export async function performAutomodAction(post: any, evaluation: AutomodRuleEvaluation): Promise<{ allowPost: boolean }> {
	if (!evaluation) {
		return { allowPost: true };
	}

	if (evaluation.action === 'blocked' || evaluation.action === 'logged') {
		const allowPost = evaluation.action === 'blocked' ? false : true;
		await AutomodLog.create({
			action: evaluation.action,
			author: post.pid,
			post_id: post.id,
			post_content_body: post.body ?? '',
			created_at: new Date(),
			rule_id: evaluation.violatedRule.id,
			parent_post_id: post.parent ?? null,
			community_id: post.community_id,
			matches: evaluation.matches.map(match => ({
				start: match.start,
				end: match.end
			}))
		});
		return {
			allowPost
		};
	}

	throw new Error('Invalid automod evaluation');
}

/**
 * Deletes undefined, but present, values. Useful for Mongoose queries.
 * @param obj Your object.
 * @returns Partial<obj>, with undefined values deleted
 */
export function deleteOptional<T extends {}>(obj: T): Partial<T> { // Partial<T> kinda wrong but good enough
	for (const _key of Object.keys(obj)) {
		const key = _key as keyof T;
		if (obj[key] === undefined) {
			delete obj[key];
		}
	}
	return obj;
}

export function fixupUnicodes(input: string): string {
	// 202F NARROW NON BREAKING SPACE
	// -> normal NBSP (Cemu doesn't render NNBSP right)
	input = input.replaceAll('\u202F', '\u00A0');

	return input;
}

function makeDateObject(date: Date | DateTime | string): DateTime {
	if (date instanceof Date) {
		date = DateTime.fromJSDate(date);
	} else if (typeof date === 'string') {
		date = DateTime.fromISO(date);
	}

	return date;
}

export function humanDate(date?: Date | DateTime | string | null): string {
	if (!date) {
		return 'null';
	}
	date = makeDateObject(date);

	const dateString = date.toUTC().toLocaleString(DateTime.DATETIME_MED) + ' UTC';
	return fixupUnicodes(dateString);
}

export function humanFromNow(date?: Date | DateTime | string | null): string {
	if (!date) {
		return 'unknown time';
	}
	date = makeDateObject(date);

	const durationString = date.toRelative({
		rounding: 'expand'
	});
	return durationString ?? 'unknown time';
}

const filename = fileURLToPath(import.meta.url);
// The root of the dist/ folder.
export const distFolder = path.dirname(filename);
export const langsFolder = path.join(distFolder, 'assets/locales');

export function zodFallback<T>(value: T): ZodType<T> {
	return z.any().transform(() => value);
}

export function createRatelimit(key: keyof Config['ratelimit'], ops: Partial<RatelimitOptions>): RequestHandler {
	const rate = rateLimit(ops);
	return (req, res, next) => {
		if (config.ratelimit[key] === true) {
			return rate(req, res, next);
		}
		return next();
	};
}
