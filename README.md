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

kaboot strives to be the **simplest possible solution for doing devops tasks**. This simplicity is achieved through four principles:

1. **The sequential principle**, which can be stated as *write sequences, not end states*: at the lowest level, every devops task boils down to a sequence of OS and network calls, interspersed with some processing of the results of these calls. Kaboot works by explicitly listing sequences of actions to be performed sequentially, conditionally and in parallel. Since actions can be composed of smaller actions, you can abstract your actions and reuse them. In contrast to the sequential approach, the declarative approach taken by most devops tools prevents you from truly knowing and being able to control what actually gets executed; and sooner than later, you need to understand and modify what gets executed.

2. **The code principle**, which can be stated as *write code, not configuration*: by using the full power of a programming language, we can achieve more clarity and conciseness than by using any configuration language. If configuration languages were more powerful than code, we would all program using configuration languages. And if we express and solve all kinds of problems using code, why not devops problems too? Kaboot is plain javascript; there is no configuration language or intermediate layer.

3. [**The auto-activation principle**](https://github.com/fpereiro/teishi#auto-activation), which can be stated as *when you find an error, stop*: the main function of kaboot runs actions in a sequence, and whenever one of these actions returns `false`, the process is aborted. You can catch errors through conditionals, and perform corrective actions or notify the problem. In this way, you sharply and automatically distinguish normal operation from abnormal operation. True automation is only possible when your processes are replicable and their rate of error converges to zero. Kaboot allows you both to automate your processes and to make them stop when they find an error, hence it allows your devops infrastructure to start walking the path of true automation.

4. **The relativity principle**, which can be stated as *there is no absolute frame of reference*: kaboot allows you to run scripts in any machine that you can access through ssh. As long those machines have keys to access other machines, they can behave as master nodes. This means that you don't need to work with a fixed architecture with master-child nodes; rather, you determine the shapes and paths of control between servers. Nested ssh calls allow you to connect from computer A to computer B and make computer B perform actions on computer C.

The goal of kaboot is to be a devops toolset that:

- Gives you the level of control and flexibility of a bash script.
- Gives you the main benefits of other devops toolsets: 1) idempotence, 2) abstraction, 3) reusability and 4) error recovery.
- Is simpler to use than both bash scripts and other toolsets, because of the four principles above.
- Has a core that's less than 1000 lines of code.

## Installation

`npm install kaboot`

or to install globally

`[sudo] npm install kaboot -g`

## Usage examples

### Example 1: install a software package in a remote server

```javascript
var k = require ('kaboot');

k.extend (k, require ('kaboots'));

function installNode (aStack, host, key) {
   k.do (aStack, {
      host: host,
      key: key
   }, [
      ['Add node.js repo', k.debian.addRepo, 'chris-lea/node.js'],
      ['Update packages', k.debian.update],
      ['Install node.js package', k.debian.install, 'nodejs'],
      ['Install forever', k.run, 'sudo npm install -g forever']
   ]);
}

k.fire (['Install node.js', installNode, '@1', '@2']);
```

As you can see above, the **code principle** allows us to express this task as a javascript function. Of course, there are rules to follow while using kaboot, but you always have the full power of javascript at your disposal.

Let's suppose that:

1. The code above is saved in a file called install.js`.
2. You have a server accessible through SSH with user `ubuntu` and domain `myserver.com`, where you want to install node.js.
3. The .pem file to access your server is in the same directory than `install.js`, under the name `key.pem`.

In that case, to install node.js in your remote server, you should enter the following at the command line:

`node install ubuntu@myserver.com key.pem`

To show you the **sequential principle**, these are the actual commands that are executed when you run the function using the above parameters:

```bash
ssh -t -t -i /home/ubuntu/key.pem -o StrictHostKeyChecking=no ubuntu@myserver.com sudo add-apt-repository -y ppa:chris-lea/node.js
ssh -t -t -i /home/ubuntu/key.pem -o StrictHostKeyChecking=no ubuntu@myserver.com sudo apt-get update
ssh -t -t -i /home/ubuntu/key.pem -o StrictHostKeyChecking=no ubuntu@myserver.com sudo apt-get -y nodejs
ssh -t -t -i /home/ubuntu/key.pem -o StrictHostKeyChecking=no ubuntu@myserver.com sudo apt-get -y npm install forever
```

If any of these commands fail (i.e.: if their unix `exit code` is different from `0`), the process will stop. This is the **auto-activation principle** in action.

### Example 2: deploy an application to a remote server

This script does the following:

- Creates a tar file from a repo in your computer.
- Copies the tar'ed repo to a remote server.
- Deletes the tar file from your computer.
- Extracts the tar file in the remote server.
- Deletes the tar file from the remote server.
- Goes into the repo folder in the remote server and starts a [forever](https://github.com/nodejitsu/forever) instance to launch the application.
- Pings the server in port 8000, where the application should be running

```javascript
var k = require ('kaboot');
k.extend (k, require ('kaboots'));
var a = require ('astack');

function installNode (aStack, host, key) {
   k.do (aStack, {
      host: host,
      key: key
   }, [
      ['Add node.js repo', k.debian.addRepo, 'chris-lea/node.js'],
      ['Update packages', k.debian.update],
      ['Install node.js package', k.debian.install, 'nodejs'],
      ['Install forever', k.run, 'sudo npm install -g forever']
   ]);
}

