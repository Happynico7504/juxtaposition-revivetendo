import { CtrTabsView, CtrTabView } from '@/services/juxt-web/views/ctr/controls/ctabs';
import { CtrCheckbox } from '@/services/juxt-web/views/ctr/controls/checkbox';
import { useUrl } from '@/services/juxt-web/views/common/hooks/useUrl';
import { T } from '@/services/juxt-web/views/common/components/T';
import type { ReactNode } from 'react';

export const empathies = [
	{
		value: 0,
		className: 'sprite sp-feeling-normal',
		isDefault: true
	},
	{
		value: 1,
		className: 'sprite sp-feeling-happy'
	},
	{
		value: 2,
		className: 'sprite sp-feeling-like'
	},
	{
		value: 3,
		className: 'sprite sp-feeling-surprise'
	},
	{
		value: 4,
		className: 'sprite sp-feeling-frustrated'
	},
	{
		value: 5,
		className: 'sprite sp-feeling-puzzled'
	}
];

export type CtrPostComposeFieldsProps = {
	userPid: number;
	// Extra tabs to render between the text tab and the painting tab - e.g. the
	// screenshot tab, which needs a specific community's shot permissions and so
	// isn't always applicable (Post Later has no community context at all).
	children?: ReactNode;
};

// Shared by the normal compose form (newPostView) and Post Later (postLaterView) -
// feeling selector, text/painting tabs, spoiler checkbox.
export function CtrPostComposeFields(props: CtrPostComposeFieldsProps): ReactNode {
	const url = useUrl();
	return (
		<div className="add-post-page-content">
			<div className="feeling-selector expression">
				<img src={url.cdn(`/mii/${props.userPid}/normal_face.png`)} className="icon" />
				<menu className="buttons">
					{empathies.map(v => (
						<input
							key={v.value}
							type="radio"
							name="feeling_id"
							value={v.value}
							className={v.className}
							defaultChecked={v.isDefault}
						/>
					))}
				</menu>
			</div>
			<CtrTabsView>
				<CtrTabView name="_post_type" value="body" sprite="sp-text-input" default>
					<textarea
						name="body"
						id="body-text-input"
						value=""
						maxLength={280}
						placeholder={T.str('new_post.content_placeholder')}
					/>
				</CtrTabView>
				{props.children}
				<CtrTabView name="_post_type" value="painting" sprite="sp-memo-input">
					<img id="memo-img-input" src="" />
					<input type="hidden" name="painting" />
				</CtrTabView>
				<div className="spoiler-checkbox">
					<label htmlFor="cb-spoiler"><T k="new_post.spoiler_label" /></label>
					<CtrCheckbox id="cb-spoiler" name="spoiler" value="true" sprite="sp-spoiler" />
				</div>
			</CtrTabsView>
		</div>
	);
}
