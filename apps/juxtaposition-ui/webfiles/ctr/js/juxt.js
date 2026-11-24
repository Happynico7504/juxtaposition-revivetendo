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
// of these itself) through its own posting applet, "solv3" - a separate system title,
// not a page we can serve. Each region ships its own copy; try all three known title
// IDs (JPN/USA/EUR; low ID confirmed USA = ...008b02 via 3dbrew's title list, high ID
// 00040030 since solv3/olv are both "System Applets" there, not "System Applications"
// which use 00040010 - that wrong prefix is why the first version of this never found
// solv3 on real hardware) and jump
// to whichever exists on this console. jump_setNumberDataToApp's first argument (12) and
// jump_toApplication's (2) are the only values ever observed for this call pair in a
// real capture - what they actually mean isn't documented, so this is best-effort.
var SOLV3_TITLE_IDS = [
	'0004003000008302', // JPN
	'0004003000008b02', // USA
	'000400300000ba02' // EUR
];

function openSavedPosts(el) {
	var communityId = el.getAttribute('data-community-id');

	// DIAGNOSTIC: show what jump_existsApplication actually says for each candidate,
	// since it's reporting false for all three even with the corrected title IDs - either
	// the existence check itself doesn't apply to this title category, or something about
	// the ID string format is still off. Report what this dialog says back verbatim.
	var report = [];
	var titleId = null;
	for (var i = 0; i < SOLV3_TITLE_IDS.length; i++) {
		var id = SOLV3_TITLE_IDS[i];
		var exists;
		try {
			exists = cave.jump_existsApplication(id);
		} catch (e) {
			exists = 'threw: ' + e;
		}
		report.push(id + ' = ' + exists);
		if (exists === true && !titleId) {
			titleId = id;
		}
	}
	cave.dialog_oneButton('Saved Posts (debug)', report.join('\n'), 'OK');

	// Try the jump anyway, using the USA ID, regardless of what jump_existsApplication said -
	// the check itself might just be wrong/inapplicable for this title category.
	titleId = titleId || SOLV3_TITLE_IDS[1];
	cave.jump_setNumberDataToApp(12, parseInt(communityId, 10));
	cave.jump_toApplication(2, titleId);
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
