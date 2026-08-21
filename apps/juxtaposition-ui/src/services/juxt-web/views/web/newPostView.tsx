import { T } from '@/services/juxt-web/views/common/components/T';
import { useUrl } from '@/services/juxt-web/views/common/hooks/useUrl';
import { useUser } from '@/services/juxt-web/views/common/hooks/useUser';
import type { ReactNode } from 'react';
import type { CommunityShotMode } from '@/models/communities';
import type { Community } from '@/api/generated';

const empathies = [
	{
		value: 0,
		miiFaceFile: 'normal_face.png',
		sound: 'SE_WAVE_MII_FACE_00',
		className: 'feeling-button-normal',
		isDefault: true
	},
	{
		value: 1,
		miiFaceFile: 'smile_open_mouth.png',
		sound: 'SE_WAVE_MII_FACE_01',
		className: 'feeling-button-happy'
	},
	{
		value: 2,
		miiFaceFile: 'wink_left.png',
		sound: 'SE_WAVE_MII_FACE_02',
		className: 'feeling-button-like'
	},
	{
		value: 3,
		miiFaceFile: 'surprise_open_mouth.png',
		sound: 'SE_WAVE_MII_FACE_03',
		className: 'feeling-button-surprised'
	},
	{
		value: 4,
		miiFaceFile: 'frustrated.png',
		sound: 'SE_WAVE_MII_FACE_04',
		className: 'feeling-button-frustrated'
	},
	{
		value: 5,
		miiFaceFile: 'sorrow.png',
		sound: 'SE_WAVE_MII_FACE_05',
		className: 'feeling-button-puzzled'
	}
];

export type NewPostViewProps = {
	id: string;
	// must provide name OR pid
	name?: string;
	pid?: number;
	url: string;
	show: string;
	// must provide messagePid OR community
	messagePid?: number;
	community?: Community;
	shotMode: CommunityShotMode;

	// Error feedback
	errorText?: string;
};

export function WebNewPostView(props: NewPostViewProps): ReactNode {
	const url = useUrl();
	const user = useUser();
	return (
		<>
			<div id="add-post-page" className="add-post-page official-user-post" style={{ display: 'none' }}>
				<form method="post" action={props.url} id="posts-form" data-is-own-title="1" data-is-identified="1">
					{props.errorText ? <p>{props.errorText}</p> : null}
					<input type="hidden" name="community_id" value={props.id} />
					<div className="add-post-page-content">
						<div className="feeling-selector expression">
							<img src={url.cdn(`/mii/${user.pid}/normal_face.png`)} id="mii-face" className="icon" />
							<ul className="buttons">
								{empathies.map(v => (
									<li key={v.value}>
										<input
											type="radio"
											name="feeling_id"
											value={v.value}
											className={v.className}
											data-mii-face-url={url.cdn(`/mii/${user.pid}/${v.miiFaceFile}`)}
											defaultChecked={v.isDefault}
											data-sound={v.sound}
										/>
									</li>
								))}
							</ul>
						</div>
						<div className="textarea-container textarea-with-menu active-text">
							<menu className="textarea-menu">
								<li className="textarea-menu-text">
									<input type="radio" name="_post_type" value="body" defaultChecked data-sound="" evt-click="openText()" />
								</li>
								<li className="textarea-menu-memo">
									<input type="radio" name="_post_type" value="painting" data-sound="" evt-click="newPainting(false)" />
								</li>
							</menu>
							<textarea id="new-post-text" name="body" className="textarea-text" value="" maxLength={280} placeholder={T.str('new_post.content_placeholder')}></textarea>
							<div id="new-post-memo" className="textarea-memo trigger" data-sound="" evt-click="newPainting(false)" style={{ display: 'none' }}>
								<img id="memo" className="textarea-memo-preview" src="" />
								<input id="memo-value" type="hidden" name="painting" />
							</div>
						</div>
						<label className="checkbox-container spoiler-button">
							<T k="new_post.spoiler_label" />
							<input type="checkbox" id="spoiler" name="spoiler" value="true" />
							<span className="checkmark"></span>
						</label>
					</div>
					<div id="button-wrapper">
						<input id="message_to_pid" type="hidden" name="message_to_pid" value={props.messagePid ?? undefined} />
						<input
							type="button"
							className="olv-modal-close-button fixed-bottom-button left"
							value="Cancel"
							data-sound="SE_WAVE_CANCEL"
							data-module-show={props.show}
							data-module-hide="add-post-page"
							data-header="true"
							data-menu="true"
						/>
						<input type="submit" className="post-button fixed-bottom-button" value="Post" />
					</div>
				</form>
			</div>
			<div id="painting-wrapper" className="painting-wrapper" style={{ display: 'none' }}>
				<div id="painting-content">
					<div className="tools">
						<div>
							<button className="clear" evt-click="clearCanvas()"></button>
							<button className="undo" evt-click="undo()"></button>
						</div>
						<div>
							<ul className="buttons pencil">
								<li>
									<input evt-click="setPen(0)" type="radio" value="0" className="pencil small" name="tool" defaultChecked />
								</li>
								<li>
									<input evt-click="setPen(1)" type="radio" value="1" className="pencil medium" name="tool" />
								</li>
								<li>
									<input evt-click="setPen(2)" type="radio" value="2" className="pencil large" name="tool" />
								</li>
							</ul>
							<ul className="buttons eraser">
								<li>
									<input evt-click="setEraser(0)" type="radio" value="0" className="eraser small" name="tool" />
								</li>
								<li>
									<input evt-click="setEraser(1)" type="radio" value="1" className="eraser medium" name="tool" />
								</li>
								<li>
									<input evt-click="setEraser(2)" type="radio" value="2" className="eraser large" name="tool" />
								</li>
							</ul>
						</div>
					</div>
					<canvas width="320" height="120" id="painting" />
					<div id="button-wrapper">
						<button evt-click="closePainting(false)"><T k="new_post.painting_close" /></button>
						<button className="primary" evt-click="closePainting(true)"><T k="new_post.painting_submit" /></button>
					</div>
				</div>
				<script src="/assets/web/js/painting.global.js" />
			</div>
		</>
	);
}
