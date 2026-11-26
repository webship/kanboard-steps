'use strict';

// The tasks of a project: test content made and removed through the site's API, and one task on its own page
// (/task/<number>): its column, open or closed, a comment, a tag, its category, its assignee, a subtask, who made it;
// and what a viewer of the project, or someone it does not have, may not do. The task's actions are in its sidebar,
// each a window over the page. What a step changed is read back from the site's API.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./kanboard-helpers');

/**
 * A task of this title in the project (the default one when none is named), made through the site's API as the
 * managing account when it is not there. It goes after the scenario.
 *
 * Example #1: Given there is a task "Webship test work" in the project "Webship site"
 * Example #2: Given there is a task "Webship test work"
 * Example #3: And there is a task "Webship test work" in the project "Webship site"
 * Example #4: And there is a task "Webship test work"
 * Example #5: When there is a task "Webship test work" in the project "Webship site"
 */
Given(/^there is a task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  const there = await h.findTasks(this, project, title);
  if (there.length) { for (const t of there) h.remember(this, t.id); return; }
  await h.makeTask(this, project, title);
});

/**
 * No task of this title in the project: any there is removed, as the managing account.
 *
 * Example #1: Given there is no task "Webship test new" in the project "Webship site"
 * Example #2: Given there is no task "Webship test new"
 * Example #3: And there is no task "Webship test new" in the project "Webship site"
 * Example #4: And there is no task "Webship test new"
 * Example #5: When there is no task "Webship test new" in the project "Webship site"
 */
Given(/^there is no task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  for (const t of await h.findTasks(this, project, title)) await h.removeTask(this, t.id);
});

/**
 * Open a task of the project by its title (or its number, as "#1"), on its own page.
 *
 * Example #1: When I open the task "The greeting script says Helo instead of Hello"
 * Example #2: When we open the task "#1"
 * Example #3: And I open the task "The greeting script says Helo instead of Hello"
 * Example #4: And we open the task "#1"
 * Example #5: When we open the task "The usage line spells greeting as greting"
 */
When(/^(I |we )*open the task "([^"]*)"$/, async function (_who, which) {
  await h.openTask(this, await h.taskNamed(this, which));
});

/**
 * Move the open task to another column of the board, through its sidebar's "Move position": the column, then Save.
 *
 * Example #1: When I move the task to the column "Ready"
 * Example #2: When we move the task to the column "Work in progress"
 * Example #3: And I move the task to the column "Ready"
 * Example #4: And we move the task to the column "Work in progress"
 * Example #5: Then I move the task to the column "Done"
 */
When(/^(I |we )*move the task to the column "([^"]*)"$/, async function (_who, column) {
  const t = await h.taskNow(this);
  const columns = await h.api(this, 'getColumns', { project_id: Number(t.project_id) }, 'read the columns');
  const target = (columns || []).find((c) => h.exactly(column).test(String(c.title)));
  if (!target) throw friendly({ message: `The board has no column "${column}"; its columns are ${(columns || []).map((c) => `"${c.title}"`).join(', ')}.`, hint: 'Name a column as the board shows it.' });
  await h.actOrExplain('move the task to the column', column, async () => {
    await h.inWindow(this, 'position/show', async (box) => {
      await box.getByLabel('Column', { exact: true }).selectOption({ label: String(target.title) });
    });
  }, 'The task\'s sidebar offers "Move position" to an account that may change it; an open task moves, a closed one does not.');
  const moved = await h.waitForValue(() => h.taskNow(this), (now) => Number(now.column_id) === Number(target.id), h.budget(this));
  if (!moved.ok) throw friendly({ message: `The task was not moved to the column "${column}".`, hint: 'The site moves a task once its column is saved in "Move position".' });
});

/**
 * The open task is in this column of the board, as the site has it, and its summary says so.
 *
 * Example #1: Then the task should be in the column "Ready"
 * Example #2: Then the task should be in the column "Work in progress"
 * Example #3: And the task should be in the column "Ready"
 * Example #4: But the task should be in the column "Backlog"
 * Example #5: Given the task should be in the column "Work in progress"
 */
Then(/^the task should be in the column "([^"]*)"$/, async function (column) {
  const t = await h.taskNow(this);
  const columns = await h.api(this, 'getColumns', { project_id: Number(t.project_id) }, 'read the columns');
  const now = (columns || []).find((c) => Number(c.id) === Number(t.column_id));
  if (!now || !h.exactly(column).test(String(now.title))) throw friendly({ message: `Expected the task to be in the column "${column}", but it is in "${now ? now.title : t.column_id}".`, hint: 'A task moves with "Move position", or on the board.' });
  await h.open(this, `/task/${t.id}`);
  const shown = await h.summaryOf(this, 'Column');
  if (!h.exactly(column).test(shown)) throw friendly({ message: `Expected the task's summary to say the column "${column}", but it says "${shown}".`, hint: 'The summary of a task names its column.' });
});

