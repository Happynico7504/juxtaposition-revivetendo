import moment from 'moment';
import { PortalPageBody, PortalRoot } from '@/services/juxt-web/views/portal/root';
import { PortalNavBar } from '@/services/juxt-web/views/portal/components/PortalNavBar';
import type { ReactNode, CSSProperties } from 'react';

export type WebLoginEntry = {
	ip: string;
	logged_at: string;
	success: boolean;
};

export type WebAccountViewProps = {
	hasPassword: boolean;
	logins: WebLoginEntry[];
	msg?: string;
};

const s: Record<string, CSSProperties> = {
	body:    { padding: '8px 256px' },
	ok:      { color: '#2a7a2a', background: '#d4edda', padding: '8px 12px', borderRadius: 4, marginBottom: 12 },
	err:     { color: '#721c24', background: '#f8d7da', padding: '8px 12px', borderRadius: 4, marginBottom: 12 },
	status:  { fontSize: 16, color: '#555', marginBottom: 14 },
	label:   { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
	input:   { width: '100%', boxSizing: 'border-box', padding: '7px 8px', marginBottom: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 32 },
	input2:  { width: '100%', boxSizing: 'border-box', padding: '7px 8px', marginBottom: 10, border: '1px solid #ccc', borderRadius: 4, fontSize: 32 },
	button:  { background: '#0077cc', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontSize: 16, cursor: 'pointer' },
	section: { marginTop: 20 },
	table:   { width: '100%', fontSize: 16, borderCollapse: 'collapse' },
	th:      { textAlign: 'left', padding: '4px 6px', color: '#555', borderBottom: '1px solid #ddd' },
	td:      { padding: '4px 6px', borderBottom: '1px solid #f0f0f0' },
};

export function PortalWebAccountView(props: WebAccountViewProps): ReactNode {
	return (
		<PortalRoot title="Web Access">
			<PortalNavBar selection={9} />
			<PortalPageBody>
				<header id="header">
					<h1 id="page-title">Web Access</h1>
				</header>
				<div className="body-content tab2-content" id="news-page">
					<div className="tab-body" style={s.body}>
						{props.msg === 'ok' && <p style={s.ok}>Web password updated successfully.</p>}
						{props.msg === 'mismatch' && <p style={s.err}>Passwords do not match.</p>}
						{props.msg === 'short' && <p style={s.err}>Password must be at least 8 characters.</p>}
						{props.msg === 'err' && <p style={s.err}>Failed to set password. Try again.</p>}

						<p style={s.status}>
							{props.hasPassword
								? 'A web password is set. You can log in at olv-web.nicochristmann.net.'
								: 'No web password is set. Set one below to enable web access.'}
						</p>

						<form method="POST" action="/web-account/set-password">
							<p style={s.label}>{props.hasPassword ? 'Change web password' : 'Set web password'}</p>
							<input type="password" name="password" placeholder="New password (min 8 chars)" required minLength={8} style={s.input} />
							<input type="password" name="password2" placeholder="Confirm password" required style={s.input2} />
							<button type="submit" style={s.button}>Save</button>
						</form>

						{props.logins.length > 0 && (
							<div style={s.section}>
								<p style={s.label}>Recent web logins</p>
								<table style={s.table}>
									<thead>
										<tr>
											<th style={s.th}>IP</th>
											<th style={s.th}>Time</th>
											<th style={s.th}>Result</th>
										</tr>
									</thead>
									<tbody>
										{props.logins.map((entry, i) => (
											<tr key={i}>
												<td style={s.td}>{entry.ip}</td>
												<td style={s.td}>{moment(entry.logged_at).fromNow()}</td>
												<td style={{ ...s.td, color: entry.success ? '#2a7a2a' : '#c0392b' }}>
													{entry.success ? 'OK' : 'Failed'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</PortalPageBody>
		</PortalRoot>
	);
}
