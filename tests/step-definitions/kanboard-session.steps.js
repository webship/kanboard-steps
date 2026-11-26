'use strict';

// Logging in and out, the session's account, and who may open a project.
//
// The site logs in with a username and a password on one form (/login), and keeps the session in its cookies; it logs
// out from its user menu (the person's picture). The session's account is the one its dashboard names, read with the
// browser's own cookies, so a step never guesses it from the page. A project opens on its board; an account the project
// does not have is refused it.

const { Given, When, Then, After, AfterAll } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./kanboard-helpers');

/**
 * Log in as an account of the users registry (cucumber.js, worldParameters.users), or keep its session when it is the
 * browser's already.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "owner" user
 * Example #3: And I am a logged in user with the "member" user
 * Example #4: And we are a logged in user with the "owner" user
 * Example #5: Given we are a logged in user with the "member" user
 */
Given(/^(I am|we are) a logged in user with the "([^"]*)" user$/, async function (_who, handle) {
  await h.signInAs(this, handle);
});

/**
 * Log in through the form as an account of the users registry: a new session, whatever the browser held.
 *
 * Example #1: When I log in with the "member" user
 * Example #2: When log in with the "reader" user
 * Example #3: And I log in with the "member" user
 * Example #4: And log in with the "reader" user
 * Example #5: When we log in with the "member" user
 */
When(/^(I |we )*log in with the "([^"]*)" user$/, async function (_who, handle) {
  const user = h.resolveUser(this, handle);
  await h.dropSession(this);
  await h.submitLogin(this, user.username, user.password);
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => h.sessionIs(this, me, user), h.budget(this));
  if (!result.ok) {
    const said = await h.loginSays(this);
    throw friendly({ message: `Logging in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : ''}.`, hint: 'Check the account\'s username and password in worldParameters.users of cucumber.js.' });
  }
});

/**
 * Log in through the form with a username and a password that need not be right: the step asserts nothing, a refusal
 * is read by the steps after it.
 *
 * Example #1: When I log in as "member" with the password "not-the-right-password"
 * Example #2: When log in as "nobody" with the password "dD.123123ddd"
 * Example #3: And I log in as "member" with the password "not-the-right-password"
 * Example #4: And log in as "nobody" with the password "dD.123123ddd"
 * Example #5: When we log in as "member" with the password "not-the-right-password"
 */
When(/^(I |we )*log in as "([^"]*)" with the password "([^"]*)"$/, async function (_who, username, password) {
  await h.dropSession(this);
  await h.submitLogin(this, username, password);
});

/**
 * Start without a session: the browser holds none of the site's.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: And we are not logged in
 * Example #5: When I am not logged in
 */
Given(/^(I am|we are) not logged in$/, async function (_who) {
  await h.dropSession(this);
});

/**
 * Log out, the way the site does it (its user menu, the person's picture, then Logout), and wait until the session is
 * gone.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: And we log out
 * Example #5: Then I log out
 */
When(/^(I |we )*log out$/, async function (_who) {
  const me = await h.currentAccount(this);
  if (!me) throw friendly({ message: 'There is no session to log out of.', hint: 'Log in first.' });
  const page = this.page;
  if (!page.url().startsWith(h.siteRoot(this)) || /\/login/.test(page.url())) await h.open(this, '/dashboard');
  await page.locator('header a.dropdown-menu-link-icon:has(.avatar)').first().click({ timeout: h.budget(this) });
  await page.locator('#dropdown a[href^="/logout"]').first().click({ timeout: h.budget(this) });
  const gone = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!gone.ok) throw friendly({ message: `Logging out did not end the session of ${gone.value}.`, hint: 'The site logs out from its user menu (the person\'s picture), Logout.' });
});

