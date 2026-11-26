<p align="center"><img src="https://raw.githubusercontent.com/webship/kanboard-steps/2.0.x/assets/logo.svg" alt="Kanboard logo" width="160"></p>

# kanboard-steps

[![Test](https://github.com/webship/kanboard-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/kanboard-steps/actions/workflows/test.yml)

Cucumber step definitions for testing Kanboard, the open-source Kanban project management software, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js. The pack covers what a project's work goes through:

- **logging in and out**: an account of the users registry by its handle, the login form, a refused login, who the
  session is, logging out;
- **a project**: its board, opened by its name, and refused to an account the project does not have;
- **the board and the list**: the open tasks in their columns, and a row each in the list;
- **one task** on its own page: its column, open or closed, a comment, a tag, its category, its assignee, a subtask
  and who made it, each through its own control, and a move to another column;
- **a new task** made on the board;
- **what an account may not do**: a viewer of the project neither changes a task, nor comments on it, nor makes one,
  and an account the project does not have is refused its tasks.

The steps make and remove their test content through the site's own JSON-RPC API, as a managing account (the
project's manager) with its username and password, apart from the browser: a task a scenario makes goes after it, so a
run leaves the site as it found it.

No step phrase names the platform: a scenario reads `When I move the task to the column "Ready"` and
`Then the task should be closed`.

CI builds a real Kanboard site with [DDEV](https://ddev.com) on the runner (Kanboard's own image on the project's own
MariaDB, its core only, the accounts of the suite in their roles of the sample project, the sample content), runs the
whole suite against it twice on every push and pull request, checks after each run that the site holds what it held
before, then runs the assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## Logging in first

Every feature starts by logging in: an account of the users registry, by its handle.

| Step | What it does |
| --- | --- |
| `Given I am a logged in user with the "member" user` | Logs in as an account of the users registry, by its handle. The first time in a run through the login form, then its session is put back |
| `When I log in with the "member" user` | Fills and submits the login form with the account's username and password, and waits until the session is the account's |
| `When I log in as "member" with the password "wrong"` | Fills and submits the login form with a username and a password as typed, and asserts nothing: for scenarios about the login itself |
| `Given I am not logged in` | The browser forgets its session |
| `When I log out` | Logs out from the user menu (the person's picture), Logout, and waits until the session is gone |
| `Then I should be logged in as "Member Test"` | The session is the account's: its name as the site shows it, or its username |
| `Then I should not be logged in` | The browser holds no session |
| `Then the login should be refused with "Bad username or password"` | The login form stayed, with that message |

```gherkin
Scenario: An account logs in through the form and out again
  Given I am not logged in
  When I log in with the "member" user
  Then I should be logged in as "Member Test"
  When I log out
  Then I should not be logged in
```

The site keeps a session in its cookies: the steps read who the session is from its dashboard, with the browser's own
cookies, and put an account's session back (its cookies) after its first login. A login leaves "Remember Me" off, so a
run leaves no long-lived token behind.

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, Node.js 24 or later with npm, and about 1 GB
of free memory for Kanboard and MariaDB. Kanboard runs in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project: Kanboard's own image
(`kanboard/kanboard:v1.2.58`, `RELEASE` for another release) on MariaDB 11.4, an administrator of this site in the
place of the one Kanboard starts with, the four accounts of [Test users](#test-users), and the sample content (see
[The test site](#the-test-site)). It takes a minute once the images are pulled (Kanboard's is a download of about
35 MB). Kanboard supports SQLite, MySQL, MariaDB and PostgreSQL; the test site runs MariaDB, as the Webship Workspace
builds Kanboard.

```bash
git clone https://github.com/webship/kanboard-steps.git
SITE_DIR="$PWD/kanboard-site" kanboard-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://kanboardsteps.ddev.site`. In the [Webship Workspace](https://github.com/webship/workspace),
its Kanboard plugin builds the same site in a sites folder, on DDEV, and wires this pack into the testing setup of the
site:

```bash
bash core/scripts/plugins.sh --require @webship.co/workspace-kanboard
bash core/scripts/plugins.sh --activate kanboard --with-needs
bash core/scripts/plugins.sh --install kanboard --with-needs
bash dev/cmd-kanboard-project.sh kbsite --install --add-users --sample-content
bash dev/cmd-tools-testing.sh kbsite --run
```

**2. A test project.**

```bash
mkdir kanboard-tests && cd kanboard-tests
npm init -y
npm install --save-dev webship-js @webship-js/kanboard-steps
npx init-webship-js
```

**3. `cucumber.js`.** Add the pack's step definitions after webship-js's own, and give the world its parameters:

```javascript
require: [
  'node_modules/webship-js/tests/step-definitions/**/*.js',
  'node_modules/@webship-js/kanboard-steps/tests/step-definitions/**/*.js',
],
tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || 'https://kanboardsteps.ddev.site',
  // The account that makes and removes test content through the site's API: the manager of the projects used.
  manager: process.env.MANAGER || 'owner',
  // The project a step works in when it names none (its name).
  project: process.env.PROJECT || 'Webship site',
  // The site logs in with the username, and shows the name.
  users: {
    owner: { username: process.env.KANBOARD_OWNER_USER || 'owner', password: process.env.KANBOARD_OWNER_PASSWORD, name: 'Owner Test' },
    member: { username: process.env.KANBOARD_MEMBER_USER || 'member', password: process.env.KANBOARD_MEMBER_PASSWORD, name: 'Member Test' },
    reader: { username: process.env.KANBOARD_READER_USER || 'reader', password: process.env.KANBOARD_READER_PASSWORD, name: 'Reader Test' },
    stranger: { username: process.env.KANBOARD_STRANGER_USER || 'stranger', password: process.env.KANBOARD_STRANGER_PASSWORD, name: 'Stranger Test' },
  },
  // … webship-js's own parameters (minWaitTime, screenshot, javascript …)
},
```

This repository's own [`cucumber.js`](cucumber.js) is a whole example.

**4. Run.**

```bash
npx cucumber-js                                  # every feature
npx cucumber-js tests/features/tasks.feature     # one feature
CUCUMBER_TAGS=@board npx cucumber-js             # one tag
```

## Steps

### Projects

| Step | What it does |
| --- | --- |
| `When I open the project "Webship site"` | Opens the project, by its name: its board |
| `Then I should be refused the project "Webship site"` | Its board answers "Access Forbidden" (403), with none of its tasks (`@js-off`) |

### Test content

| Step | What it does |
| --- | --- |
| `Given there is a task "Webship test …" in the project "Webship site"` | Makes it through the site's API as the managing account, when it is not there. It goes after the scenario |
| `Given there is no task "Webship test …" in the project "Webship site"` | Removes any of the title, for good |

### The board and the list

| Step | What it does |
| --- | --- |
| `Then the column "Work in progress" should list the task "…"` / `should not list` | What a column of the open board holds: the open tasks |
| `When I open the list of the project "Webship site"` | The project's list: a row an open task |
| `Then the task list should show "…"` / `should not show "…"` | A task of the title is (not) in the open list |
| `When I create a task "Webship test …" in the project "Webship site"` | Through the board's "Add a new task": its title, then Save. It goes after the scenario |

### One task

A task opens on its own page (`/task/<number>`); its actions are in its sidebar, each a window over the page. The
steps read what they changed back from the site's API.

| Step | What it does |
| --- | --- |
| `When I open the task "…"` | Opens it by its title, or by its number ("#1") |
| `When I move the task to the column "Ready"` | Through "Move position": the column, then Save |
| `Then the task should be in the column "Ready"` | As the site has it, and as its summary says |
| `When I close the task` / `When I open the task again` | Through "Close this task" / "Open this task", then Yes |
| `Then the task should be closed` / `should be open` | As the site has it, and as its summary says |
| `When I add the comment "…" to the task` | Through "Add a comment": the text, then Save |
| `Then the task should show the comment "…"` (`… by "Member Test"`) | It holds the comment, written by that person when one is named, and its page shows it |
| `When I add the tag "greeting" to the task` | Through "Edit the task": the tag, one of the project's or a new one, then Save |
| `Then the task should have the tag "greeting"` | Its tags now, and its summary shows it |
| `When I set the category of the task to "Bug"` | Through "Edit the task": the category, then Save |
| `Then the task should be in the category "Bug"` | As its summary says |
| `When I assign the task to "Owner Test"` | Through "Edit the task": one of the project's managers or members, by their name, then Save |
| `Then the task should be assigned to "Owner Test"` | Its assignee, by their name or username, as its summary says |
| `When I add the subtask "…" to the task` | Through "Add a sub-task": its title, then Save |
| `Then the task should have the subtask "…"` | Its subtasks now, and its page lists it |
| `Then the task should be created by "Owner Test"` | Who made it, by their name or username, as its summary says ("Creator") |

### What an account may not do

| Step | What it does |
| --- | --- |
| `Then I should not be able to change the task` | Its sidebar offers no "Edit the task" (a viewer's) |
| `Then I should not be able to comment on the task` | Its page offers no "Add a comment" (a viewer's) |
| `Then I should not be able to create a task in the project "Webship site"` | The board offers no "Add a new task" (a viewer's) |
| `Then I should be refused the task "…"` | Its page answers "Access Forbidden" (403) (an account the project does not have) (`@js-off`) |

Every step carries five example phrasings in its JSDoc, and `npm run test:examples` checks that each one matches its
own step only.

## Rules of a suite

- Log in by a handle of the users registry; never write a password into a feature.
- Never create or delete an account in a suite: accounts are configuration, made by the build of the site.
- Change only what the scenario made: a move, closing, a comment, a tag, a category, an assignee and a subtask go on a
  task of `Given there is a task "…"`, which goes after the scenario.
- Name test content "Webship test …". A run that was stopped half way leaves its tasks; the Workspace's
  `cmd-tools-kanboard-cli.sh <site> --tidy` deletes them for good (only tasks of that title made by the test accounts
  in the sample project), or delete them as the managing account.
- A refusal (a project or a task an account may not open) makes the browser log the refused page: give those
  scenarios `@js-off`.
- After three wrong passwords in a row for an account, Kanboard asks for a captcha too, and after six it locks the
  account for 15 minutes; a right login starts the count again. A suite tries a wrong password once.

## Test users

The accounts the features log in as, each with the password `dD.123123ddd`:

| Handle | Username | Name | Their role in Webship site |
| --- | --- | --- | --- |
| `owner` | `owner` | Owner Test | Its manager (the managing account) |
| `member` | `member` | Member Test | A member |
| `reader` | `reader` | Reader Test | A viewer: reads, and changes nothing |
| `stranger` | `stranger` | Stranger Test | None: the project does not have them |

The build makes them with Kanboard's own code, in its container: the passwords come on the script's input, never on
a command line, and Kanboard hashes them as its own forms do.

## The test site

`.github/scripts/build-ddev-site.sh` builds it, and `COUNTS_ONLY=1` makes it print what the sample project holds
(tasks, open ones, comments, subtasks, assigned tasks, tags on tasks, task links, files, tags, categories, the
project's people, users): CI compares them before and after each run. The sample content, in the project Webship site
(identifier `WEB`), managed by owner, with member and reader, the category Bug and the tag greeting:

- "The greeting script says Helo instead of Hello" (#1): by the owner, in Work in progress, priority 3, in Bug, tagged
  greeting, assigned to the member, with the owner's comment and the member's subtask "Fix the spelling in
  greeting.sh";
- "The usage line spells greeting as greting" (#2): by the member, in Backlog;
- "The greeting script ends without a newline" (#3): by the owner, closed, in Done (the board and the list leave it
  out).

The features read the sample content and never change it. The site script (`site/kanboard-site.php`) is the one of
the Webship Workspace's Kanboard plugin: it runs in Kanboard's container, on Kanboard's own models.

The site runs Kanboard's core only: the pack has no step for a third-party plugin of Kanboard's directory.

## The assertions that must fail

`tests/must-fail/` holds scenarios that assert something that is not true on the test site; `npm run test:must-fail`
runs them and checks that each fails at its last step with the message its description announces, and a hint. A step
that cannot fail proves nothing.

## Logo

The logo is Kanboard's own icon, `assets/img/inkscape-optimized-icon.svg` of kanboard/kanboard at v1.2.58 (MIT),
unmodified; Simple Icons has no Kanboard icon. The name and the mark are Kanboard's. It names the platform the pack
tests.

## License

MIT (see `LICENSE`). Kanboard itself is MIT: the pack drives a running site and carries none of its code. Its
repository's tests (of its API and its models) were read for their flows only.
