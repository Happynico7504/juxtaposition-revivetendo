import { getUserAccountData, getUserDataFromServiceToken, getUserDataFromToken, getValueFromHeaders } from '@/util';
import { errors } from '@/services/internal/errors';
import { getUserContent, getUserSettings } from '@/database';
import { Settings } from '@/models/settings';
import { Content } from '@/models/content';
import type express from 'express';
import type { GetUserDataResponse } from '@pretendonetwork/grpc/account/v2/get_user_data_rpc';

/**
 * Handles authentication for service (NNAS/console) and OAuth (web) tokens. Sets locals.account to AccountData.
 * Will error if tokens bad or account nonexistent, but otherwise does not check bans or setup status.
 */
export async function authPopulate(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
	// Used by console applets
	const serviceToken = getValueFromHeaders(request.headers, 'x-service-token');
	// Used by web frontend
	const oAuthToken = getValueFromHeaders(request.headers, 'x-oauth-token');

	if (serviceToken && oAuthToken) {
		throw errors.for('bad_request', 'Multiple authentication tokens provided');
	}

	let pnid: GetUserDataResponse | null = null;
	if (serviceToken) {
		pnid = await consoleAuth(request, serviceToken);
	} else if (oAuthToken) {
		pnid = await webAuth(request, oAuthToken);
	}

	if (pnid !== null) {
		// Null here just means the initial setup isn't done
		let settings = await getUserSettings(pnid.pid);
		let content = await getUserContent(pnid.pid);

		// Web (password) logins are already gated on having a real, previously-registered
		// Wii U device - account-proxy's handleInternalAuth requires a wii_devices row
		// (populated only by an actual console connecting once) before it will issue a
		// token at all, for both the real-Pretendo-password path and the web_password_hash
		// bypass path. So a web login reaching this point already proves prior Wii U
		// ownership, same as it would for a console - the normal way these documents get
		// created (a console's first-run flow) just isn't reachable for a user who's
		// banned from Pretendo (and so can't get their Wii U through NASC), even though
		// they're otherwise a legitimate user. Console logins (x-service-token) don't get
		// this treatment: they still have their normal first-run flow available, and we
		// don't want to guess at defaults on their behalf.
		if (oAuthToken && (!settings || !content)) {
			if (!settings) {
				settings = await Settings.create({
					pid: pnid.pid,
					screen_name: pnid.mii?.name || pnid.username
				});
			}
			if (!content) {
				content = await Content.create({ pid: pnid.pid });
			}
		}

		const moderator = accountIsModerator(pnid);
		const developer = accountIsDeveloper(pnid);

		response.locals.account = { pnid, settings, moderator, developer, content };
	} else {
		// Guest access
		response.locals.account = null;
	}

	return next();
}

async function consoleAuth(_request: express.Request, serviceToken: string): Promise<GetUserDataResponse> {
	const pnid: GetUserDataResponse | null = await getUserDataFromServiceToken(serviceToken);
	if (!pnid) {
		throw errors.for('unauthorized', 'Invalid service token!');
	}
	return pnid;
}

async function webAuth(request: express.Request, oAuthToken: string): Promise<GetUserDataResponse> {
	// The "normal" getUserData API (used here) is mutually incompatible with the "backdoor" one.
	// Since we can only use the backdoor one for consoles right now...
	const pid = (await getUserDataFromToken(oAuthToken).catch((e) => {
		// TODO should probably check the error type here in case of e.g. connection refused
		request.log.error(e, 'Failed to get user data from OAuth token');
		throw errors.for('unauthorized', 'Invalid OAuth token!');
	})).pid;
	// Ask the "backdoor" API, just use the above as a glorified token decryption.
	const pnid = await getUserAccountData(pid);

	return pnid;
}

function accountIsModerator(pnid: GetUserDataResponse): boolean {
	// AL2 can always moderate...
	if (pnid.accessLevel >= 2) {
		return true;
	}

	// Lower-level accounts can also have permission granted
	if (pnid.permissions?.moderateMiiverse === true) {
		return true;
	}

	return false;
}

function accountIsDeveloper(pnid: GetUserDataResponse): boolean {
	if (pnid.accessLevel === 3) {
		return true;
	}

	return false;
}
