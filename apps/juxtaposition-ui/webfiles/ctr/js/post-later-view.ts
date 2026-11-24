import { ctabOnShown } from './controls/ctabs';
import { getSavedPosts, MAX_SAVED_POSTS } from './saved-posts';
import { pjaxLoadUrl } from './pjax';

// Writes directly to the same cave.lls_* pool the real offline composer uses, under
// the same numeric-timestamp key convention, so it shares that applet's 3-post cap
// and shows up on the Saved Posts page exactly like a real offline-saved post would.
export function initPostLaterView(): void {
	var page = document.getElementById('post-later-form');
	if (!page) {
		return;
	}

	var limitText = page.getAttribute('data-limit-text') || '';

	function overLimit(): boolean {
		return getSavedPosts().length >= MAX_SAVED_POSTS;
	}

	if (overLimit()) {
		cave.dialog_oneButton('Post Later', limitText, 'OK');
		pjaxLoadUrl('/titles', true);
		return;
	}

	var ctab = page.querySelector('[data-ctabs-control]')!;
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
	function delayedMemo(): void {
		setTimeout(memo, 75);
	}
	memo_image.addEventListener('click', delayedMemo);
	ctabOnShown(ctab, 'painting', delayedMemo);

	var feelingInputs = page.querySelectorAll('input[name="feeling_id"]') as NodeListOf<HTMLInputElement>;
	var postTypeInputs = page.querySelectorAll('input[name="_post_type"]') as NodeListOf<HTMLInputElement>;
	var bodyInput = page.querySelector('textarea[name="body"]') as HTMLTextAreaElement;
	var spoilerInput = page.querySelector('input[name="spoiler"]') as HTMLInputElement;
	var submit = page.querySelector('#submit') as HTMLInputElement;

	submit.addEventListener('click', () => {
		if (overLimit()) {
			cave.dialog_oneButton('Post Later', limitText, 'OK');
			return;
		}

		var feeling = 0;
		feelingInputs.forEach((input) => {
			if (input.checked) {
				feeling = parseInt(input.value);
			}
		});

		var isPainting = false;
		postTypeInputs.forEach((input) => {
			if (input.checked && input.value === 'painting') {
				isPainting = true;
			}
		});

		var text = isPainting ? null : bodyInput.value;
		var paint = isPainting ? memo_input.value : undefined;
		if (!text && !paint) {
			return;
		}

		var post = {
			feeling: feeling,
			spoiler: spoilerInput.checked,
			text: text,
			paint: paint
		};
		cave.lls_setItem(String(cave.getLocalTimeSeconds()), JSON.stringify(post));
		pjaxLoadUrl('/titles', true);
	});
}
