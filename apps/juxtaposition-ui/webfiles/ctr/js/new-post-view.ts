import { ctabOnShown } from './controls/ctabs';

export function initNewPostView(): void {
	var page = document.querySelector('#add-post-page');
	if (!page) {
		return;
	}
	var ctab = page.querySelector('[data-ctabs-control]')!;

	// paintings
	var memo_image = page.querySelector('img#memo-img-input')! as HTMLImageElement;
	var memo_input = page.querySelector('input[name="painting"]')! as HTMLInputElement;
	function memo(): void {
		cave.memo_open();
		if (!cave.memo_hasValidImage()) {
			return;
		}

		var image_data = cave.memo_getImageBmp();
		memo_image.src = 'data:image/bmp;base64,' + image_data;
		memo_input.value = image_data;
	}
	// Let click animations finish playing before calling memo open
	function delayedMemo(): void {
		setTimeout(memo, 75);
	}
	memo_image.addEventListener('click', delayedMemo);
	ctabOnShown(ctab, 'painting', delayedMemo);

	initScreenshotControl(page, ctab);
	initSavedPosts(page, memo_image, memo_input);
}

// The 3DS saves posts composed while offline into the shared cave.lls_* key/value
// store, keyed by the unix timestamp they were saved at (JSON: feeling, spoiler,
// text, titleID, screenShotKey, paint - this is the real format the system's own
// "Offline Mode" composer applet writes). That applet only writes/lists/deletes -
// it has no network access, so submitting a saved post once back online has to
// happen from here, through the normal post form.
type SavedPost = {
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

function readSavedPost(key: string): SavedPost | null {
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

function getSavedPosts(): Array<{ key: string; post: SavedPost }> {
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

function removeSavedPost(key: string): void {
	var post = readSavedPost(key);
	if (post?.screenShotKey) {
		cave.lls_removeItem(post.screenShotKey);
	}
	cave.lls_removeItem(key);
}

// Submitting the post form is a normal (non-AJAX) navigation, so there's no success
// callback to hook here - on submit we just remember which saved post we're trying to
// upload. If the server rejects it, it redisplays this same page with an error and we
// leave the saved post alone so the user can retry. Any other page load (success
// redirects elsewhere, or #add-post-page re-renders without an error) means it went
// through, so this gets checked - and acted on - on every page init.
var PENDING_UPLOAD_KEY = '__pendingSavedPostUpload';

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

function initSavedPosts(page: Element, memo_image: HTMLImageElement, memo_input: HTMLInputElement): void {
	var toggle = document.querySelector('[data-saved-posts-toggle]');
	var list = document.getElementById('saved-posts-list');
	if (!toggle || !list) {
		return;
	}

	var feelingInputs = page.querySelectorAll('input[name="feeling_id"]') as NodeListOf<HTMLInputElement>;
	var postTypeInputs = page.querySelectorAll('input[name="_post_type"]') as NodeListOf<HTMLInputElement>;
	var bodyInput = page.querySelector('textarea[name="body"]') as HTMLTextAreaElement;
	var spoilerInput = page.querySelector('input[name="spoiler"]') as HTMLInputElement;
	var shotUpload = page.querySelector('[data-shot-upload]') as HTMLInputElement | null;
	var shotPreview = page.querySelector('[data-shot-preview]') as HTMLElement | null;

	var loadedKey: string | null = null;

	function setPostType(value: string): void {
		postTypeInputs.forEach((input) => {
			input.checked = input.value === value;
			input.dispatchEvent(new Event('change'));
		});
	}

	function loadSavedPost(key: string, post: SavedPost): void {
		feelingInputs.forEach((input) => {
			input.checked = input.value === String(post.feeling);
		});

		spoilerInput.checked = !!post.spoiler;
		spoilerInput.dispatchEvent(new Event('change'));

		if (post.text !== null && post.text !== undefined) {
			bodyInput.value = post.text;
			bodyInput.dispatchEvent(new Event('input'));
			setPostType('body');
		} else if (post.paint) {
			memo_image.src = 'data:image/bmp;base64,' + post.paint;
			memo_input.value = post.paint;
			setPostType('painting');
		}

		if (post.screenShotKey && shotUpload) {
			shotUpload.setAttribute('lls', post.screenShotKey);
			if (shotPreview) {
				shotPreview.style.backgroundImage = `url(${cave.lls_getPath(post.screenShotKey)})`;
			}
		}

		loadedKey = key;
		list!.classList.add('none');
	}

	function render(): void {
		var posts = getSavedPosts();
		list!.innerHTML = '';

		if (posts.length === 0) {
			var empty = document.createElement('p');
			empty.className = 'saved-posts-empty';
			empty.textContent = list!.getAttribute('data-empty-text');
			list!.appendChild(empty);
			return;
		}

		var paintingText = list!.getAttribute('data-painting-text');
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
				loadSavedPost(entry.key, entry.post);
			});
			item.appendChild(preview);

			var del = document.createElement('button');
			del.type = 'button';
			del.className = 'saved-post-delete symbol';
			del.textContent = '×';
			del.addEventListener('click', () => {
				removeSavedPost(entry.key);
				render();
			});
			item.appendChild(del);

			list!.appendChild(item);
		});
	}

	toggle.addEventListener('click', (e) => {
		e.preventDefault();
		var opening = list!.classList.contains('none');
		if (opening) {
			render();
		}
		list!.classList.toggle('none');
	});

	page.addEventListener('submit', () => {
		if (loadedKey) {
			cave.lls_setItem(PENDING_UPLOAD_KEY, loadedKey);
			loadedKey = null;
		}
	});
}