/**
 * The browser's session is an account's: its name as the site shows it, or its username.
 *
 * Example #1: Then I should be logged in as "Member Test"
 * Example #2: Then I should be logged in as "member"
 * Example #3: And I should be logged in as "Member Test"
 * Example #4: But I should be logged in as "member"
 * Example #5: Then we should be logged in as "Member Test"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (_who, who) {
  const wanted = String(who).trim().toLowerCase();
  const users = Object.values((this.parameters && this.parameters.users) || {});
  // A username of the registry stands for its account's name, as the site shows the name.
  const named = users.find((u) => String(u.username || '').toLowerCase() === wanted);
  const target = named ? String(named.name || '').toLowerCase() : wanted;
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => !!me && me.name.toLowerCase() === target, h.budget(this));
  if (!result.ok) {
    const me = result.value;
    throw friendly({ message: `Expected to be logged in as "${who}", but ${me ? `the session is ${me.name}` : 'there is no session'}.`, hint: 'Name the account by its name, as the site shows it, or by its username.' });
  }
});

/**
 * The browser holds no session of the site's.
 *
 * Example #1: Then I should not be logged in
 * Example #2: Then we should not be logged in
 * Example #3: And I should not be logged in
 * Example #4: But we should not be logged in
 * Example #5: Given I should not be logged in
 */
Then(/^(I |we )*should not be logged in$/, async function (_who) {
  const result = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected no session, but the session is ${result.value}'s.`, hint: 'Log out first, or start with Given I am not logged in.' });
});

/**
 * The login form stayed, with the site's message: the account was refused.
 *
 * Example #1: Then the login should be refused with "Bad username or password"
 * Example #2: Then the login should be refused with "Bad username"
 * Example #3: And the login should be refused with "Bad username or password"
 * Example #4: But the login should be refused with "Bad username"
 * Example #5: Given the login should be refused with "Bad username or password"
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (message) {
  const page = this.page;
  await h.assertPresence(page.locator('#form-password'), null, { label: 'the login form', hint: 'A refused login stays on the form, at /login/check.', timeout: h.budget(this) });
  const said = page.locator('p.alert-error').filter({ hasText: new RegExp(h.escapeRegExp(message), 'i') }).first();
  await h.assertPresence(said, null, { label: `the message "${message}"`, hint: 'The site says "Bad username or password" over the form; after three wrong passwords in a row it asks for a captcha too.', timeout: h.budget(this) });
});

/**
 * Open a project by its name: its board.
 *
 * Example #1: When I open the project "Webship site"
 * Example #2: When we open the project "Webship site"
 * Example #3: And I open the project "Webship site"
 * Example #4: And we open the project "Webship site"
 * Example #5: Then I open the project "Webship site"
 */
When(/^(I |we )*open the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  this.kanboard = this.kanboard || {};
  this.kanboard.project = project.name;
  this.kanboard.board = project.id;
  await h.open(this, `/board/${project.id}`);
  await h.assertPresence(this.page.locator('table#board th.board-column-header').first(), null, { label: 'the board of the project', hint: 'The account must be one the project has; the board shows its columns.', timeout: h.budget(this) });
});

/**
 * The browser's account is refused a project: the site answers its board with "Access Forbidden".
 *
 * Example #1: Then I should be refused the project "Webship site"
 * Example #2: Then we should be refused the project "Webship site"
 * Example #3: And I should be refused the project "Webship site"
 * Example #4: But we should be refused the project "Webship site"
 * Example #5: Given I should be refused the project "Webship site"
 */
Then(/^(I |we )*should be refused the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  await h.open(this, `/board/${project.id}`);
  const cards = await this.page.locator('table#board .task-board').count();
  if (this.kanboard.status !== 403 || cards) {
    throw friendly({ message: `Expected the project "${name}" to be refused, but its board answered ${this.kanboard.status}${cards ? ` with ${cards} task(s)` : ''}.`, hint: 'An account the project has may open it; only one it does not have is refused.' });
  }
  await h.assertPresence(this.page.locator('p.alert-error').filter({ hasText: /Access Forbidden/ }).first(), null, { label: 'the site\'s "Access Forbidden"', hint: 'The site answers a project the account may not open with "Access Forbidden" (403).', timeout: h.budget(this) });
});

// A scenario's tasks go after it, as the managing account, so a run leaves the site as it found it.
After(async function () {
  const made = this.kanboard && this.kanboard.made;
  if (!made || !made.size) return;
  for (const id of made) {
    await h.removeTask(this, id).catch((e) => console.warn(`[kanboard-steps] the task ${id} the scenario made could not be removed: ${h.tidy(e && e.message).slice(0, 300)}`));
  }
  made.clear();
});

// The run's API clients end with it.
AfterAll(async function () {
  await h.managerContexts.dispose();
});
