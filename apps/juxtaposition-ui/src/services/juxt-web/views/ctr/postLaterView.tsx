import { useUser } from '@/services/juxt-web/views/common/hooks/useUser';
import { T } from '@/services/juxt-web/views/common/components/T';
import { CtrPageBody, CtrRoot } from '@/services/juxt-web/views/ctr/root';
import { CtrPageTitledHeader } from '@/services/juxt-web/views/ctr/components/CtrPageHeader';
import { CtrPostComposeFields } from '@/services/juxt-web/views/ctr/components/CtrPostComposeFields';
import type { ReactNode } from 'react';

export function CtrPostLaterView(): ReactNode {
	const user = useUser();
	return (
		<div className="add-post-page">
			<CtrPageTitledHeader
				data-toolbar-mode="wide"
				data-toolbar-message={T.str('new_post.post_later')}
			>
				<T k="new_post.post_later" />
			</CtrPageTitledHeader>
			<div
				id="post-later-form"
				className="posts-form"
				data-limit-text={T.str('new_post.saved_posts_limit')}
			>
				<CtrPostComposeFields userPid={user.pid} />
				<input
					type="button"
					id="submit"
					className="post-button"
					value={T.str('global.save')}
				/>
			</div>
		</div>
	);
}

export function CtrPostLaterPage(): ReactNode {
	return (
		<CtrRoot title={T.str('new_post.post_later')}>
			<CtrPageBody>
				<CtrPostLaterView />
			</CtrPageBody>
		</CtrRoot>
	);
}
