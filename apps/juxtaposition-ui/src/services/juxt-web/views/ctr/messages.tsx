import cx from 'classnames';
import { CtrPageBody, CtrRoot } from '@/services/juxt-web/views/ctr/root';
import { useUrl } from '@/services/juxt-web/views/common/hooks/useUrl';
import { humanFromNow } from '@/util';
import { useCache } from '@/services/juxt-web/views/common/hooks/useCache';
import { useUser } from '@/services/juxt-web/views/common/hooks/useUser';
import { T } from '@/services/juxt-web/views/common/components/T';
import { CtrPageTitledHeader } from '@/services/juxt-web/views/ctr/components/CtrPageHeader';
import type { ReactNode } from 'react';
import type {
	ConversationUserModel,
	MessagesViewProps
} from '@/services/juxt-web/views/web/messages';

export function CtrMessagesView(props: MessagesViewProps): ReactNode {
	const cache = useCache();
	const user = useUser();
	const url = useUrl();

	return (
		<CtrRoot title={T.str('global.messages')}>
			<CtrPageBody>
				<CtrPageTitledHeader data-toolbar-mode="normal">
					<T k="global.messages" />
				</CtrPageTitledHeader>
				<div className="body-content" id="messages-list">
					<ul
						className="list-content-with-icon-column arrow-list"
						id="news-list-content"
					>
						{props.conversations.length === 0
							? (
									<p className="no-posts-text"><T k="messages.coming_soon" /></p>
								)
							: (
									props.conversations.map((convo) => {
										let userObj: ConversationUserModel | null = null;
										let me: ConversationUserModel | null = null;
										if (convo.users[0].pid === user.pid) {
											userObj = convo.users[1];
											me = convo.users[0];
										} else if (convo.users[1].pid === user.pid) {
											userObj = convo.users[0];
											me = convo.users[1];
										}
										if (!me || !userObj) {
											return null;
										}
										if (!userObj.pid || !me.pid) {
											return null;
										} // Prevent rendering with incomplete data

										return (
											<li key={convo.id}>
												<span className="icon-container">
													<img
														src={url.cdn(`/mii/${userObj.pid}/normal_face.png`)}
														className={cx('icon', { verified: userObj.official })}
													/>
												</span>
												<a
													href={`/friend_messages/${convo.id}`}
													data-pjax="#body"
													className="scroll to-community-button full"
												>
												</a>
												<div className="body message">
													<p>
														<span className="nick-name">
															{cache.getUserName(userObj.pid)}
														</span>
														<span className="id-name">
															{' @'}
															{props.usernames[userObj.pid] ?? cache.getUserName(userObj.pid)}
														</span>
														<span>
															{' '}
															{convo.message_preview}
														</span>
														<span className="timestamp">
															{' '}
															{humanFromNow(convo.last_updated)}
														</span>
													</p>
												</div>
											</li>
										);
									})
								)}
					</ul>
				</div>
			</CtrPageBody>
		</CtrRoot>
	);
}