/**
 * Close the open task, through its sidebar's "Close this task" and Yes; or open it again, through "Open this task".
 *
 * Example #1: When I close the task
 * Example #2: When we open the task again
 * Example #3: And I close the task
 * Example #4: And we open the task again
 * Example #5: Then I close the task
 */
When(/^(I |we )*(close the task|open the task again)$/, async function (_who, what) {
  const closing = what === 'close the task';
  await h.actOrExplain(closing ? 'close the task' : 'open the task again', this.kanboard && this.kanboard.title, async () => {
    await h.inWindow(this, closing ? 'close' : 'open', async () => {}, 'Yes');
  }, closing ? 'The task\'s sidebar offers "Close this task" to an account that may change an open task.' : 'The task\'s sidebar offers "Open this task" to an account that may change a closed task.');
  const result = await h.waitForValue(() => h.taskNow(this), (t) => Number(t.is_active) === (closing ? 0 : 1), h.budget(this));
  if (!result.ok) throw friendly({ message: `The task was not ${closing ? 'closed' : 'opened again'}.`, hint: 'The site closes or opens a task once its window is answered Yes.' });
});

/**
 * The open task is closed (or open), as the site has it, and its summary says so.
 *
 * Example #1: Then the task should be closed
 * Example #2: Then the task should be open
 * Example #3: And the task should be closed
 * Example #4: But the task should be open
 * Example #5: Given the task should be closed
 */
Then(/^the task should be (closed|open)$/, async function (state) {
  const want = state === 'closed' ? 0 : 1;
  const result = await h.waitForValue(() => h.taskNow(this), (t) => Number(t.is_active) === want, h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task to be ${state}, but it is ${Number(result.value && result.value.is_active) === 0 ? 'closed' : 'open'}.`, hint: 'A task closes with "Close this task" and opens again with "Open this task".' });
  await h.open(this, `/task/${this.kanboard.task}`);
  const shown = await h.summaryOf(this, 'Status');
  if (shown.toLowerCase() !== state) throw friendly({ message: `Expected the task's summary to say "${state}", but it says "${shown}".`, hint: 'The summary of a task says whether it is open or closed.' });
});

/**
 * Comment on the open task through its sidebar's "Add a comment": the text, then Save.
 *
 * Example #1: When I add the comment "Checked on the test site" to the task
 * Example #2: When we add the comment "Looked into it" to the task
 * Example #3: And I add the comment "Checked on the test site" to the task
 * Example #4: And we add the comment "Looked into it" to the task
 * Example #5: When we add the comment "Checked on the test site" to the task
 */
When(/^(I |we )*add the comment "([^"]*)" to the task$/, async function (_who, text) {
  await h.actOrExplain('comment on the task with', text, async () => {
    await h.inWindow(this, 'comment/create', async (box) => {
      await box.locator('textarea[name="comment"]').fill(text);
    });
  }, 'The task\'s sidebar offers "Add a comment" to an account that may change the task.');
  const id = this.kanboard.task;
  const said = await h.waitForValue(() => h.api(this, 'getAllComments', { task_id: Number(id) }, 'read the comments'), (list) => (list || []).some((c) => String(c.comment || '').includes(text)), h.budget(this));
  if (!said.ok) throw friendly({ message: `The comment "${text}" was not added to the task.`, hint: 'The site adds a comment once its window is saved.' });
});

/**
 * The open task holds a comment with this text, written by that person when one is named, and its page shows it.
 *
 * Example #1: Then the task should show the comment "Checked on the test site"
 * Example #2: Then the task should show the comment "Checked on the test site" by "Member Test"
 * Example #3: And the task should show the comment "Seen on the test site"
 * Example #4: But the task should show the comment "Seen on the test site" by "Owner Test"
 * Example #5: Given the task should show the comment "Checked on the test site"
 */
