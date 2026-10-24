import express from 'express';
import xmlbuilder from 'xmlbuilder';
import { getEndpoint } from '@/database';
import { ApiErrorCode, badRequest, serverError } from '@/errors';
import { larimarPortalHostFor } from '@/larimar';
import type { HydratedEndpointDocument } from '@/models/endpoint';

const router = express.Router();

/* GET discovery server. */
router.get('/', async function (request: express.Request, response: express.Response): Promise<void> {
	response.type('application/xml');

	let discovery: HydratedEndpointDocument | null;

	if (request.user) {
		discovery = await getEndpoint(request.user.serverAccessLevel);
	} else {
		discovery = await getEndpoint('prod');
	}

	if (!discovery) {
		request.log.error(`Discovery data is missing for ${request.user?.serverAccessLevel}`);
		return serverError(response, ApiErrorCode.NO_DISCOVERY_DATA);
	}

	if (discovery.status > 0 && discovery.status <= 7) {
		return badRequest(response, discovery.status);
	} else if (discovery.status !== 0) {
		request.log.error(`Discovery status ${discovery.status} unexpected for ${request.user?.serverAccessLevel}`);
		return serverError(response, ApiErrorCode.NO_DISCOVERY_DATA);
	}

	// Only the portal moves to Larimar: in-game posting, Wii Sports Club,
	// Badge Arcade and Wara Wara Plaza stay on Juxt's api_host.
	const larimarPortalHost = request.user ? await larimarPortalHostFor(request.user.pid, request.paramPack) : null;

	response.send(xmlbuilder.create({
		result: {
			has_error: 0,
			version: 1,
			endpoint: {
				host: discovery.host,
				api_host: discovery.api_host,
				portal_host: larimarPortalHost ?? discovery.portal_host,
				n3ds_host: discovery.n3ds_host
			}
		}
	}).end({ pretty: true }));
});

export default router;
