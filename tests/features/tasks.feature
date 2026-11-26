@tasks
Feature: The tasks of a project
  A member of the project opens a task, moves it to another column, comments on it, tags it, sets its category, assigns
  it, adds a subtask, and closes it and opens it again. Every task a scenario makes goes after it.

  Scenario: A sample task by its number: its author, its assignee, its tag, its category, its comment and its subtask
    Given I am a logged in user with the "member" user
    When I open the task "#1"
    Then the task should be created by "Owner Test"
    And the task should be assigned to "Member Test"
    And the task should have the tag "greeting"
    And the task should be in the category "Bug"
    And the task should be in the column "Work in progress"
    And the task should show the comment "Seen on the test site" by "Owner Test"
    And the task should have the subtask "Fix the spelling in greeting.sh"
    And the task should be open

  Scenario: A sample task that is closed
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script ends without a newline"
    Then the task should be closed
    And the task should be created by "owner"

  Scenario: A task moved on the board, closed, and opened again
    Given there is a task "Webship test move" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test move"
    And I move the task to the column "Ready"
    Then the task should be in the column "Ready"
    When I close the task
    Then the task should be closed
    When I open the task again
    Then the task should be open

  Scenario: A comment, a tag, a category, an assignee and a subtask on a task
    Given there is a task "Webship test work" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test work"
    And I add the comment "Checked on the test site" to the task
    Then the task should show the comment "Checked on the test site" by "Member Test"
    When I add the tag "greeting" to the task
    Then the task should have the tag "greeting"
    When I set the category of the task to "Bug"
    Then the task should be in the category "Bug"
    When I assign the task to "Owner Test"
    Then the task should be assigned to "Owner Test"
    When I add the subtask "Check the output" to the task
    Then the task should have the subtask "Check the output"
