import { PortalPageBody, PortalRoot } from '@/services/juxt-web/views/portal/root';
import { PortalNavBar } from '@/services/juxt-web/views/portal/components/PortalNavBar';
import { PortalMiiIcon } from '@/services/juxt-web/views/portal/components/ui/PortalMiiIcon';
import type { ReactNode } from 'react';

export type WSCPlayer = {
	pid: number;
	pnid: string;
	mii_name?: string;
};

export type WSCGathering = {
	gid: number;
	sport_name: string;
	host_pnid: string;
	player_count: number;
	max_players: number;
	open: boolean;
	players: WSCPlayer[];
};

export type WSCPlayersData = {
	server_up: boolean;
	players: WSCPlayer[];
	gatherings: WSCGathering[];
};

export type WSCPlayersViewProps = {
	data: WSCPlayersData;
};

function WSCPlayersBody({ data }: WSCPlayersViewProps): ReactNode {
	return (
		<div className="body-content" id="wsc-players">
			<style>{`
				#wsc-players { padding: 0 8px; }
				.wsc-section-title { font-size: 14px; font-weight: bold; color: #666; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; }
				.wsc-player-list { list-style: none; margin: 0; padding: 0; }
				.wsc-player-item { display: flex; align-items: center; padding: 6px 4px; border-bottom: 1px solid #f0f0f0; }
				.wsc-player-item .icon-container { margin-right: 8px; flex-shrink: 0; }
				.wsc-player-item .icon-container .mii-icon { width: 40px; height: 40px; }
				.wsc-player-name { font-size: 13px; font-weight: bold; }
				.wsc-player-pnid { font-size: 11px; color: #888; }
				.wsc-gathering { background: #f7f7f7; border-radius: 6px; margin-bottom: 8px; padding: 8px 10px; }
				.wsc-gathering-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
				.wsc-gathering-sport { font-size: 13px; font-weight: bold; }
				.wsc-gathering-count { font-size: 11px; color: #888; }
				.wsc-gathering-players { display: flex; gap: 8px; flex-wrap: wrap; }
				.wsc-gathering-player { display: flex; align-items: center; gap: 4px; }
				.wsc-gathering-player .mii-icon { width: 32px; height: 32px; }
				.wsc-gathering-player-name { font-size: 11px; }
				.wsc-offline { color: #999; font-size: 13px; padding: 16px 4px; text-align: center; }
				.wsc-open-badge { font-size: 10px; background: #4caf50; color: #fff; border-radius: 3px; padding: 1px 5px; }
				.wsc-closed-badge { font-size: 10px; background: #e53935; color: #fff; border-radius: 3px; padding: 1px 5px; }
			`}</style>
			{!data.server_up ? (
				<p className="wsc-offline">WSC server is offline.</p>
			) : (data.players ?? []).length === 0 ? (
				<p className="wsc-offline">No players online.</p>
			) : (
				<>
					{(data.gatherings ?? []).length > 0 && (
						<>
							<p className="wsc-section-title">Active Games</p>
							{data.gatherings.map(g => (
								<div className="wsc-gathering" key={g.gid}>
									<div className="wsc-gathering-header">
										<span className="wsc-gathering-sport">{g.sport_name}</span>
										<span>
											<span className="wsc-gathering-count">{g.player_count}/{g.max_players} </span>
											{g.open
												? <span className="wsc-open-badge">Open</span>
												: <span className="wsc-closed-badge">In Match</span>
											}
										</span>
									</div>
									<div className="wsc-gathering-players">
										{(g.players ?? []).map(p => (
											<div className="wsc-gathering-player" key={p.pid}>
												<PortalMiiIcon pid={p.pid} type="mii-icon" />
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
					<p className="wsc-section-title">Online ({data.players.length})</p>
					<ul className="wsc-player-list">
						{data.players.map(p => (
							<li className="wsc-player-item" key={p.pid}>
								<span className="icon-container">
									<PortalMiiIcon pid={p.pid} type="mii-icon" />
								</span>
								<span>
									<div className="wsc-player-name">{p.mii_name || p.pnid || `PID:${p.pid}`}</div>
									{p.pnid && <div className="wsc-player-pnid">@{p.pnid}</div>}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}

const autoRefreshInlineScript = `(function(){
  if(window._wscRefreshTimer){clearInterval(window._wscRefreshTimer);window._wscRefreshTimer=null;}
  window._wscRefreshTimer=setInterval(function(){
    var x=new XMLHttpRequest();
    x.open('GET','/wsc-players?pjax=true',true);
    x.onload=function(){
      if(x.status===200){
        var d=document.createElement('div');
        d.innerHTML=x.responseText;
        var n=d.querySelector('#wsc-players');
        var e=document.getElementById('wsc-players');
        if(n&&e)e.parentNode.replaceChild(n,e);
      }
    };
    x.send();
  },5000);
  document.addEventListener('pjax:send',function stopWsc(){
    clearInterval(window._wscRefreshTimer);
    window._wscRefreshTimer=null;
    document.removeEventListener('pjax:send',stopWsc);
  });
})();`;

function WSCAutoRefreshScript(): ReactNode {
	return <script dangerouslySetInnerHTML={{ __html: autoRefreshInlineScript }} />;
}

export function PortalWSCPlayersView(props: WSCPlayersViewProps): ReactNode {
	return (
		<PortalRoot title="WSC Players" onLoad="stopLoading();wiiuBrowser.lockUserOperation(false);">
			<PortalNavBar selection={3} />
			<PortalPageBody>
				<header id="header">
					<h1 id="page-title" className="left">WSC Players</h1>
				</header>
				<WSCPlayersBody data={props.data} />
				<WSCAutoRefreshScript />
			</PortalPageBody>
		</PortalRoot>
	);
}

export function PortalWSCPlayersBodyOnly(props: WSCPlayersViewProps): ReactNode {
	return (
		<div id="body">
			<header id="header">
				<h1 id="page-title" className="left">WSC Players</h1>
			</header>
			<WSCPlayersBody data={props.data} />
			<WSCAutoRefreshScript />
		</div>
	);
}
