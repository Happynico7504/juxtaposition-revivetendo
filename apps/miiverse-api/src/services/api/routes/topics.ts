import express from 'express';
import moment from 'moment';
import xmlbuilder from 'xmlbuilder';
import Cache from '@/cache';
import { Post } from '@/models/post';
import { Community } from '@/models/community';
import { ApiErrorCode, badRequest } from '@/errors';
import type { IPost } from '@/types/mongoose/post';
import type { HydratedCommunityDocument } from '@/types/mongoose/community';
import type { WWPResult, WWPTopic } from '@/types/miiverse/wara-wara-plaza';

const router = express.Router();
const ONE_HOUR = 60 * 60 * 1000;
const WARA_WARA_PLAZA_CACHE = new Cache<WWPResult>(ONE_HOUR);

/* GET post titles. */
router.get('/', async function (request: express.Request, response: express.Response): Promise<void> {
	response.type('application/xml');

	// * Commented out for now because we just don't
	// * need this data here. WWP does not use the
	// * current users data atm. Also some users have
	// * BOSS tasks with outdated tokens, which aren't
	// * usable and thus break this request. This is
	// * done as a quick/hacky fix around that
	// TODO - Re-enable this and filter out the current users posts
	// let user: GetUserDataResponse;
	//
	// try {
	//	user  = await getUserAccountData(request.pid);
	// } catch (error) {
	//	request.log.warn(error, `Failed to get account data for ${request.pid}`);
	//	return;
	// }
	//
	// let discovery: HydratedEndpointDocument | null;
	//
	// if (user) {
	//	discovery = await getEndpoint(user.serverAccessLevel);
	// } else {
	//	discovery = await getEndpoint('prod');
	// }
	//
	// if (!discovery || !discovery.topics) {
	//	response.sendStatus(404);
	//	return;
	// }

	if (!WARA_WARA_PLAZA_CACHE.valid()) {
		const communities = await selectRandomCommunities(10);

		if (communities.length === 0) {
			request.log.warn('No communities exist for topics request');
			return badRequest(response, ApiErrorCode.NOT_FOUND_COMMUNITY, 404);
		}

		WARA_WARA_PLAZA_CACHE.update(await generateTopicsData(communities));
	}

	const result = WARA_WARA_PLAZA_CACHE.get() || {};
	const xml = xmlbuilder.create({
		result: result
	}, {
		separateArrayItems: true
	}).end({
		pretty: true,
		allowEmpty: true
	});

	response.set('Cache-Control', 'public, max-age=3600'); // * 1 hour
	response.send(xml);
});

async function generateTopicsData(communities: HydratedCommunityDocument[]): Promise<WWPResult> {
	const topics: {
		topic: WWPTopic;
	}[] = [];

	// * A person should only ever appear once across the whole result, not in
	// * multiple communities at once. Which communities get first claim on a
	// * shared pool of eligible people is randomized by selectRandomCommunities'
	// * own shuffle (communities are processed here in that same random order),
	// * so this no longer systematically starves the same communities every
	// * time the way a fixed processing order would.
	const seenPeople: number[] = [];

	for (let i = 0; i < communities.length; i++) {
		const community = communities[i];

		const subCommunities = await Community.find({ parent: community.olive_community_id }, { olive_community_id: 1 });
		const communityAndSubIDs = [community.olive_community_id, ...subCommunities.map(sub => sub.olive_community_id)];

		const empathies = await Post.aggregate<{ _id: null; total: number }>([
			{
				$match: {
					community_id: {
						$in: communityAndSubIDs
					}
				}
			},
			{
				$group: {
					_id: null,
					total: {
						$sum: '$empathy_count'
					}
				}
			},
			{
				$limit: 1
			}
		]);

		const topic: WWPTopic = {
			empathy_count: empathies[0]?.total || 0,
			has_shop_page: community.has_shop_page ? 1 : 0,
			icon: community.icon,
			title_ids: [],
			title_id: community.title_id[0],
			community_id: 0xFFFFFFFF, // * This is how it was in the real WWP. Unsure why, but it works
			is_recommended: community.is_recommended ? 1 : 0,
			name: community.name,
			people: [],
			// * Set below, once we know this topic survives the empty-people
			// * filter - must stay contiguous among only the topics actually
			// * included (see the filename-gap lesson from sysmsg: a real
			// * console choked on a non-contiguous sequence there too).
			position: 0
		};

		community.title_id.forEach((title_id) => {
			// * Just in case
			if (title_id) {
				topic.title_ids.push({ title_id });
			}
		});

		const people = await getCommunityPeople(communityAndSubIDs, seenPeople);

		for (const person of people) {
			const post = Post.hydrate(person.post).json({
				with_mii: true,
				topic_tag: true
			});

			post.community_id = 0xFFFFFFFF; // * Make this match above. This is how it was in the real WWP. Unsure why, but it works

			// * Post.json() defaults title_id to '' when the post itself has
			// * none set (e.g. posts made in a generic non-game community
			// * like Off-topic never had one to record) - confirmed live
			// * 2026-08-25 that a real console renders the whole topic
			// * (icon, name) but shows no post/person content at all when
			// * its posts carry an empty title_id, while topics whose posts
			// * have a real one display fine. Fall back to the community's
			// * own title_id here specifically for WWP, rather than changing
			// * the shared Post model default used elsewhere in the app.
			if (!post.title_id && community.title_id[0]) {
				post.title_id = community.title_id[0];
			}

			topic.people.push({
				person: {
					posts: [
						{
							post
						}
					]
				}
			});

			seenPeople.push(person._id);
		}

		// * Skip communities with fewer than 2 people entirely, rather than
		// * sending a thin topic the console just renders as empty/blank -
		// * confirmed live 2026-08-25 that a topic with exactly 1 person
		// * renders empty on a real console just like one with 0, while
		// * topics with several people (9, 17) render fine. Exact minimum
		// * threshold isn't confirmed beyond ">1"; drop at <2 rather than
		// * guess higher and lose more real content than necessary.
		if (topic.people.length < 2) {
			continue;
		}

		topic.position = topics.length + 1;

		topics.push({
			topic: topic
		});
	}

	return {
		has_error: 0,
		version: 1,
		expire: moment().add(2, 'days').format('YYYY-MM-DD HH:MM:SS'),
		request_name: 'topics',
		topics
	};
}

