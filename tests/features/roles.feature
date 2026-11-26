@roles
Feature: What a viewer of the project, or someone it does not have, may not do
  A viewer reads the project's tasks and their comments, and neither changes a task, nor comments on it, nor makes one;
  an account the project does not have is refused its tasks.

  Scenario: A viewer reads a task, and neither changes nor comments on it
    Given I am a logged in user with the "reader" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Seen on the test site" by "Owner Test"
    And I should not be able to change the task
    And I should not be able to comment on the task
    And I should not be able to create a task in the project "Webship site"

  @js-off
  Scenario: An account the project does not have is refused its tasks
    Given I am a logged in user with the "stranger" user
    Then I should be refused the task "The greeting script says Helo instead of Hello"