Then(/^the task should show the comment "([^"]*)"(?: by "([^"]*)")?$/, async function (text, by) {
  const id = this.kanboard && this.kanboard.task;
  const list = await h.api(this, 'getAllComments', { task_id: Number(id) }, 'read the comments');
  const named = (c) => [c.name, c.username].filter(Boolean).map(String);
  const found = (list || []).find((c) => String(c.comment || '').includes(text) && (!by || named(c).some((n) => h.exactly(by).test(n))));
  if (!found) {
    const all = (list || []).map((c) => `"${h.tidy(c.comment)}" by ${named(c)[0] || 'someone'}`).join('; ') || 'none';
    throw friendly({ message: `Expected the task to show the comment "${text}"${by ? ` by ${by}` : ''}. Its comments: ${all}.`, hint: 'A comment is read with its author\'s name or username.' });
  }
  await h.open(this, `/task/${id}`);
  await h.assertPresence(this.page.locator('.comment .comment-content').filter({ hasText: text }).first(), null, { label: `the comment "${text}" on the task's page`, hint: 'The task\'s page lists its comments under Comments.', timeout: h.budget(this) });
});

/**
 * Tag the open task through its sidebar's "Edit the task": the tag chosen in its Tags (one of the project's, or a new
 * one, which the site makes), then Save.
 *
 * Example #1: When I add the tag "greeting" to the task
 * Example #2: When we add the tag "greeting" to the task
 * Example #3: And I add the tag "greeting" to the task
 * Example #4: And we add the tag "greeting" to the task
 * Example #5: When we add the tag "greeting" to the task
 */
When(/^(I |we )*add the tag "([^"]*)" to the task$/, async function (_who, tag) {
  const page = this.page;
  await h.actOrExplain('tag the task', tag, async () => {
    await h.inWindow(this, 'edit', async (box) => {
      const search = box.locator('.select2-search__field').first();
      await search.click();
      await search.pressSequentially(tag);
      // The field offers the tag as typed and the project's tags that start alike: the one of this name exactly.
      await page.locator('.select2-results__option').filter({ hasText: h.exactly(tag) }).first().click({ timeout: h.budget(this) });
    });
  }, 'The task\'s sidebar offers "Edit the task" to an account that may change the task.');
  const result = await h.waitForValue(() => h.api(this, 'getTaskTags', { task_id: Number(this.kanboard.task) }, 'read the tags'), (tags) => Object.values(tags || {}).some((t) => h.exactly(tag).test(String(t))), h.budget(this));
  if (!result.ok) throw friendly({ message: `The tag "${tag}" was not added to the task.`, hint: 'The site tags a task once "Edit the task" is saved.' });
});

/**
 * The open task has this tag, as the site has it, and its summary shows it.
 *
 * Example #1: Then the task should have the tag "greeting"
 * Example #2: Then the task should have the tag "greeting"
 * Example #3: And the task should have the tag "greeting"
 * Example #4: But the task should have the tag "greeting"
 * Example #5: Given the task should have the tag "greeting"
 */
Then(/^the task should have the tag "([^"]*)"$/, async function (tag) {
  const tags = Object.values(await h.api(this, 'getTaskTags', { task_id: Number(this.kanboard.task) }, 'read the tags') || {}).map(String);
  if (!tags.some((t) => h.exactly(tag).test(t))) throw friendly({ message: `Expected the task to have the tag "${tag}", but it has ${tags.length ? tags.map((t) => `"${t}"`).join(', ') : 'none'}.`, hint: 'A tag is added in "Edit the task".' });
  await h.open(this, `/task/${this.kanboard.task}`);
  await h.assertPresence(this.page.locator('#task-summary .task-tag').filter({ hasText: h.exactly(tag) }).first(), null, { label: `the tag "${tag}" in the task's summary`, hint: 'The summary of a task shows its tags.', timeout: h.budget(this) });
});

/**
 * Set the open task's category through its sidebar's "Edit the task": the category, then Save.
 *
 * Example #1: When I set the category of the task to "Bug"
 * Example #2: When we set the category of the task to "Bug"
 * Example #3: And I set the category of the task to "Bug"
 * Example #4: And we set the category of the task to "Bug"
 * Example #5: Then I set the category of the task to "Bug"
 */
When(/^(I |we )*set the category of the task to "([^"]*)"$/, async function (_who, category) {
  await h.actOrExplain('set the category of the task to', category, async () => {
    await h.inWindow(this, 'edit', async (box) => {
      await box.getByLabel('Category', { exact: true }).selectOption({ label: category });
    });
  }, 'The task\'s sidebar offers "Edit the task" to an account that may change the task; the category must be one of the project\'s.');
  const result = await h.waitForValue(() => h.taskNow(this), (t) => Number(t.category_id) > 0, h.budget(this));
  if (!result.ok) throw friendly({ message: `The category of the task was not set to "${category}".`, hint: 'The site sets a category once "Edit the task" is saved.' });
});

