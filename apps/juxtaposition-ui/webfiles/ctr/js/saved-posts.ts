import { pjaxLoadUrl } from './pjax';

// The 3DS saves posts composed while offline into the shared cave.lls_* key/value
// store, keyed by the unix timestamp they were saved at (JSON: feeling, spoiler,
// text, titleID, screenShotKey, paint - this is the real format the system's own
// "Offline Mode" composer applet writes). That applet only writes/lists/deletes -
// it has no network access, so submitting a saved post once back online has to
// happen through the normal post form.
export type SavedPost = {
	feeling: number;
	spoiler: boolean;
	text: string | null;
	titleID?: string;
	screenShotKey?: string;
	paint?: string;
};

function isSavedPostKey(key: string): boolean {
	return /^[0-9]+$/.test(key);
}

export function readSavedPost(key: string): SavedPost | null {
	var raw = cave.lls_getItem(key);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw) as SavedPost;
	} catch {
		return null;
	}
}

export function getSavedPosts(): Array<{ key: string; post: SavedPost }> {
	var out: Array<{ key: string; post: SavedPost }> = [];
	var count = cave.lls_getCount();
	for (var i = 0; i < count; i++) {
		var key = cave.lls_getKeyAt(i);
		if (!isSavedPostKey(key)) {
			continue;
		}
		var post = readSavedPost(key);
		if (post) {
			out.push({ key: key, post: post });
		}
	}
	// Newest first, matching the real offline composer's own ordering.
	out.sort((a, b) => Number(b.key) - Number(a.key));
	return out;
}

export function removeSavedPost(key: string): void {
	var post = readSavedPost(key);
	if (post?.screenShotKey) {
		cave.lls_removeItem(post.screenShotKey);
	}
	cave.lls_removeItem(key);
}

// Submitting the post form is a normal (non-AJAX) navigation, so there's no success
// callback to hook here - on submit the compose page just remembers which saved post
// it's trying to upload. If the server rejects it, it redisplays the same page with an
// error and the saved post is left alone so the user can retry. Any other page load
// (success redirects elsewhere, or #add-post-page re-renders without an error) means it
// went through, so this gets checked - and acted on - on every page init.
export var PENDING_UPLOAD_KEY = '__pendingSavedPostUpload';

export function resolvePendingSavedPostUpload(): void {
	var pendingKey = cave.lls_getItem(PENDING_UPLOAD_KEY);
	if (!pendingKey) {
		return;
	}

	var failedRetry = document.querySelector('#add-post-page .error-text');
	if (failedRetry) {
		return;
	}

	removeSavedPost(pendingKey);
	cave.lls_removeItem(PENDING_UPLOAD_KEY);
}

// Set by the community page right before navigating to its compose page, so the
// compose page knows to preload a specific saved post once it lands.
export var LOAD_ON_COMPOSE_KEY = '__loadSavedPostOnCompose';

function render(list: HTMLElement, onSelect: (key: string, post: SavedPost) => void): void {
	var posts = getSavedPosts();
	list.innerHTML = '';

	if (posts.length === 0) {
		var empty = document.createElement('p');
		empty.className = 'saved-posts-empty';
		empty.textContent = list.getAttribute('data-empty-text');
		list.appendChild(empty);
		return;
	}

	var paintingText = list.getAttribute('data-painting-text');
	posts.forEach((entry) => {
		var item = document.createElement('div');
		item.className = 'saved-post';

		var preview = document.createElement('a');
		preview.href = '#';
		preview.className = 'saved-post-preview';
		preview.textContent = entry.post.text !== null && entry.post.text !== undefined
			? entry.post.text
			: paintingText;
		preview.addEventListener('click', (e) => {
			e.preventDefault();
			onSelect(entry.key, entry.post);
		});
		item.appendChild(preview);

		var del = document.createElement('button');
		del.type = 'button';
		del.className = 'saved-post-delete symbol';
		del.textContent = '×';
		del.addEventListener('click', () => {
			removeSavedPost(entry.key);
			render(list, onSelect);
		});
		item.appendChild(del);

		list.appendChild(item);
	});
}

// Wires up a [data-saved-posts-toggle] button + #saved-posts-list menu on whichever
// page has them. onSelect decides what picking a saved post actually does there.
export function initSavedPostsToggle(onSelect: (key: string, post: SavedPost) => void): void {
	var toggle = document.querySelector('[data-saved-posts-toggle]');
	var list = document.getElementById('saved-posts-list');
	if (!toggle || !list) {
		return;
	}

	toggle.addEventListener('click', (e) => {
		e.preventDefault();
		var opening = list.classList.contains('none');
		if (opening) {
			render(list, onSelect);
		}
		list.classList.toggle('none');
	});
}

// On the community page: selecting a saved post hands it off to the compose page
// instead of loading it directly here.
export function initCommunitySavedPosts(): void {
	var list = document.getElementById('saved-posts-list');
	if (!list) {
		return;
	}
	var createUrl = list.getAttribute('data-create-url');
	if (!createUrl) {
		return;
	}

	initSavedPostsToggle((key) => {
		cave.lls_setItem(LOAD_ON_COMPOSE_KEY, key);
		pjaxLoadUrl(createUrl, true);
	});
}
