import express from 'express';
import { z } from 'zod';
import { parseReq } from '@/services/juxt-web/routes/routeUtils';
import { PortalWSCPlayersView, PortalWSCPlayersBodyOnly } from '@/services/juxt-web/views/portal/wscPlayersView';
import { CtrWSCPlayersView } from '@/services/juxt-web/views/ctr/wscPlayersView';
import type { WSCPlayersData } from '@/services/juxt-web/views/portal/wscPlayersView';

export const wscPlayersRouter = express.Router();

const WSC_API_URL = 'http://127.0.0.1:9004/wsc-public/api/players';

async function fetchWSCData(): Promise<WSCPlayersData> {
	try {
		const res = await fetch(WSC_API_URL, { signal: AbortSignal.timeout(2000) });
		return (await res.json()) as WSCPlayersData;
	} catch {
		return { server_up: false, players: [], gatherings: [] };
	}
}

wscPlayersRouter.get('/', async function (req, res) {
	const { query } = parseReq(req, {
		query: z.object({ pjax: z.stringbool().optional() })
	});

	const data = await fetchWSCData();

	if (query.pjax) {
		return res.jsx(<PortalWSCPlayersBodyOnly data={data} />, false);
	}

	return res.jsxForDirectory({
		portal: <PortalWSCPlayersView data={data} />,
		ctr: <CtrWSCPlayersView data={data} />
	});
});