/**
 * The open task is in this category, as its summary says.
 *
 * Example #1: Then the task should be in the category "Bug"
 * Example #2: Then the task should be in the category "Bug"
 * Example #3: And the task should be in the category "Bug"
 * Example #4: But the task should be in the category "Bug"
 * Example #5: Given the task should be in the category "Bug"
 */
Then(/^the task should be in the category "([^"]*)"$/, async function (category) {
  await h.open(this, `/task/${this.kanboard.task}`);
  const shown = await h.summaryOf(this, 'Category');
  if (!h.exactly(category).test(shown)) throw friendly({ message: `Expected the task to be in the category "${category}", but ${shown ? `it is in "${shown}"` : 'it has none'}.`, hint: 'A category is set in "Edit the task".' });
});

/**
 * Assign the open task to one of the project's managers or members, through its sidebar's "Edit the task": the
 * Assignee, by their name, then Save.
 *
 * Example #1: When I assign the task to "Owner Test"
 * Example #2: When we assign the task to "Member Test"
 * Example #3: And I assign the task to "Owner Test"
 * Example #4: And we assign the task to "Member Test"
 * Example #5: When we assign the task to "Owner Test"
 */
When(/^(I |we )*assign the task to "([^"]*)"$/, async function (_who, name) {
  await h.actOrExplain('assign the task to', name, async () => {
    await h.inWindow(this, 'edit', async (box) => {
      await box.getByLabel('Assignee', { exact: true }).selectOption({ label: name });
    });
  }, 'The task\'s sidebar offers "Edit the task" to an account that may change it; an assignee is one of the project\'s managers or members, by their name.');
  const result = await h.waitForValue(() => h.taskNow(this), (t) => Number(t.owner_id) > 0, h.budget(this));
  if (!result.ok) throw friendly({ message: `The task was not assigned to "${name}".`, hint: 'The site assigns a task once "Edit the task" is saved.' });
});

/**
 * The open task is assigned to this person (their name or username), as its summary says.
 *
 * Example #1: Then the task should be assigned to "Owner Test"
 * Example #2: Then the task should be assigned to "member"
 * Example #3: And the task should be assigned to "Owner Test"
 * Example #4: But the task should be assigned to "member"
 * Example #5: Given the task should be assigned to "Member Test"
 */
Then(/^the task should be assigned to "([^"]*)"$/, async function (who) {
  await h.open(this, `/task/${this.kanboard.task}`);
  const shown = (await h.summaryOf(this, 'Assignee')).replace(/\s*-\s*Assign to me\s*$/, '');
  const users = Object.values((this.parameters && this.parameters.users) || {});
  const named = users.find((u) => String(u.username || '').toLowerCase() === who.trim().toLowerCase());
  const wanted = named ? String(named.name) : who;
  if (!h.exactly(wanted).test(shown)) throw friendly({ message: `Expected the task to be assigned to "${who}", but ${shown ? `it is assigned to ${shown}` : 'it is assigned to nobody'}.`, hint: 'Name the person by their name or their username.' });
});

/**
 * Add a subtask to the open task, through its sidebar's "Add a sub-task": its title, then Save.
 *
 * Example #1: When I add the subtask "Check the output" to the task
 * Example #2: When we add the subtask "Check the output" to the task
 * Example #3: And I add the subtask "Check the output" to the task
 * Example #4: And we add the subtask "Check the output" to the task
 * Example #5: Then I add the subtask "Check the output" to the task
 */
When(/^(I |we )*add the subtask "([^"]*)" to the task$/, async function (_who, title) {
  await h.actOrExplain('add to the task the subtask', title, async () => {
    await h.inWindow(this, 'subtask/create', async (box) => {
      await box.locator('#form-title').fill(title);
    });
  }, 'The task\'s sidebar offers "Add a sub-task" to an account that may change the task.');
  const result = await h.waitForValue(() => h.api(this, 'getAllSubtasks', { task_id: Number(this.kanboard.task) }, 'read the subtasks'), (list) => (list || []).some((s) => h.exactly(title).test(String(s.title))), h.budget(this));
  if (!result.ok) throw friendly({ message: `The subtask "${title}" was not added to the task.`, hint: 'The site adds a subtask once its window is saved.' });
});

/**
 * The open task has a subtask of this title, as the site has it, and its page lists it.
 *
 * Example #1: Then the task should have the subtask "Check the output"
 * Example #2: Then the task should have the subtask "Fix the spelling in greeting.sh"
 * Example #3: And the task should have the subtask "Check the output"
 * Example #4: But the task should have the subtask "Fix the spelling in greeting.sh"
 * Example #5: Given the task should have the subtask "Check the output"
 */
