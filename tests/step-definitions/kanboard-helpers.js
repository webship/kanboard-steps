'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the steps use and that
// another pack can require instead of copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, signing in (the form, and a session put back: its cookies), the site's own API as the
// managing account (the test content a scenario makes and removes), the open task and its windows, and the tasks a
// scenario made, which go after it.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`, `waitForPageLoad`, `friendly`) so the
// steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [require.resolve('webship-js/package.json')] })); }

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 15 seconds (the site's screens load
 * their data after the page), so a slow screen does not fail an assertion that would pass a moment later. Kept below
 * webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 15000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case), for exact names and labels.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + words(text) + '\\s*$', 'i');
}

/**
 * The source of a pattern for a text whose words may stand apart by any white space: a pattern of a locator tests the
 * element's whole text, where the site's markup can put two spaces or a line break between words.
 *
 * @param {string} text
 * @returns {string}
 */
function words(text) {
  return escapeRegExp(String(text).trim()).replace(/\s+/g, '\\s+');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target, cause and a hint) instead of
 * Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match and fail with a friendly error
 * otherwise: the wait and the assertion are one call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value read, so a value that changes a moment
 * after the action (a status after a save) still passes. A read is an answer of the site's API, which the site
 * limits a minute for an account: once a second, by default.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @param {number} [every] - milliseconds between two reads
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout, every = 1000) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a page of the site and wait for it to settle; the answer of the page (its HTTP status) is kept for the steps
 * about a refusal.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  const response = await world.page.goto(siteUrl(world, url), { waitUntil: 'domcontentloaded', timeout: budget(world) * 2 });
  world.kanboard = world.kanboard || {};
  world.kanboard.status = response ? response.status() : 0;
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`): the username the site logs in with
 * (`username`), its password, and the name the site shows (`name`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.KANBOARD_${handle.toUpperCase()}_PASSWORD, name: '${handle}' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.password) {
    throw friendly({ message: `The account "${handle}" has no password in the users registry.`, hint: `Set KANBOARD_${handle.toUpperCase()}_PASSWORD, or the password in worldParameters.users of cucumber.js.` });
  }
  return { username: String(entry.username || handle), password: String(entry.password), name: String(entry.name || entry.username || handle) };
}

// ---------------------------------------------------------------------------
// The session: the site keeps it in its cookies
// ---------------------------------------------------------------------------

/**
 * The account of the browser's session, as the site's dashboard names it ("Dashboard for Member Test"): { name } or
 * null. Asked with the browser's own cookies, apart from its page.
 *
 * @param {object} world
 * @returns {Promise<{name: string}|null>}
 */
async function currentAccount(world) {
  const r = await world.context.request.get(`${siteRoot(world)}/dashboard`, { maxRedirects: 0, failOnStatusCode: false, ignoreHTTPSErrors: true });
  if (r.status() !== 200) return null;
  const title = /<title>\s*Dashboard for ([^<]+?)\s*<\/title>/i.exec(await r.text());
  return title ? { name: title[1].replace(/&#039;/g, "'").replace(/&amp;/g, '&') } : null;
}

/** Whether the session is an account of the registry's, by its name or its username: its handle's user, or null. */
function sessionIs(world, account, user) {
  if (!account) return false;
  const name = account.name.toLowerCase();
  return name === user.name.toLowerCase() || name === user.username.toLowerCase();
}

/** The name of the browser's session, or '' for none. */
async function currentUser(world) {
  const me = await currentAccount(world);
  return me ? me.name : '';
}

/** The browser forgets its session: its cookies. */
async function dropSession(world) {
  await world.context.clearCookies();
}

/**
 * Fill and submit the login form: the username, the password, "Remember Me" left off (a test's login leaves no
 * long-lived token behind), Sign in.
 */
async function submitLogin(world, username, password) {
  await open(world, '/login');
  const page = world.page;
  await page.locator('#form-username').waitFor({ state: 'visible', timeout: budget(world) });
  await page.locator('#form-username').fill(username);
  await page.locator('#form-password').fill(password);
  const remember = page.locator('input[name="remember_me"]');
  if (await remember.count() && await remember.isChecked()) await remember.uncheck();
  await page.locator('form[action$="/login/check"] button[type="submit"]').click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

/** What the login form says, or ''. */
async function loginSays(world) {
  return tidy(await world.page.locator('p.alert-error, .alert-error').first().innerText({ timeout: 1500 }).catch(() => ''));
}

const sessions = new Map();

/**
 * Sign in with an account of the users registry and make sure the session is that account's. An account that is
 * already signed in is kept; an account that signed in earlier in the run gets its session back (its cookies);
 * otherwise the account goes through the login form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const key = siteRoot(world) + '|' + handle;
  if (sessionIs(world, await currentAccount(world), user)) return;
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await world.context.addCookies(saved);
    if (sessionIs(world, await currentAccount(world), user)) return;
    sessions.delete(key);
    await dropSession(world);
  }
  await submitLogin(world, user.username, user.password);
  const result = await waitForValue(() => currentAccount(world), (me) => sessionIs(world, me, user), budget(world));
  if (!result.ok) {
    const said = await loginSays(world);
    throw friendly({
      message: `Logging in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : `; the page is ${world.page.url()}`}.`,
      hint: /captcha|locked/i.test(said)
        ? 'After three wrong passwords in a row the site asks for a captcha, and after six it locks the account for a while: a right login, or the site\'s administrator, starts the count again.'
        : 'Check the username and the password of this account in worldParameters.users of cucumber.js, and that the account exists on the site and is active.',
    });
  }
  sessions.set(key, await world.context.cookies());
}

// ---------------------------------------------------------------------------
// The site's own API (JSON-RPC), as the managing account
// ---------------------------------------------------------------------------

const apiContexts = new Map();

/** The run's own client of the site's API, apart from the browser and its cookies. */
async function apiContext(world) {
  const root = siteRoot(world);
  if (!apiContexts.has(root)) apiContexts.set(root, await playwright.request.newContext({ ignoreHTTPSErrors: true }));
  return apiContexts.get(root);
}

/** The run's API clients, and their end. */
const managerContexts = {
  async dispose() {
    for (const c of apiContexts.values()) await c.dispose().catch(() => {});
    apiContexts.clear();
  },
};

/**
 * One call of the site's JSON-RPC API as the managing account (worldParameters.manager, the manager of the projects
 * used: its username and its password, HTTP Basic): its result, or a friendly error that says what was asked.
 *
 * @param {object} world
 * @param {string} method - "getTask"
 * @param {object} params
 * @param {string} what - what the call does, for the error ("make the task …")
 * @returns {Promise<*>}
 */
async function api(world, method, params, what) {
  const handle = (world.parameters && world.parameters.manager) || 'owner';
  const user = resolveUser(world, handle);
  const request = await apiContext(world);
  const r = await request.post(`${siteRoot(world)}/jsonrpc.php`, {
    headers: { Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ jsonrpc: '2.0', method, id: 1, params: params || {} }),
    failOnStatusCode: false,
  });
  let answer = null;
  try { answer = await r.json(); } catch { answer = null; }
  if (r.status() === 401) {
    throw friendly({ message: `The managing account "${handle}" could not reach the site's API (401).`, hint: 'worldParameters.manager names an account of the users registry: the manager of the projects the features use, with its username and password.' });
  }
  if (r.status() !== 200 || !answer || answer.error) {
    throw friendly({
      message: `Could not ${what}: the site answered ${r.status()}${answer && answer.error ? ` (${answer.error.message || 'an error'})` : ''}.`,
      hint: 'The managing account (worldParameters.manager) must manage the projects the features use.',
    });
  }
  return answer.result;
}

