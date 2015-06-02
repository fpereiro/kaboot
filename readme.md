# kaboot

> "The horror! The horror!" -- devops mantra

kaboot is a toolset for devops written in Javascript. It's intended to be useful for:

- Setup and maintenance of servers.
- Deployment of applications.
- Monitoring of applications and servers.

kaboot is an alternative to:

- Sshing into servers and doing things by hand.
- Bash scripts.
- More complex toolsets.

kaboot works only in unix, though Windows may be supported in the future.

## Why kaboot?

kaboot strives to be the **simplest possible solution for doing devops tasks**. Tradeoff: simplicity of tool vs simplicity of script. Kaboot aims to make the simplest combination of both in the aggregate. This simplicity is achieved through four principles:

1. **The sequential principle**, which can be stated as *write sequences, not end states*: at the lowest level, every devops task boils down to a sequence of OS and network calls, interspersed with some processing of the results of these calls. Kaboot works by explicitly listing sequences of actions to be performed sequentially, conditionally and in parallel. Since actions can be composed of smaller actions, you can abstract your actions and reuse them. In contrast to the sequential approach, the declarative approach taken by most devops tools prevents you from truly knowing and being able to control what actually gets executed; and sooner than later, you need to understand and modify what gets executed.

2. **The code principle**, which can be stated as *write code, not configuration*: by using the full power of a programming language, we can achieve more clarity and conciseness than by using any configuration language. If configuration languages were more powerful than code, we would all program using configuration languages. And if we express and solve all kinds of problems using code, why not devops problems too? Kaboot is plain javascript; there is no configuration language or intermediate layer.

3. [**The auto-activation principle**](https://github.com/fpereiro/teishi#auto-activation), which can be stated as *when you find an error, stop*: the main function of kaboot runs actions in a sequence, and whenever one of these actions returns `false`, the process is aborted. You can catch errors through conditionals, and perform corrective actions or notify the problem. In this way, you sharply and automatically distinguish normal operation from abnormal operation. True automation is only possible when your processes are replicable and their rate of error converges to zero. Kaboot allows you both to automate your processes and to make them stop when they find an error, hence it allows your devops infrastructure to start walking the path of true automation.

4. **The relativity principle**, which can be stated as *there is no absolute frame of reference*: kaboot allows you to run scripts in any machine that you can access through ssh. As long those machines have access to other machines (because of keys or firewall rules), they can behave as master nodes. This means that you don't need to work with a fixed architecture with master-child nodes; rather, you determine the shapes and paths of control between servers. Nested ssh calls allow you to connect from computer A to computer B and make computer B perform actions on computer C.

5. **The no-setup principle**, which can be stated as *require as little setup as possible*: kaboot only requires node and the kaboot package on the machine that runs the kaboot script, and **places no requirements** on target nodes, as long as they are unix machines with ssh. Shy of writing kaboot on bash itself, this is the most minimalist configuration you can expect, if you are in an unix milieu.

The goal of kaboot is to be a devops toolset that:

- provides the level of control and flexibility of a bash script.
- provides the good parts of other devops toolsets: 1) idempotence, 2) succintness, 3) reusability and 4) error recovery.
- is easier to use than both bash scripts and other toolsets within thirty minutes of starting to use it for the first time.
- has a core that's less than 1000 lines of code.

## Installation

`npm install kaboot`

## Usage examples

Please check [kabook](https://github.com/fpereiro/kabook), an entire repo dedicated to kaboot examples and recipes ; ).

## Intrigued? Here's your hard hat!

Kaboot is undergoing a radical rewrite. While its main concepts and structures are firmly in place, large sections of core functionality are still being worked out.

If you are at all interested by what you've seen so far, I would love to hear your suggestions and requests: my email is fpereiro@gmail.com

## License

Kaboot is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
