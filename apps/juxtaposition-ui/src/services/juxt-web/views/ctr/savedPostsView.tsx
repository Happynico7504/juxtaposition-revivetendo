import { CtrPageBody, CtrRoot } from '@/services/juxt-web/views/ctr/root';
import { CtrPageTitledHeader } from '@/services/juxt-web/views/ctr/components/CtrPageHeader';
import { T } from '@/services/juxt-web/views/common/components/T';
import type { ReactNode } from 'react';

export type SavedPostsViewProps = {
	communityId: string;
};

export function CtrSavedPostsView(props: SavedPostsViewProps): ReactNode {
	return (
		<>
			<CtrPageTitledHeader
				data-toolbar-mode="normal"
				data-toolbar-active-button="3"
			>
				<T k="new_post.saved_posts" />
			</CtrPageTitledHeader>
			<div className="body-content">
				<div
					id="saved-posts-list"
					data-create-url={`/titles/${props.communityId}/create`}
					data-empty-text={T.str('new_post.saved_posts_empty')}
					data-painting-text={T.str('new_post.saved_posts_painting')}
				></div>
			</div>
		</>
	);
}

export function CtrSavedPostsPage(props: SavedPostsViewProps): ReactNode {
	return (
		<CtrRoot title={T.str('new_post.saved_posts')}>
			<CtrPageBody>
				<CtrSavedPostsView {...props} />
			</CtrPageBody>
		</CtrRoot>
	);
}
