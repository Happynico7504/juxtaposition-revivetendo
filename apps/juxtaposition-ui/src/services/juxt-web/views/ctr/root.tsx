import fs from 'node:fs';
import path from 'node:path';
import { useRequest } from '@/services/juxt-web/views/common/hooks/useRequest';
import { distFolder } from '@/util';
import type { ReactNode } from 'react';

// Inlined rather than loaded via <script src>: the 3DS's ssl:C module can't
// reliably sustain many concurrent TLS handshakes to the same host (confirmed
// via packet capture - some connections get a genuine TLS Alert from the 3DS
// itself, "unexpected message"), and pages with several community icons open
// enough parallel image-loading connections to occasionally take the script
// tag's own connection down with them. Images already degrade gracefully via
// the placeholder-gif fallback in this bundle's own error handler; the script
// that installs that handler has no such fallback, so it has to not be one of
// the connections racing for a handshake slot in the first place. Read once
// at startup rather than per-request.
// Escaped defensively in case a future build ever embeds this substring (e.g.
// in a string literal) - it would otherwise prematurely close the inline tag.
const juxtGlobalJs = fs.readFileSync(path.join(distFolder, 'webfiles', 'ctr', 'js', 'juxt.global.js'), 'utf-8')
	.replaceAll('</script', '<\\/script');

export type DefaultHeadProps = {
	preventJsLoad?: boolean;
};

function DefaultHead(props: DefaultHeadProps): ReactNode {
	const req = useRequest();
	const loadJs = !props.preventJsLoad;
	const addDebugJs = !req.userAgent.isConsole; // Only serve debug js to non-console browsers
	return (
		<>
			<link rel="stylesheet" type="text/css" href="/assets/ctr/css/juxt.css" />
			{/* Debug allows non-console browsers to have some amount of the cave API. */}
			{addDebugJs ? <script src="/assets/ctr/js/debug.global.js"></script> : null}
			{/* Non-console browsers probably want this too. */}
			{addDebugJs ? <meta name="viewport" content="width=device-width, initial-scale=1.0" /> : null}
			{loadJs ? <script dangerouslySetInnerHTML={{ __html: juxtGlobalJs }} /> : null}
		</>
	);
}

export type HtmlProps = {
	children?: ReactNode;
	head?: ReactNode;
	title: string;
	onLoad?: string;
	preventJsLoad?: boolean;
};

export function CtrRoot(props: HtmlProps): ReactNode {
	return (
		<html lang="en">
			<head>
				<DefaultHead preventJsLoad={props.preventJsLoad} />
				<title>{props.title}</title>
				{props.head}
			</head>
			<body evt-load={props.onLoad ?? ''}>{props.children}</body>
		</html>
	);
}

export function CtrPageBody(props: { children?: ReactNode }): ReactNode {
	return <div id="body">{props.children}</div>;
}
