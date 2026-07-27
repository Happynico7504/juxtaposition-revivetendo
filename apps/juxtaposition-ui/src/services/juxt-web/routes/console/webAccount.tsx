import express from 'express';
import { z } from 'zod';
import { parseReq } from '@/services/juxt-web/routes/routeUtils';
import { PortalWebAccountView } from '@/services/juxt-web/views/portal/webAccountView';
import type { WebLoginEntry } from '@/services/juxt-web/views/portal/webAccountView';
import { zodFallback } from '@/util';

export const webAccountRouter = express.Router();

webAccountRouter.get('/', async function (req, res) {
	const { query, params, auth } = parseReq(req, {
               query: z.object({
                       title_id: z.string().optional(),
                       msg: z.string().optional()
               }),
               params: z.object({
                       communityID: z.string().regex(/^[0-9]+$/).or(zodFallback(null))
               })
       });

	const pid = auth().pid;
	console.log(pid);

	let hasPassword = false;
	let logins: WebLoginEntry[] = [];
	try {
		const resp = await fetch(`http://127.0.0.1:9191/internal/web/status?pid=${pid}`);
		console.log(pid);
		if (resp.ok) {
			const data = await resp.json() as { has_password: boolean; logins: WebLoginEntry[] };
			hasPassword = data.has_password;
			logins = data.logins ?? [];
		}
	} catch { /* account-proxy unreachable */ }

	return res.jsx(
		<PortalWebAccountView hasPassword={hasPassword} logins={logins} msg={query.msg} />
	);
});

webAccountRouter.post('/set-password', async function (req, res) {
	const { auth, body } = parseReq(req, {
		body: z.object({
			password: z.string(),
			password2: z.string()
		})
	});
	const { password, password2 } = body;
	const pid = auth().pid;

	if (password.length < 8) {
		return res.redirect('/web-account?msg=short');
	}
	if (password !== password2) {
		return res.redirect('/web-account?msg=mismatch');
	}

	try {
		const resp = await fetch('http://127.0.0.1:9191/internal/web/set-password', {
			method: 'POST',
			body: new URLSearchParams({ pid: String(pid), password }),
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		});
		if (!resp.ok) {
			return res.redirect('/web-account?msg=err');
		}
	} catch {
		return res.redirect('/web-account?msg=err');
	}

	return res.redirect('/web-account?msg=ok');
});