function deploy (aStack, repoFolder, host, key) {
   var targetFolder = '/home/ubuntu';
   var executable = 'example.js';
   var serverURL = 'main'

   k.do (aStack, [
      ['Compress local repo into tarfile.', k.unix.tar, {
         compress: k.join (__dirname, repoFolder),
         to: k.join (__dirname, repoFolder + '.tar.gz')
      }],
      ['Copy the tarfile into the remote server.', k.unix.scp, {
         from: k.join (__dirname, repoFolder + '.tar.gz'),
         to: {host: host, key: key, path: targetFolder}
      }],
      ['Remove tarfile from local computer', k.run, __dirname, ['rm', repoFolder + '.tar.gz']],
      [k.do, {host: host, key: key}, [
         ['Extract the tarfile in the remote server', k.unix.tar, {
            extract: k.join (targetFolder, k.last (repoFolder) + '.tar.gz'),
            to: targetFolder
         }],
         ['Remove the tarfile from the remote server', k.run, targetFolder, ['rm', k.last (repoFolder) + '.tar.gz']],
         ['Install npm packages', k.run, k.join (targetFolder, k.last (repoFolder)), 'sudo npm install'],
         ['Start the application in the remote server', k.run, k.join (targetFolder, k.last (repoFolder)), ['forever start', executable]]
      ]],
      ['Ping the application in the remote server', k.hit, {host: host.replace ('ubuntu@', ''), port: 8000, path: serverURL}]
   ]);
}

k.fire ({
   install: ['Install node.js', installNode, '@1', '@2'],
   deploy: ['Deploy application', deploy, '@1', '@2', '@3']
});
```

Let's suppose that:

1. The code above is saved in a file called `deploy.js`.
2. You have a server accessible through SSH with user `ubuntu` and domain `myserver.com`, where you want to deploy the application. That very server has node.js and forever installed (tasks that can be done with example #1 above).
3. The .pem file to access your server is in the same directory than `deploy.js`, under the name `key.pem`.
4. Your repo exists in the folder `app`, in the same directory than `deploy.js`.

In that case, to deploy your application in your remote server, you should enter the following at the command line:

`node deploy deploy app ubuntu@myserver.com key.pem`

Additionally, if you wanted to prepare the server (as in example #1 above), you can run:

`node deploy install ubuntu@myserver.com key.pem`

### Example 3: monitoring

This script does the following:

- Read a file with a list of IPs.
- Ping each of the servers in that list and run `vmstat` in them.
- Parse the output of `vmstat` and check that each server has less than 90% CPU load and more than 50mb of free memory.
- If one or more or the servers are unreachable, the problem is logged to the console.
- If one or more of the servers have high load or low memory, their IPs are logged to the console.
- If all the servers respond and are under normal load, it is reported through the console.

```javascript
var k = require ('kaboot');
k.extend (k, require ('kaboots'));
var a = require ('astack');
var dale = require ('dale');
var fs = require ('fs');

var log = console.log;

function monitor (aStack, serverListPath, key) {
   var serverList = JSON.parse (fs.readFileSync (serverListPath, {encoding: 'utf8'}));
   serverList = dale.do (serverList, function (v) {
      return {host: v, key: key}
   });
   k.do (aStack, [
      [k.cFork, serverList, [k.monitor.vmstat]],
      [function (aStack) {
         // If we are here, it is because all the servers could run the command successfully.
         var problemServers = [];
         dale.do (aStack.last, function (v, k) {
            // If there are less than 50mb (50000 kb) of free memory or CPUs are less than 10% idle, we consider this a problem.
            if (v.free < 50000 || v.id < 10) problemServers.push (serverList [k].host);
         });
         if (problemServers.length > 0) {
            aStack.problemServers = problemServers;
            return a.return (aStack, false);
         }
         else return a.return (aStack, true);
      }]
   ]);
}

k.fire (['Monitor servers', monitor, '@1', '@2'], {
   false: ['Report problem', function (aStack) {
      if (aStack.problemServers) log ('Servers having problems! List of servers:', aStack.problemServers);
      else log ('There was a problem connecting to one or more of the servers.');
      a.return (aStack, false);
   }],
   true: ['Report OK', function (aStack) {
      log ('Everything OK!');
      a.return (aStack, true);
   }]
});
```

Let's suppose that:

1. The code above is saved in a file called `monitor.js`.
2. You have a file `serverList.json`, with a list of server IPs. All of these servers are reachable through SSH with user `ubuntu`.
3. The .pem file to access these servers is in the same directory than `monitor.js`, under the name `key.pem`.

In that case, to monitor your servers, you should enter the following at the command line:

`node monitor serverList.json key.pem`

## A fork in the road! What do you want to do next?

- You can see more examples in [kabook](https://github.com/fpereiro/kabook), which is a list of examples and recipes for using kaboot.
- You can check out [kaboots](https://github.com/fpereiro/kaboots), the kaboot standard library. This is a repository containing useful kaboot functions for dealing with different tools and problems, such as debian, sql, monitoring, etc.
- You might be interested in the [questions](https://github.com/fpereiro/kaboot#questions) section below, which also compares kaboot with other tools.
- Or you can stay reading about kaboot. The rest of this README will explain kaboot in complete, painstaking detail.

## THE REST OF THE README, COMING SOON!

## Source code

The complete source code is contained in `kaboot.js`. It is about 720 lines long.

## License

Kaboot is written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.
