'use strict';

// The views of a project: its board (columns, Backlog, Ready, Work in progress and Done by default, and the open tasks
// each holds) and its list (a row an open task); a new task made on the board; and an account that may not make one.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./kanboard-helpers');

/** The board of the scenario's project, open: its project, or a friendly error. */
function boardOpen(world) {
  if (!world.kanboard || !world.kanboard.board || !/\/board\/\d+/.test(world.page.url())) {
    throw friendly({ message: 'No board is open.', hint: 'Open one first: When I open the project "…".' });
  }
  return world.kanboard.board;
}

/**
 * A column of the open board lists (or does not list) a task of this title.
 *
 * Example #1: Then the column "Work in progress" should list the task "The greeting script says Helo instead of Hello"
 * Example #2: Then the column "Ready" should not list the task "The usage line spells greeting as greting"
 * Example #3: And the column "Backlog" should list the task "The usage line spells greeting as greting"
 * Example #4: But the column "Done" should not list the task "The greeting script says Helo instead of Hello"
 * Example #5: Given the column "Work in progress" should list the task "The greeting script says Helo instead of Hello"
 */
Then(/^the column "([^"]*)" should (not )?list the task "([^"]*)"$/, async function (column, notCase, title) {
  boardOpen(this);
  const page = this.page;
  // A column's header: its title is the link of its menu ("Backlog"), its number its data-column-id.
  const header = page.locator('th.board-column-header').filter({ has: page.locator('.board-column-title > .dropdown > a.dropdown-menu', { hasText: h.exactly(column) }) }).first();
  const id = await header.getAttribute('data-column-id', { timeout: h.budget(this) }).catch(() => null);
  if (!id) throw friendly({ message: `The board has no column "${column}".`, hint: 'Name a column as the board shows it (Backlog, Ready, Work in progress, Done).' });
  const card = page.locator(`.task-board[data-column-id="${id}"]`).filter({ has: page.locator('.task-board-title').filter({ hasText: h.exactly(title) }) }).first();
  await h.assertPresence(card, notCase, { label: `the task "${title}" in the column "${column}"`, hint: 'The board shows the open tasks, each in its column; a closed task is not on it.', timeout: h.budget(this) });
});

/**
 * Open the list of a project: a row an open task.
 *
 * Example #1: When I open the list of the project "Webship site"
 * Example #2: When we open the list of the project "Webship site"
 * Example #3: And I open the list of the project "Webship site"
 * Example #4: And we open the list of the project "Webship site"
 * Example #5: Then I open the list of the project "Webship site"
 */
When(/^(I |we )*open the list of the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  this.kanboard = this.kanboard || {};
  this.kanboard.project = project.name;
  await h.open(this, `/list/${project.id}`);
  await h.assertPresence(this.page.locator('input[name="search"]').first(), null, { label: 'the list of the project', hint: 'The account must be one the project has.', timeout: h.budget(this) });
});

/**
 * The open list shows (or does not show) a task of this title.
 *
 * Example #1: Then the task list should show "The greeting script says Helo instead of Hello"
 * Example #2: Then the task list should not show "The greeting script ends without a newline"
 * Example #3: And the task list should show "The usage line spells greeting as greting"
 * Example #4: But the task list should not show "Webship test nothing"
 * Example #5: Given the task list should show "The greeting script says Helo instead of Hello"
 */
Then(/^the task list should (not )?show "([^"]*)"$/, async function (notCase, title) {
  const row = this.page.locator('.table-list-row .table-list-title a').filter({ hasText: h.exactly(title) }).first();
  await h.assertPresence(row, notCase, { label: `the task "${title}" in the list`, hint: 'The list shows the open tasks of the project; open it first.', timeout: h.budget(this) });
});

/**
 * Make a task on the project's board, through "Add a new task" of its first column: its title, then Save. It goes after
 * the scenario.
 *
 * Example #1: When I create a task "Webship test new" in the project "Webship site"
 * Example #2: When we create a task "Webship test new" in the project "Webship site"
 * Example #3: And I create a task "Webship test new" in the project "Webship site"
 * Example #4: And we create a task "Webship test new" in the project "Webship site"
 * Example #5: When we create a task "Webship test new" in the project "Webship site"
 */
When(/^(I |we )*create a task "([^"]*)" in the project "([^"]*)"$/, async function (_who, title, name) {
  const project = await h.findProject(this, name);
  this.kanboard = this.kanboard || {};
  this.kanboard.board = project.id;
  await h.open(this, `/board/${project.id}`);
  const page = this.page;
  await h.actOrExplain('make a task', title, async () => {
    await page.locator('th.board-column-header a[href*="/task/create"]').first().click({ timeout: h.budget(this) });
    const box = page.locator('#modal-box');
    await box.locator('#form-title').fill(title);
    await box.locator('button').filter({ hasText: h.exactly('Save') }).first().click({ timeout: h.budget(this) });
    await box.waitFor({ state: 'detached', timeout: h.budget(this) });
  }, 'The board offers "Add a new task" in each column to an account that may change the project.');
  const made = await h.waitForValue(() => h.findTasks(this, project, title), (l) => l.length > 0, h.budget(this));
  if (!made.ok) throw friendly({ message: `The task "${title}" was not made in ${project.name}.`, hint: 'The board makes a task once its window is saved.' });
  for (const t of made.value) h.remember(this, t.id);
});

/**
 * The browser's account may not make a task in the project: its board offers no "Add a new task".
 *
 * Example #1: Then I should not be able to create a task in the project "Webship site"
 * Example #2: Then we should not be able to create a task in the project "Webship site"
 * Example #3: And I should not be able to create a task in the project "Webship site"
 * Example #4: But we should not be able to create a task in the project "Webship site"
 * Example #5: Given I should not be able to create a task in the project "Webship site"
 */
Then(/^(I |we )*should not be able to create a task in the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  await h.open(this, `/board/${project.id}`);
  await this.page.locator('table#board th.board-column-header').first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  const offered = await this.page.locator('a[href*="/task/create"]').count();
  if (offered) throw friendly({ message: `Expected no way to make a task in ${project.name}, but its board offers "Add a new task".`, hint: 'A member of the project makes tasks; a viewer does not.' });
});