/** A project of the site by its name, as the managing account sees it: { id, name }. */
async function findProject(world, which) {
  const wanted = String(which || (world.parameters && world.parameters.project) || '').trim();
  const list = await api(world, 'getMyProjectsList', {}, 'read the projects');
  const hit = Object.entries(list && typeof list === 'object' ? list : {}).find(([, name]) => exactly(wanted).test(String(name)));
  if (!hit) {
    throw friendly({ message: `No project "${wanted}" the managing account has.`, hint: 'Name the project by its name, as the site lists it ("Webship site").' });
  }
  return { id: Number(hit[0]), name: String(hit[1]) };
}

/** The tasks of a project with this title, open or closed. */
async function findTasks(world, project, title) {
  const open = await api(world, 'getAllTasks', { project_id: project.id, status_id: 1 }, `read the tasks of ${project.name}`);
  const closed = await api(world, 'getAllTasks', { project_id: project.id, status_id: 0 }, `read the tasks of ${project.name}`);
  return [...(open || []), ...(closed || [])].filter((t) => exactly(title).test(String(t.title)));
}

/** A task by its title or its number ("#12"), in a project (the scenario's, else the default one): the API's task. */
async function taskNamed(world, which, projectName) {
  const project = await findProject(world, projectName || (world.kanboard && world.kanboard.project));
  const number = /^#?([1-9][0-9]{0,9})$/.exec(String(which).trim());
  if (number) {
    const t = await api(world, 'getTask', { task_id: Number(number[1]) }, `read the task #${number[1]}`).catch(() => null);
    if (t && Number(t.project_id) === project.id) return { ...t, project };
  }
  const list = await findTasks(world, project, which);
  if (!list.length) throw friendly({ message: `No task "${which}" in ${project.name}.`, hint: 'Name a task by its title or by its number ("#1"); a scenario makes its own with Given there is a task "Webship test …".' });
  return { ...list[0], project };
}