Then(/^the task should have the subtask "([^"]*)"$/, async function (title) {
  const list = await h.api(this, 'getAllSubtasks', { task_id: Number(this.kanboard.task) }, 'read the subtasks') || [];
  if (!list.some((s) => h.exactly(title).test(String(s.title)))) throw friendly({ message: `Expected the task to have the subtask "${title}", but it has ${list.length ? list.map((s) => `"${s.title}"`).join(', ') : 'none'}.`, hint: 'A subtask is added with "Add a sub-task".' });
  await h.open(this, `/task/${this.kanboard.task}`);
  await h.assertPresence(this.page.locator('.subtasks-table').getByText(title, { exact: true }).first(), null, { label: `the subtask "${title}" on the task's page`, hint: 'The task\'s page lists its subtasks under Sub-Tasks.', timeout: h.budget(this) });
});

/**
 * The open task was made by this person, as its summary says ("Creator").
 *
 * Example #1: Then the task should be created by "Owner Test"
 * Example #2: Then the task should be created by "owner"
 * Example #3: And the task should be created by "Owner Test"
 * Example #4: But the task should be created by "owner"
 * Example #5: Given the task should be created by "Member Test"
 */
Then(/^the task should be created by "([^"]*)"$/, async function (who) {
  await h.open(this, `/task/${this.kanboard.task}`);
  const shown = await h.summaryOf(this, 'Creator');
  const users = Object.values((this.parameters && this.parameters.users) || {});
  const named = users.find((u) => String(u.username || '').toLowerCase() === who.trim().toLowerCase());
  const wanted = named ? String(named.name) : who;
  if (!h.exactly(wanted).test(shown)) throw friendly({ message: `Expected the task to be created by "${who}", but it was created by ${shown || 'nobody'}.`, hint: 'Name the person by their name or their username.' });
});

/**
 * The browser's account may not change the open task: its sidebar offers no "Edit the task".
 *
 * Example #1: Then I should not be able to change the task
 * Example #2: Then we should not be able to change the task
 * Example #3: And I should not be able to change the task
 * Example #4: But we should not be able to change the task
 * Example #5: Given I should not be able to change the task
 */
Then(/^(I |we )*should not be able to change the task$/, async function (_who) {
  await this.page.locator('#task-summary h2').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const offered = await h.sidebarLink(this, 'edit').count();
  if (offered) throw friendly({ message: 'Expected the task to be closed to this account, but its sidebar offers "Edit the task".', hint: 'A viewer of the project gets the task without the actions of its sidebar.' });
});

/**
 * The browser's account may not comment on the open task: its sidebar offers no "Add a comment", and its page no
 * comment form.
 *
 * Example #1: Then I should not be able to comment on the task
 * Example #2: Then we should not be able to comment on the task
 * Example #3: And I should not be able to comment on the task
 * Example #4: But we should not be able to comment on the task
 * Example #5: Given I should not be able to comment on the task
 */
Then(/^(I |we )*should not be able to comment on the task$/, async function (_who) {
  await this.page.locator('#task-summary h2').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const offered = await h.sidebarLink(this, 'comment/create').count() + await this.page.locator('form[action$="/comment/save"]').count();
  if (offered) throw friendly({ message: 'Expected no way to comment on the task, but its page offers "Add a comment".', hint: 'A viewer of the project reads a task\'s comments and adds none.' });
});

/**
 * The browser's account is refused a task: the site answers its page with "Access Forbidden".
 *
 * Example #1: Then I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #2: Then we should be refused the task "#1"
 * Example #3: And I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #4: But we should be refused the task "#1"
 * Example #5: Then we should be refused the task "The greeting script says Helo instead of Hello"
 */
Then(/^(I |we )*should be refused the task "([^"]*)"$/, async function (_who, which) {
  const task = await h.taskNamed(this, which);
  await h.open(this, `/task/${task.id}`);
  const title = await this.page.locator('#task-summary h2').count();
  if (this.kanboard.status !== 403 || title) {
    throw friendly({ message: `Expected the task #${task.id} to be refused, but its page answered ${this.kanboard.status}${title ? ` with "${task.title}"` : ''}.`, hint: 'An account the project has reads its tasks; only one it does not have is refused.' });
  }
  await h.assertPresence(this.page.locator('p.alert-error').filter({ hasText: /Access Forbidden/ }).first(), null, { label: 'the site\'s "Access Forbidden"', hint: 'The site answers a task the account may not open with "Access Forbidden" (403).', timeout: h.budget(this) });
});
