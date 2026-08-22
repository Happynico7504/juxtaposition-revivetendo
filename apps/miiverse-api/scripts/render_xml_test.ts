import xmlbuilder from 'xmlbuilder';
import { connect } from '@/database';
import { Community } from '@/models/community';

async function main() {
	await connect();
	const parentCommunity = await Community.findOne({ community_id: '1350269191' });
	const communities = await Community.find({ parent: '1350269191' }).limit(16);
	const result = {
		has_error: 0,
		version: 1,
		request_name: 'communities',
		communities: communities.map(c => ({ community: c.json() }))
	};
	const xml = xmlbuilder.create({ result }, { separateArrayItems: true }).end({ pretty: true, allowEmpty: true });
	console.log('TOTAL LENGTH:', xml.length);
	console.log(xml.slice(0, 3000));
	console.log('...');
	console.log(xml.slice(-1500));
	process.exit(0);
}
main();
