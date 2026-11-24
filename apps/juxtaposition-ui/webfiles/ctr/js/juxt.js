import './polyfills';
import { initCheckboxes } from './controls/checkbox';
import { initClientTabs } from './controls/ctabs';
import { initNewPostView } from './new-post-view';
import { pjaxBack, pjaxCanGoBack, pjaxInit, pjaxLoadUrl, pjaxRefresh } from './pjax';
import { initPostPageView, initYeahButton } from './post';
import { initToolbarConfigs } from './toolbar';
import { GET, POST } from './xhr';
import { initNavTabs } from './components/ui/CtrNavTabs';
import { initSearchForm } from './components/ui/CtrSearchForm';

setInterval(checkForUpdates, 30000);

cave.toolbar_setCallback(1, back);
cave.toolbar_setCallback(99, back);
cave.toolbar_setCallback(2, function () {
	cave.toolbar_setActiveButton(2);
	pjaxLoadUrl('/feed', true);
});
cave.toolbar_setCallback(3, function () {
	cave.toolbar_setActiveButton(3);
	pjaxLoadUrl('/titles', true);
});
cave.toolbar_setCallback(4, function () {
	cave.toolbar_setActiveButton(4);
	checkForUpdates();
	pjaxLoadUrl('/news/my_news', true);
});
cave.toolbar_setCallback(5, function () {
	cave.toolbar_setActiveButton(5);
	pjaxLoadUrl('/users/me', true);
});
cave.toolbar_setCallback(8, function () { });

export function initPosts() {
	var els = document.querySelectorAll('.post-content[data-href]');
	if (!els) {
		return;
	}
	for (var i = 0; i < els.length; i++) {
		els[i].addEventListener('click', function (e) {
			pjaxLoadUrl(e.currentTarget.getAttribute('data-href'), true);
		});
	}
	initYeahButton(document);
	initSpoilers();
}

function initSpoilers() {
	var els = document.querySelectorAll('button[data-post-id]');
	if (!els) {
		return;
	}
	for (var i = 0; i < els.length; i++) {
		els[i].addEventListener('click', function (e) {
			var el = e.currentTarget;
			var spoilerWrapper = document.getElementById('spoiler-' + el.getAttribute('data-post-id'));
			var postEl = document.getElementById('post-' + el.getAttribute('data-post-id'));

			postEl.classList.remove('spoiler');
			spoilerWrapper.outerHTML = '';
			cave.snd_playSe('SE_OLV_OK');
		});
	}
}
function back() {
	if (!pjaxCanGoBack()) {
		cave.toolbar_setButtonType(0);
	} else {
		pjaxBack();
	}
}

function stopLoading() {
	if (window.location.href.indexOf('/titles/show/first') !== -1) {
		return;
	}
	cave.transition_end();
	cave.lls_setItem('agree_olv', '1');
	cave.snd_playBgm('BGM_CAVE_MAIN');
	cave.toolbar_setVisible(true);
}
window.stopLoading = stopLoading;

function initAll() {
	initPosts();
	initNewPostView();
	initNavTabs();
	initPostPageView();
	initClientTabs();
	initCheckboxes();
	initSearchForm();
	checkForUpdates();
	initToolbarConfigs();
	pjaxRefresh();
}

function checkForUpdates() {
	GET('/users/notifications.json', function updates(data) {
		var notificationObj = JSON.parse(data.responseText);
		var count =
			notificationObj.message_count + notificationObj.notification_count;
		cave.toolbar_setNotificationCount(count);
	});
}

