@board
Feature: The board and the list of a project
  A project opens on its board: its columns, Backlog, Ready, Work in progress and Done, hold its open tasks; its list
  shows them a row each. A closed task is on neither. A member makes a task on the board.

  Scenario: The sample tasks in their columns
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the column "Work in progress" should list the task "The greeting script says Helo instead of Hello"
    And the column "Backlog" should list the task "The usage line spells greeting as greting"
    And the column "Work in progress" should not list the task "The usage line spells greeting as greting"
    And the column "Done" should not list the task "The greeting script ends without a newline"

  Scenario: The list shows the open tasks
    Given I am a logged in user with the "member" user
    When I open the list of the project "Webship site"
    Then the task list should show "The greeting script says Helo instead of Hello"
    And the task list should show "The usage line spells greeting as greting"
    And the task list should not show "The greeting script ends without a newline"

  Scenario: A new task on the board
    Given there is no task "Webship test new" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I create a task "Webship test new" in the project "Webship site"
    And I open the project "Webship site"
    Then the column "Backlog" should list the task "Webship test new"
