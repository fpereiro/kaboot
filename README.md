# kaboot

> "The horror! The horror!" -- devops mantra

kaboot is a toolset for devops written in Javascript. It's intended to be useful for:

- Deployment of applications.
- Setup and maintenance of servers.

kaboot is an alternative to:

- Manually sshing into servers.
- Throwaway maintenance scripts.
- More complex toolsets.

## Why kaboot?

Kaboot strives to be the simplest possible solution for doing devops tasks. This simplicity is achieved through two principles:

1. **The sequential principle**, which can be stated as *write sequences, not end states*: by expressing everything as a set of actions, you fully understand what is going on, because you can narrow any action to a sequence of things happen one after the other. Since actions can be composed of smaller actions, you can abstract your actions and reuse them. Actions can be executed also conditionally and in parallel - consider these as special sequences. In contrast to the sequential approach, the declarative approach taken by most devops tools prevents you from knowing and being able to control what actually gets executed; and sooner than later, you need to understand and modify what's going on.

2. **The code principle**, which can be stated as *write code, not configuration*: by using the full power of a programming language, we can achieve more clarity and conciseness than any configuration language. If configuration languages were more powerful than code, we would all program using configuration languages. And if we express and solve all kinds of problems using code, why not devops problems too? Kaboot is plain javascript; there is no configuration language or intermediate layer.

## ALL THE STUFF THAT SHOULD BE HERE, COMING SOON!
