@must-fail
Feature: Assertions that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A session that is not the account named
    Fails with: Expected to be logged in as "Owner Test", but the session is Member Test.
    Given I am a logged in user with the "member" user
    Then I should be logged in as "Owner Test"

  Scenario: A session that is there
    Fails with: Expected no session, but the session is Member Test's.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: A login that worked is not refused
    Fails with: Expected to see the login form, but it did not appear within
    Given I am not logged in
    When I log in with the "member" user
    Then the login should be refused with "Bad username or password"

  Scenario: A task the column does not list
    Fails with: Expected to see the task "The usage line spells greeting as greting" in the column "Ready", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the column "Ready" should list the task "The usage line spells greeting as greting"

  Scenario: A task the list does not show
    Fails with: Expected to see the task "Webship test nothing" in the list, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the list of the project "Webship site"
    Then the task list should show "Webship test nothing"

  Scenario: A column the task is not in
    Fails with: Expected the task to be in the column "Done", but it is in "Work in progress".
    Given I am a logged in user with the "member" user
    When I open the task "#1"
    Then the task should be in the column "Done"

  Scenario: A task that is not closed
    Fails with: Expected the task to be closed, but it is open.
    Given I am a logged in user with the "member" user
    When I open the task "#1"
    Then the task should be closed

  Scenario: A comment the task does not have
    Fails with: Expected the task to show the comment "Webship test nothing". Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Webship test nothing"

  Scenario: A comment by another account
    Fails with: Expected the task to show the comment "Seen on the test site" by Member Test. Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Seen on the test site" by "Member Test"

  Scenario: A tag the task does not have
    Fails with: Expected the task to have the tag "docs", but it has "greeting".
    Given I am a logged in user with the "member" user
    When I open the task "#1"
    Then the task should have the tag "docs"

  Scenario: A category the task is not in
    Fails with: Expected the task to be in the category "Bug", but it has none.
    Given I am a logged in user with the "member" user
    When I open the task "The usage line spells greeting as greting"
    Then the task should be in the category "Bug"

  Scenario: An assignee the task does not have
    Fails with: Expected the task to be assigned to "Owner Test", but it is assigned to Member Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be assigned to "Owner Test"

  Scenario: An author the task does not have
    Fails with: Expected the task to be created by "Member Test", but it was created by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be created by "Member Test"

  Scenario: A subtask the task does not have
    Fails with: Expected the task to have the subtask "Webship test nothing", but it has "Fix the spelling in greeting.sh".
    Given I am a logged in user with the "member" user
    When I open the task "#1"
    Then the task should have the subtask "Webship test nothing"

  Scenario: A member may change a task
    Fails with: Expected the task to be closed to this account, but its sidebar offers "Edit the task".
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to change the task

  Scenario: A member may comment on a task
    Fails with: Expected no way to comment on the task, but its page offers "Add a comment".
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to comment on the task

  Scenario: A member may make a task
    Fails with: Expected no way to make a task in Webship site, but its board offers "Add a new task".
    Given I am a logged in user with the "member" user
    Then I should not be able to create a task in the project "Webship site"

  Scenario: An account the project has is not refused it
    Fails with: Expected the project "Webship site" to be refused, but its board answered 200 with 2 task(s).
    Given I am a logged in user with the "member" user
    Then I should be refused the project "Webship site"

  Scenario: An account the project has is not refused its task
    Fails with: Expected the task #1 to be refused, but its page answered 200 with "The greeting script says Helo instead of Hello".
    Given I am a logged in user with the "reader" user
    Then I should be refused the task "The greeting script says Helo instead of Hello"

  Scenario: A column the board does not have
    Fails with: The board has no column "Webship test nowhere"; its columns are "Backlog", "Ready", "Work in progress", "Done".
    Given I am a logged in user with the "member" user
    When I open the task "The usage line spells greeting as greting"
    And I move the task to the column "Webship test nowhere"