function initScreenshotControl(page: Element, ctab: Element): void {
	// screenshots
	var shot_tab = page.querySelector('[data-shot-mode]') as HTMLElement | null;
	if (shot_tab === null) {
		return;
	}
	var shotMode = shot_tab.getAttribute('data-shot-mode')!;
	// Hide on game's request
	if (shotMode === 'allow' && !cave.capture_isEnabled()) {
		shot_tab.style.display = 'none';
		return;
	}

	// input type file
	var shotUpload = page.querySelector('[data-shot-upload]') as HTMLInputElement;
	// radios
	var shots = page.querySelectorAll('[data-shot]') as NodeListOf<HTMLInputElement>;
	var shotClear = page.querySelector('[data-shot-clear]') as HTMLInputElement;
	// preview
	var shotPreview = page.querySelector('[data-shot-preview]') as HTMLImageElement;

	// top/bottom screen picker
	function pickShot(e: Event): void {
		var me = e.currentTarget as HTMLInputElement;
		var lls = me.getAttribute('data-lls')!;

		shotPreview.style.backgroundImage = `url(${cave.lls_getPath(lls)})`;
		shotUpload.setAttribute('lls', lls);
	}
	shots.forEach(s => s.addEventListener('change', pickShot));

	// has to be enabled at submission
	page.addEventListener('submit', () => {
		// Fidget with disabled to keep it out of the D-pad navigation
		shotUpload.disabled = false;
		shotUpload.focus();
		shotUpload.click();
		shotUpload.blur();
	});

	// reset/clear button
	shotClear.addEventListener('change', () => {
		shotPreview.style.backgroundImage = '';
		shotUpload.removeAttribute('lls');
		shotUpload.value = '';
	});

	// actually populate the images after page load (laggy)
	function shot(e: Event): void {
		shots.forEach((s) => {
			var num = parseInt(s.getAttribute('data-shot')!);
			var lls = s.getAttribute('data-lls')!;

			cave.lls_setCaptureImage(lls, num);
			s.style.backgroundImage = `url(${cave.lls_getPath(lls)})`;
		});

		// no need to call more than once per load
		e.currentTarget?.removeEventListener(e.type, shot);
	}

	ctabOnShown(ctab, 'shot', shot);
}
