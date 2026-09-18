/* app.js — ttJudgeScoring entry point.
 *
 * Two screens, no router: Login -> Schedule, and back. The flight scoring
 * panel is not a third screen — Scripts/MeetTNT.js swaps #dgTNTFlight in
 * for #pnSchedule inside the Schedule screen, exactly as it does in
 * apps/LiveMeet.
 *
 * The judge login flow itself lives in MeetTNT.js and is NOT reimplemented
 * here: InitMeetJudgeLogin(), ValidateJudgePIN() and
 * MeetLoadedForJudgeSchedule() are the same functions the old TeamWeb
 * pages ran. This module supplies the two things a single page needs that
 * two documents did not — a screen switch instead of a redirect, and the
 * judge identity carried in memory instead of in a query string.
 */

import * as TNT from './tnt.js';

/* Session and judge identity, held here rather than in the URL.

   The old app passed these as query parameters because the two screens
   were two documents with a meetWeb.dll redirect between them
   (ttJudgeLogin.html -> meetWeb.dll/ttJudgeSchedule?JudgeId=..&SessionId=..).
   In one page they are just state — which also keeps a judge's session id
   out of the address bar, browser history and any Referer header. */
let judgeSession = { sessionId: '', judgeId: '', judgeName: '' };

/* ------------------------------------------------------------------
   Screens
   ------------------------------------------------------------------ */

function showScreen(sId) {
  $('.tt-screen').addClass('d-none');
  $('#' + sId).removeClass('d-none');
}

function bootFailure(sHead, sBody) {
  $('.tt-screen').addClass('d-none');
  $('#ttBootMsgHead').text(sHead);
  $('#ttBootMsgBody').text(sBody);
  $('#ttBootMsg').removeClass('d-none');
}

/* ------------------------------------------------------------------
   Login screen
   ------------------------------------------------------------------ */

/* Stop the 30s schedule poll SetupJudgesRefresh() started.

   Needed on the way OUT — it keeps firing against a session the judge has
   just left, and every tick throws once that session is gone — and on a
   REFRESH, because MeetLoadedForJudgeSchedule calls SetupJudgesRefresh
   again, so without stopping first every refresh would leave another timer
   running against the same schedule. */
function stopScheduleTimer() {
  try {
    if (typeof judgeScheduleTimer !== 'undefined' && judgeScheduleTimer !== null) {
      Visibility.stop(judgeScheduleTimer);
      judgeScheduleTimer = null;
    }
  } catch (err) { /* timer never started */ }
}

function showLogin() {
  stopScheduleTimer();

  judgeSession = { sessionId: '', judgeId: '', judgeName: '' };
  $('#JudgeLoginEvent').val('');
  $('#edPIN').val('');
  $('#txPINMsgs').html('');
  $('#acJudge').empty();

  showScreen('screen-login');
  /* InitMeetJudgeLogin re-reads the ssJudgeAccess cookie and decides which
     of the two panels to show, so it has to run on every return to the
     login screen — not once at boot. It also (re)constructs
     thePageController with the pre-session apiKey needed to call
     ValidateMeetJudgeAccess. */
  InitMeetJudgeLogin();
}

/* ------------------------------------------------------------------
   Schedule screen
   ------------------------------------------------------------------ */

/* Called by ValidateJudgePIN via the window.ttJudgePINValidated seam once
   a PIN checks out. `resp` is jsonData.Response: JudgeId, JudgeName,
   StartSessionId. */
function onPINValidated(resp) {
  judgeSession.sessionId = String(resp.StartSessionId || '');
  judgeSession.judgeId   = String(resp.JudgeId || '');
  judgeSession.judgeName = String(resp.JudgeName || '');

  if (judgeSession.sessionId === '' || judgeSession.judgeId === '') {
    bootFailure('Unable to open your schedule',
                'The PIN was accepted but the server did not return a judge session. ' +
                'Please try again, or ask the meet organizer to check your judge record.');
    return;
  }
  openSchedule();
}

function openSchedule() {
  /* MeetTNT.js reads these hidden inputs directly rather than taking
     parameters, so they have to be populated before anything else runs.
     #JudgeName is what $('#txJudgeName') is filled from. */
  $('#SessionId').val(judgeSession.sessionId);
  $('#JudgeId').val(judgeSession.judgeId);
  $('#JudgeName').val(judgeSession.judgeName);

  /* NON-EMPTY IS THE WHOLE POINT. UserHasReadOnlyAccess() (MeetTNT.js:379)
     is `($('#JudgeLoginEvent').val() != '') || (FReadOnlyModeClubId > 0)`,
     so this value is what tells the shared engine it is running for a
     judge and not an organizer — it hides the organizer-only operations on
     the flight panel. LiveMeet pins the same input BLANK for the opposite
     reason. The session id is used as the marker simply because it is a
     non-empty string that is meaningful in a log. */
  $('#JudgeLoginEvent').val(judgeSession.sessionId);

  showScreen('screen-schedule');

  /* Fragments first: MeetLoadedForJudgeSchedule() clones #tmAccordionItem
     and #tmFlightCard (both in index.html), but opening a flight from it
     needs #dgTNTFlight from the shared TNTDialogs.html, and the score
     panel needs the shared TNTTemplates.html. Loading them before the
     schedule paints means the Open button can never be pressed before the
     panel it opens exists. */
  TNT.ensureLoaded().then(function () {
    InitMeetJudgeSchedule(judgeSession.sessionId, judgeSession.judgeId);
  }).catch(function (err) {
    bootFailure('Unable to load the scoring panel',
                'The flight scoring panel could not be loaded (' + err.message + '). ' +
                'Please refresh the page.');
  });
}

/* The Refresh button, via the window.ttJudgeRefreshSchedule seam that
   RefreshJudgeSchedule() in MeetTNT.js checks for.

   That function is location.reload() for the old TeamWeb page, which
   carries JudgeId and SessionId in its query string and so comes back
   logged in. This app holds them in memory, so a reload dropped the judge
   straight back to PIN entry — Refresh behaved as Log out.

   Rebuilding in place needs two things done first that a page reload used
   to get for free:
     - stop the poll timer, or SetupJudgesRefresh leaves a second one running
     - EMPTY #acJudge, because MeetLoadedForJudgeSchedule only ever appends;
       without this the accordion doubles on every press. */
function refreshSchedule() {
  if (judgeSession.sessionId === '') { showLogin(); return; }
  stopScheduleTimer();
  $('#acJudge').empty();
  InitMeetJudgeSchedule(judgeSession.sessionId, judgeSession.judgeId);
}

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */

function boot() {
  /* Shims before anything from MeetTNT.js or ssMeetAccess.js runs —
     ssMeetAccess.js calls MeetDisciplineCode() from its own paths. */
  TNT.installShims();

  /* The seams MeetTNT.js checks for instead of navigating. Publishing them
     is what converts this from two documents into one page; the old
     ttJudgeScoring/ttJudgeLogin.html publishes neither and keeps its
     redirects unchanged. */
  window.ttJudgePINValidated    = onPINValidated;
  window.ttJudgeShowLogin       = showLogin;
  window.ttJudgeRefreshSchedule = refreshSchedule;

  showLogin();
}

/* Boot handshake with the classic-script world. ssLoadScripts.js loads the
   framework asynchronously while this module is deferred, so whichever
   finishes last starts the app — index.html sets __ttFrameworkReady and
   calls window.ttBoot, and this checks the flag itself in case the
   framework won the race. */
window.ttBoot = boot;
if (window.__ttFrameworkReady) boot();