async function getCommunityPeople(communityIDs: string[], seenPeople: number[]): Promise<{ _id: number; post: IPost }[]> {
	// * All-time instead of a recent-hours window with an expanding-window
	// * fallback (previously started at 24h and doubled until 20+ people were
	// * found or the window reached back before 2020) - with as few real
	// * posters as currently exist, that fallback was already expanding all
	// * the way back for most communities in practice anyway, so this is more
	// * honest about what actually happens and simpler.
	return Post.aggregate<{ _id: number; post: IPost }>([
		{
			$match: {
				community_id: {
					$in: communityIDs
				},
				message_to_pid: null,
				parent: null,
				removed: false,
				pid: {
					// * Exclude people already shown in another community - a
					// * person should only appear once across the whole
					// * result. Which community gets first claim on a shared
					// * person is now randomized (selectRandomCommunities'
					// * shuffle decides processing order), and a community
					// * left with zero people afterward is dropped entirely
					// * (see generateTopicsData) rather than sent as a blank
					// * "?" slot.
					$nin: seenPeople
				}
			}
		},
		{
			$group: {
				_id: '$pid',
				post: {
					$first: '$$ROOT'
				}
			}
		},
		{
			$sample: { size: 70 } // * Random selection instead of natural/insertion order. Size arbitrary, same as before.
		}
	]);
}

async function selectRandomCommunities(limit: number): Promise<HydratedCommunityDocument[]> {
	// * Pure random selection instead of ranking by post/empathy count - with
	// * only a handful of real active communities and posters right now,
	// * "most popular" just means "whichever few happened to post most
	// * recently", which isn't meaningfully different from random anyway,
	// * and random avoids always showing the exact same communities.
	// *
	// * Top-level only (type 0) - briefly tried also allowing sub-communities
	// * (type 1) as independent topics, but a real console refused to show
	// * them (confirmed live 2026-08-25). Root cause looks structural, not a
	// * missing/wrong field: getCommunityByTitleID's own comment notes that
	// * every sub-community under a region shares its parent's exact
	// * title_id array, so resolving a topic's title_id back to a community
	// * is inherently ambiguous between a sub and its own parent - if the
	// * console does any consistency check when opening a Plaza entry, a
	// * sub's topic would very plausibly fail it regardless of what other
	// * fields (like parent) claim, since the ambiguity is between multiple
	// * different documents sharing one title_id, not a property of any
	// * single one. Reverted rather than chasing a per-field workaround for
	// * that.
	const topLevelCommunities = await Community.find({ type: 0 });

	// * Only consider communities that actually have at least one real post
	// * (directly or via a sub-community rolled into it) - a community with
	// * none would just get dropped as empty later anyway (see
	// * generateTopicsData), so exclude it from the random draw up front
	// * instead of wasting a slot on a guaranteed-empty pick.
	const communityIDsWithPosts = new Set(
		await Post.distinct('community_id', { message_to_pid: null, parent: null, removed: false })
	);
	const subsByParent = new Map<string, string[]>();
	for (const c of await Community.find({ type: 1 }, { olive_community_id: 1, parent: 1 })) {
		if (c.parent) {
			const list = subsByParent.get(c.parent) ?? [];
			list.push(c.olive_community_id);
			subsByParent.set(c.parent, list);
		}
	}
	const eligibleCommunities = topLevelCommunities.filter(c => {
		if (communityIDsWithPosts.has(c.olive_community_id)) {
			return true;
		}
		const subs = subsByParent.get(c.olive_community_id) ?? [];
		return subs.some(subID => communityIDsWithPosts.has(subID));
	});

	if (eligibleCommunities.length === 0) {
		throw new Error('No communities found');
	}

	const effectiveLimit = Math.min(limit, eligibleCommunities.length);

	// * Fisher-Yates shuffle, then take the first effectiveLimit - the
	// * community count here is always small, so this is cheaper and
	// * simpler than a database-side $sample.
	const shuffled = [...eligibleCommunities];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled.slice(0, effectiveLimit);
}

export default router;