/** A task a scenario made goes after it. */
function remember(world, id) {
  world.kanboard = world.kanboard || {};
  world.kanboard.made = world.kanboard.made || new Set();
  world.kanboard.made.add(String(id));
}

/** Remove a task for good, as the managing account: Kanboard's own removal, with its comments, subtasks and tags. */
async function removeTask(world, id) {
  await api(world, 'removeTask', { task_id: Number(id) }, `remove the task #${id}`);
}

/** Make a task in a project, as the managing account; it goes after the scenario. */
async function makeTask(world, project, title) {
  const id = await api(world, 'createTask', { title, project_id: project.id }, `make the task "${title}" in ${project.name}`);
  if (!(Number(id) > 0)) throw friendly({ message: `The task "${title}" was not made in ${project.name}.`, hint: 'The managing account must manage the project.' });
  remember(world, id);
  return { ...(await api(world, 'getTask', { task_id: Number(id) }, `read the task #${id}`)), project };
}

/** The task the scenario opened, as the site has it now. */
async function taskNow(world) {
  const id = world.kanboard && world.kanboard.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  return api(world, 'getTask', { task_id: Number(id) }, `read the task #${id}`);
}

/** Open a task on its own page and wait for its title. */
async function openTask(world, task) {
  world.kanboard = world.kanboard || {};
  world.kanboard.task = String(task.id);
  world.kanboard.title = String(task.title);
  world.kanboard.project = task.project ? task.project.name : world.kanboard.project;
  await open(world, `/task/${task.id}`);
  await actOrExplain('open the task', `#${task.id}`, async () => {
    await world.page.locator('#task-summary h2').filter({ hasText: exactly(task.title) }).first().waitFor({ state: 'visible', timeout: budget(world) });
  }, 'The task\'s page did not show its title: the account must be one the project has.');
}

/** A link of the open task's sidebar, by where it leads ("edit", "comment/create", "close"). */
function sidebarLink(world, to) {
  return world.page.locator(`.sidebar a[href="/task/${world.kanboard.task}/${to}"]`).first();
}

/**
 * Open a window of the task's sidebar (an action of the task), do what fills it, save it, and wait for it to close.
 *
 * @param {object} world
 * @param {string} to - where the sidebar's link leads: "edit", "comment/create", "position/show", "close"
 * @param {function(import('playwright').Locator): Promise<void>} fill - what to do in the window
 * @param {string} button - the window's button: "Save", "Yes"
 */
async function inWindow(world, to, fill, button = 'Save') {
  await sidebarLink(world, to).click({ timeout: budget(world) });
  const box = world.page.locator('#modal-box');
  await box.waitFor({ state: 'visible', timeout: budget(world) });
  await fill(box);
  await box.locator('button').filter({ hasText: exactly(button) }).first().click({ timeout: budget(world) });
  await box.waitFor({ state: 'detached', timeout: budget(world) });
  await waitForPageLoad(world.page, 1000);
}

/** A line of the task's summary ("Column", "Assignee", "Creator", "Category", "Status"): its value, or ''. */
async function summaryOf(world, label) {
  const line = world.page.locator('#task-summary li').filter({ has: world.page.locator('strong', { hasText: new RegExp(`^\\s*${escapeRegExp(label)}:\\s*$`) }) }).first();
  return tidy(await line.locator('span').first().innerText({ timeout: 2000 }).catch(() => ''));
}

module.exports = {
  budget,
  escapeRegExp,
  exactly,
  words,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  siteRoot,
  siteUrl,
  open,
  resolveUser,
  currentAccount,
  sessionIs,
  currentUser,
  dropSession,
  submitLogin,
  loginSays,
  signInAs,
  apiContext,
  managerContexts,
  api,
  findProject,
  findTasks,
  taskNamed,
  remember,
  removeTask,
  makeTask,
  taskNow,
  openTask,
  sidebarLink,
  inWindow,
  summaryOf,
  friendly,
  smartSettle,
  playwright,
};