function follow(el) {
	var id = el.getAttribute('data-community-id');
	var count = document.getElementById('followers');
	var sprite = el.querySelector('.sprite.sp-yeah');
	el.disabled = true;
	var params = 'id=' + id;
	if (sprite.classList.toggle('selected')) {
		cave.snd_playSe('SE_OLV_MII_ADD');
	} else {
		cave.snd_playSe('SE_OLV_CANCEL');
	}

	POST(el.getAttribute('data-url'), params, function a(data) {
		var response = JSON.parse(data.responseText);
		if (!response || response.status !== 200) {
			// Apparently there was an actual error code for not being able to yeah a post, who knew!
			// TODO: Find more of these
			return cave.error_callErrorViewer(155927);
		}
		el.disabled = false;
		count.innerText = response.follower_count;
		if (response.action === 'follow') {
			el.classList.add('selected');
		} else {
			el.classList.remove('selected');
		}
	});
}
window.follow = follow;

function saveUserSettings() {
	document.getElementById('submit').click();
}
window.saveUserSettings = saveUserSettings;

// The real Miiverse resubmits a post composed while offline (the console saves up to 3
// of these itself) through its own posting applet, "solv3". Turns out jump_toApplication
// isn't the right call for it at all: per libctru/3dbrew, solv3 is a *Library Applet*
// (APT_StartLibraryApplet, AppID 0x118 - APPID_MIIVERSE_POSTING), launched by suspending
// the caller and resuming it afterward, not by switching titles the way jump_toApplication
// does (that's why it tried to read a game card - it treats its argument as a title to
// switch to, not an applet to overlay). cave has no documented function for this pattern,
// so as a next-cheapest guess: try passing the AppID itself, in different plausible string
// encodings, through jump_toApplication's titleID argument instead of a real title ID.
// Each tap of the button tries the next format in this list and remembers where it left
// off (cave.ls_* - native sessionStorage bridge, used instead of the real sessionStorage
// object since this old WebKit doesn't reliably support it) so a redeploy isn't needed
// between attempts - tap, see what happens, report back, come back and tap again.
var SOLV3_APPID_GUESSES = [
	'118',
	'0118',
	'00000118',
	'0x118',
	'280',
	'0000011800000000'
];

function openSavedPosts(el) {
	var communityId = el.getAttribute('data-community-id');

	var i = parseInt(cave.ls_getItem('savedPostsGuessIndex') || '0', 10);
	if (!(i >= 0) || i >= SOLV3_APPID_GUESSES.length) {
		i = 0;
	}
	var guess = SOLV3_APPID_GUESSES[i];
	cave.ls_setItem('savedPostsGuessIndex', (i + 1).toString());

	cave.dialog_oneButton(
		'Saved Posts (debug)',
		'Attempt ' + (i + 1) + '/' + SOLV3_APPID_GUESSES.length + ': "' + guess + '"',
		'OK'
	);

	cave.jump_setNumberDataToApp(12, parseInt(communityId, 10));
	cave.jump_toApplication(2, guess);
}
window.openSavedPosts = openSavedPosts;
function exitUserSettings() {
	pjaxLoadUrl('/users/me', true);
	cave.toolbar_setButtonType(1);
}
window.exitUserSettings = exitUserSettings;

document.addEventListener('DOMContentLoaded', function () {
	pjaxInit({
		elements: 'a[data-pjax]',
		selectors: ['title', '#body']
	});
	console.debug('Pjax initialized.');
	initAll();
	stopLoading();
});
document.addEventListener('PjaxRequest', function () {
	cave.transition_begin();
});
document.addEventListener('PjaxDone', function () {
	initAll();
	cave.brw_scrollImmediately(0, 0);
	if (pjaxCanGoBack()) {
		cave.toolbar_setButtonType(1);
	} else {
		cave.toolbar_setButtonType(0);
	}
	cave.requestGc();
	cave.transition_end();
});

/* CTR WebKit has an odd bug where images that fail to load throw off the
 * entire page render, spritesheets, layout.
 * Ensuring we have *something* loaded seems to fix it.
 * Ideally we never trigger this since we don't have page errors, but it happens,
 * especially when selfhosting. */
document.addEventListener('error', (e) => {
	var placeholder = '/assets/ctr/images/placeholder.gif';
	var target = e.target;
	if (target.tagName === 'IMG' && target.getAttribute('src') !== placeholder) {
		target.setAttribute('src', placeholder);
	}
}, true);
