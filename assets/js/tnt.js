/* tnt.js — adapts Scripts/MeetTNT.js for the judge app.
 *
 * The counterpart to apps/LiveMeet/assets/js/shared/meettnt.js, and
 * deliberately NOT that file. Three things differ enough that sharing the
 * loader would mean branching inside it on which app is running:
 *
 *   1. #JudgeLoginEvent. LiveMeet pins it BLANK ("this is never a judge
 *      login"); this app SETS it. That single value is what puts
 *      MeetTNT.js into read-only-for-judges mode.
 *   2. The meet re-fetch. LiveMeet re-fetches an existing thisMeet held by
 *      its page.js/router with widened child codes. This app has no
 *      router: it fetches 'active' once, for the judge's meet.
 *   3. ssdialog.js. LiveMeet re-routes TNT dialogs onto Bootstrap modals
 *      because its dialogs sit inside a sidebar layout. The judge app has
 *      no sidebar and opens far fewer dialogs, so it keeps real jQuery UI
 *      and does not carry that module.
 *
 * Everything WITHOUT app-specific content lives in the shared module
 * instead — the Tournaments.js shims and the fragment/script loaders. Only
 * the differences above are implemented here. The markup and skin are
 * shared too: TNTDialogs.html, TNTTemplates.html and tnt.css all come from
 * apps/_shared/tnt.
 *
 * ES module: import * as TNT from './tnt.js';
 */

import * as Shims from '/apps/_shared/js/tnt-shims.js';

/* Body-level hosts for the two shared fragments. Ids kept as lm* rather
   than tt*: they are just container divs, and matching LiveMeet means one
   less thing that differs between two apps running identical panel code.

   The fragments themselves are the SAME FILES LiveMeet loads (see
   Shims.FRAGMENT_FOLDER). MeetTNT.js resolves everything in them by bare
   id, so a per-app copy would be two definitions of one contract and would
   drift — it already did once, when #btRefreshFlightScores existed in one
   host's copy and not the others. */
const TEMPLATE_HOST = "#lmTntTemplates";
const DIALOG_HOST   = "#lmTntDialogs";

let templatesLoaded = false;
let dialogsLoaded   = false;

/* ------------------------------------------------------------------
   Shims
   ------------------------------------------------------------------ */

/* MeetTNT.js is a classic script and resolves these off the global scope —
   it cannot import. Must run before any of its functions execute.

   No skipDialogResize predicate: this app does not re-route dialogs onto
   Bootstrap modals, so every dialog is a real jQuery UI box and the
   measurement in AdjustDialogHeight is always valid. */
export function installShims() {
  if (window.__ttTntShims) return;

  const notPortedYet = Shims.installCommonShims({
    appName: "ttJudgeScoring",
    notPortedMessage: "This action isn't available in the judge app."
  });

  /* PrepMeetClass is LiveMeet's re-fetch-with-child-codes entry point. This
     app fetches its meet once, in app.js, so nothing here should call it —
     but MeetTNT.js's organizer paths do, and a judge reaching one means a
     screen leaked through that should have been hidden. Loud stub. */
  window.PrepMeetClass = notPortedYet("PrepMeetClass");

  window.__ttTntShims = true;
}

/* ------------------------------------------------------------------
   Shared fragments
   ------------------------------------------------------------------ */

/* Resolves once both shared fragments are in the DOM. Memoised: the
   templates and dialogs are page-level, not screen-level, and their
   contents are resolved by bare id — a second copy would create duplicate
   ids and every lookup would bind whichever came first. */
let loadPromise = null;
export function ensureLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = (async function () {
    if (!templatesLoaded) { await Shims.loadFragmentOnce("TNTTemplates", TEMPLATE_HOST); templatesLoaded = true; }
    if (!dialogsLoaded)   { await Shims.loadFragmentOnce("TNTDialogs",   DIALOG_HOST);   dialogsLoaded   = true; }
    return true;
  })().catch(function (err) {
    loadPromise = null;   // let the next attempt retry rather than caching a rejection
    console.error("[ttJudgeScoring] TNT panel failed to load:", err);
    throw err;
  });

  return loadPromise;
}
