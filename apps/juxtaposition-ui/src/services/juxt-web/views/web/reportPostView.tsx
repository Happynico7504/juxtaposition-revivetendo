export type ReportPostViewProps = {
	id: string;
	// Where the report form posts to. Defaults to `/posts/${id}/report` (see ctr/portal
	// reportPostView.tsx) — override for reporting content that isn't a community post,
	// e.g. a DM message via `/friend_messages/${conversationId}/${id}/report`.
	action?: string;
};
