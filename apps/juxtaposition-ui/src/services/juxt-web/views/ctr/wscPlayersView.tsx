import { CtrPageBody, CtrRoot } from '@/services/juxt-web/views/ctr/root';
import { CtrPageTitledHeader } from '@/services/juxt-web/views/ctr/components/CtrPageHeader';
import { CtrMiiIcon } from '@/services/juxt-web/views/ctr/components/ui/CtrMiiIcon';
import type { ReactNode } from 'react';
import type { WSCPlayersViewProps } from '@/services/juxt-web/views/portal/wscPlayersView';

export function CtrWSCPlayersView({ data }: WSCPlayersViewProps): ReactNode {
	return (
		<CtrRoot title="WSC Players">
			<CtrPageBody>
				<CtrPageTitledHeader data-toolbar-mode="normal">
					WSC Players
				</CtrPageTitledHeader>
				<div className="body-content" id="wsc-players">
					<style>{`
						#wsc-players { padding: 0 16px; }
						.wsc-section-title { font-size: 28px; font-weight: bold; color: #666; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e0e0e0; }
						.wsc-player-list { list-style: none; margin: 0; padding: 0; }
						.wsc-player-item { display: flex; align-items: center; padding: 12px 8px; border-bottom: 1px solid #f0f0f0; }
						.wsc-player-item .icon-container { margin-right: 16px; flex-shrink: 0; }
						.wsc-player-name { font-size: 26px; font-weight: bold; }
						.wsc-player-pnid { font-size: 22px; color: #888; }
						.wsc-gathering { background: #f7f7f7; border-radius: 12px; margin-bottom: 16px; padding: 16px 20px; }
						.wsc-gathering-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
						.wsc-gathering-sport { font-size: 26px; font-weight: bold; }
						.wsc-gathering-count { font-size: 22px; color: #888; }
						.wsc-gathering-players { display: flex; gap: 16px; flex-wrap: wrap; }
						.wsc-gathering-player { display: flex; align-items: center; gap: 8px; }
						.wsc-gathering-player-name { font-size: 22px; }
						.wsc-offline { color: #999; font-size: 26px; padding: 32px 8px; text-align: center; }
						.wsc-open-badge { font-size: 20px; background: #4caf50; color: #fff; border-radius: 6px; padding: 2px 10px; }
						.wsc-closed-badge { font-size: 20px; background: #e53935; color: #fff; border-radius: 6px; padding: 2px 10px; }
						.wsc-shame-list { list-style: none; margin: 0; padding: 0; }
						.wsc-shame-item { display: flex; align-items: center; padding: 12px 8px; border-bottom: 1px solid #f0f0f0; }
						.wsc-shame-item .icon-container { margin-right: 16px; flex-shrink: 0; }
						.wsc-shame-name { font-size: 26px; font-weight: bold; }
						.wsc-shame-reason { font-size: 22px; color: #b71c1c; }
					`}
					</style>
					{!data.server_up
						? <p className="wsc-offline">WSC server is offline.</p>
						: (data.players ?? []).length === 0
							? <p className="wsc-offline">No players online.</p>
							: (
									<>
										{(data.gatherings ?? []).length > 0 && (
											<>
												<p className="wsc-section-title">Active Games</p>
												{data.gatherings.map(g => (
													<div className="wsc-gathering" key={g.gid}>
														<div className="wsc-gathering-header">
															<span className="wsc-gathering-sport">{g.sport_name}</span>
															<span>
																<span className="wsc-gathering-count">
																	{g.player_count}
																	/
																	{g.max_players}
																	{' '}
																</span>
																{g.open
																	? <span className="wsc-open-badge">Open</span>
																	: <span className="wsc-closed-badge">In Match</span>}
															</span>
														</div>
														<div className="wsc-gathering-players">
															{(g.players ?? []).map(p => (
																<div className="wsc-gathering-player" key={p.pid}>
																	<CtrMiiIcon pid={p.pid} type="icon" />
																	<span className="wsc-gathering-player-name">
																		{p.mii_name || p.pnid || `PID:${p.pid}`}
																	</span>
																</div>
															))}
														</div>
													</div>
												))}
											</>
										)}
										<p className="wsc-section-title">
											Online (
											{data.players.length}
											)
										</p>
										<ul className="wsc-player-list">
											{data.players.map(p => (
												<li className="wsc-player-item" key={p.pid}>
													<span className="icon-container">
														<CtrMiiIcon pid={p.pid} type="icon" />
													</span>
													<span>
														<div className="wsc-player-name">{p.mii_name || p.pnid || `PID:${p.pid}`}</div>
														{p.pnid && <div className="wsc-player-pnid">@{p.pnid}</div>}
													</span>
												</li>
											))}
										</ul>
										{(data.nat_hall_of_shame ?? []).length > 0 && (
											<>
												<p className="wsc-section-title">NAT Hall of Shame</p>
												<ul className="wsc-shame-list">
													{data.nat_hall_of_shame!.map(p => {
														const minsLeft = Math.max(0, Math.ceil((p.blocked_until * 1000 - Date.now()) / 60000));
														return (
															<li className="wsc-shame-item" key={p.pid}>
																<span className="icon-container">
																	<CtrMiiIcon pid={p.pid} type="icon" />
																</span>
																<span>
																	<div className="wsc-shame-name">{p.mii_name || p.pnid || `PID:${p.pid}`}</div>
																	<div className="wsc-shame-reason">
																		Failed NAT traversal —
																		{' '}
																		{minsLeft}
																		m remaining
																	</div>
																</span>
															</li>
														);
													})}
												</ul>
											</>
										)}
									</>
								)}
				</div>
			</CtrPageBody>
		</CtrRoot>
	);
}
