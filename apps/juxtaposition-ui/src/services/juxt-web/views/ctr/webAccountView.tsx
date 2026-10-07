import { CtrPageBody, CtrRoot } from '@/services/juxt-web/views/ctr/root';
import { CtrPageTitledHeader } from '@/services/juxt-web/views/ctr/components/CtrPageHeader';
import type { ReactNode, CSSProperties } from 'react';
import type { WebAccountViewProps } from '@/services/juxt-web/views/portal/webAccountView';

// Web-password setup for 3DS players (the Wii U portal has the same page). The
// password is what they use to sign in at the dashboard's /my/ area, which is
// where coins and Patreon are managed - so a 3DS-only player needs this too.
const s: Record<string, CSSProperties> = {
	note: { fontSize: 12, margin: '6px 0 8px', color: '#555' },
	ok: { fontSize: 12, margin: '6px 0', color: '#2a7a2a', fontWeight: 'bold' },
	err: { fontSize: 12, margin: '6px 0', color: '#c0392b', fontWeight: 'bold' },
	label: { fontSize: 12, fontWeight: 'bold', margin: '8px 0 2px' },
	input: { width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '4px 6px', border: '1px solid #999', borderRadius: 4 }
};

export function CtrWebAccountView(props: WebAccountViewProps): ReactNode {
	return (
		<CtrRoot title="Web Access">
			<CtrPageBody>
				<CtrPageTitledHeader
					data-toolbar-mode="wide"
					data-toolbar-message="Save"
					data-toolbar-bgm="BGM_CAVE_SETTING"
				>
					Web Access
				</CtrPageTitledHeader>
				<div className="body-content tab2-content" id="community-post-list">
					<div className="tab-body">
						<form method="post" action="/web-account/set-password" id="web-account-form">
							{props.msg === 'ok' && <p style={s.ok}>Web password updated.</p>}
							{props.msg === 'mismatch' && <p style={s.err}>Passwords do not match.</p>}
							{props.msg === 'short' && <p style={s.err}>Password must be at least 8 characters.</p>}
							{props.msg === 'err' && <p style={s.err}>Could not set the password. Try again.</p>}

							<p style={s.note}>
								{props.hasPassword
									? 'A web password is set. Use it with your PNID to sign in on the website.'
									: 'Set a web password to sign in on the website with your PNID (coins, Patreon, status).'}
							</p>

							<p style={s.label}>{props.hasPassword ? 'New password' : 'Password'} (min 8 characters)</p>
							<input type="password" name="password" required minLength={8} style={s.input} />
							<p style={s.label}>Confirm password</p>
							<input type="password" name="password2" required style={s.input} />

							<input id="submit" type="submit" className="post-button fixed-bottom-button" value="Save" />
						</form>
					</div>
				</div>
			</CtrPageBody>
		</CtrRoot>
	);
}
