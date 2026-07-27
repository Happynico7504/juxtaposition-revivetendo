import type { Request, RequestHandler } from 'express';
import { config } from '@/config';

export const detectVersion: RequestHandler = async (request, response, next) => {
	// Check the domain and set the directory
	if (request.hostname === config.domains.web || includes(request, 'juxt')) {
		request.directory = 'web';
		response.changeLanguage(null);
	} else {
		const ua = request.get('user-agent') ?? '';
		if (includes(request, 'portal') || ua.includes('Nintendo WiiU')) {
			request.directory = 'portal';
		} else {
			request.directory = 'ctr';
		}
	}

	request.isWrite = request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';

	next();
};

function includes(request: Request, domain: string): boolean {
	return request.subdomains.findIndex(element => element.includes(domain)) !== -1;
}

