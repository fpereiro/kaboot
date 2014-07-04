/*
kaboot - v0.0.0

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to README.md to see what this is about.
*/

(function () {

   // *** SETUP ***

   // Useful shorthand.
   var log = console.log;

   // Require the 'net.
   var http = require ('http');

   // Require the OS.
   var spawn = require ('child_process').spawn;

   // Require astack, dale and teishi.
   var a = require ('astack');
   var dale = require ('dale');
   var teishi = require ('teishi');

   // Require stil, for colors and formatting.
   var stil = require ('stil');

   var kaboot = exports;

   // *** INCLUDES ***

   // Copy-pasted from litre.combine (github.com/fpereiro/litre), because I didn't want to add litre as an extra dependency just for this function.
   kaboot.combine = function (first, second) {
      if (teishi.stop ([{
         compare: arguments,
         to: ['array', 'object'],
         test: teishi.test.type,
         multi: 'each_of',
         label: 'Argument passed to litre.combine'
      }, {
         compare: teishi.type (second),
         to: teishi.type (first),
         label: 'Type of arguments is inconsistent.'
      }])) return false;

      if (dale.stop_on (second, false, function (v, k) {

         if (teishi.type (v) !== 'array' && teishi.type (v) !== 'object') {
            // We don't override null or undefined values.
            if (v === null || v === undefined) return true;
            first [k] = v;
         }
         else {
            if (teishi.type (first [k]) !== 'array' && teishi.type (first [k]) !== 'object') {
               // If first [k] is a simple value, we override it.
               first [k] = v;
            }
            else {
               // If it's a complex value, we combine it recursively!
               var recursive_result = kaboot.combine (first [k], v);
               if (recursive_result === false) return false;
               first [k] = recursive_result;
            }
         }
      }) === false) return false;
      else return first;
   }

   kaboot.extend = function (extensions) {
      if (teishi.type (extensions) === 'string') extensions = [extensions];
      if (teishi.stop ([{
         compare: extensions,
         to: 'array',
         test: teishi.test.type,
         label: 'extensions argument passed to kaboot.extend'
      }, {
         compare: extensions,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'elements of extensions argument passed to kaboot.extend'
      }])) return false;

      var This = this;
      dale.do (extensions, function (v) {
         This = kaboot.combine (This, require (v));
      });
   }

   // *** VALIDATION ***

   kaboot.v = {};

   kaboot.v.connection = function (connection) {
      if (teishi.stop ({
         compare: connection,
         to: 'object',
         test: teishi.test.type,
         label: 'kaboot connection'
      })) return false;

      return ! teishi.stop ([{
         compare: dale.do (connection, function (v, k) {return k}),
         to: ['host', 'key', 'path'],
         multi: 'each_of',
         label: 'keys of kaboot connection object'
      }, {
         compare: [connection.host, connection.key, connection.path],
         to: ['string', 'undefined'],
         test: teishi.test.type,
         multi: 'each_of',
         label: 'kaboot connection object values'
      }, {
         // If connection.host is a string (not undefined), so must be connection.key. Same with undefined.
         compare: connection.host,
         to: teishi.type (connection.key),
         test: teishi.test.type,
         label: 'Type of connection.host',
         label_to: 'type of connection.key'
      }]);
   }

   kaboot.v.kObject = function (kObject) {
      if (teishi.stop ([{
         compare: kObject,
         to: 'object',
         test: teishi.test.type,
         label: 'aStack.k'
      }, {
         compare: dale.do (kObject, function (v, k) {return k}),
         to: ['connections', 'count', 'log', 'last_log'],
         multi: 'each_of',
         label: 'keys of aStack.k'
      }])) return false;

      return (! teishi.stop ([{
         compare: kObject.connections,
         to: 'array',
         test: teishi.test.type,
         label: 'aStack.k.connections'
      }, {
         compare: kObject.count,
         to: 'array',
         test: teishi.test.type,
         label: 'aStack.k.count'
      }, {
         compare: kObject.log,
         to: 'object',
         test: teishi.test.type,
         label: 'aStack.k.log'
      // last_log can hold any value, so we don't validate it.
      }]));
   }

   /*

   count
   log (in object, and stream)
   execute
   stop on false

   */

   kaboot.do = function (aStack) {
      // If the aStack is undefined, we initialize it.
      if (aStack === undefined) {
         aStack = {aPath: []}
      }

      if (a.validate.aStack (aStack) === false) return false;

      // Besides the aStack and the label, the arguments are an optional connection object and a mandatory aPath/aStep (which is an array). There's a possible fourth argument that we will discuss in a moment.
      if (teishi.type (arguments [1]) === 'object') {
         // We set variables for the connection and the aPath.
         var connection = arguments [1];
         var aPath = arguments [2];
      }
      else var aPath = arguments [1];

      /*
         We define which type of call we are. It can be three things:
            - 'initial' if it is the initial call to kaboot.do
            - 'consecutive if it's neither initial nor a recursive call. We'll mark this with a true argument appended after the two or three arguments (aStack, connection (which is optional) and aStep/aPath)
            - 'recursive', if the caller of kaboot.do is kaboot.do
      */

      var callType;
      if (aStack.k === undefined) callType = 'initial';
      else if (arguments [arguments.length - 1] === true) callType = 'consecutive';
      else callType = 'recursive';

      // We validate the aPath.
      if (a.validate.aPath (aPath) === false) return a.aReturn (aStack, false);

      if (aPath.length === 0) {
      // Here we are at an end (compare with the beginning below).
         if (callType !== 'initial') {
            aStack.k.count.pop ();
            aStack.k.connections.pop ();
         }
         // If the callType is 'initial', it means that we're dealing with a single kaboot.do call with an empty aStep/aPath. Hence, no aStack.k to work with.
         return a.aReturn (aStack, aStack.last);
      }

      if (callType === 'initial') {
         aStack.k = {
            connections: [],
            count: [],
            log: {},
            last_log: undefined,
         }
      }

      if (kaboot.v.kObject (aStack.k) === false) return a.aReturn (aStack, false);

      if (callType !== 'consecutive') {
         aStack.k.connections.push (connection);
         aStack.k.count.push (0);
      }

      if (connection === undefined) {
         dale.stop_on (aStack.k.connections, true, function (v, k) {
            var current = aStack.k.connections [aStack.k.connections.length - 1 - k];
            if (current !== undefined) {
               connection = current;
               return true;
            }
         });
      }

      if (kaboot.v.connection (connection) === false) {
         if (connection === undefined) log ('Undefined connection passed to kaboot.do. If you are using nested kaboot.do calls, check that the outermost call has a connection defined.');
         return a.aReturn (aStack, false);
      }

      var aStep;
      if (teishi.type (aPath [0]) === 'function' || teishi.type (aPath [0]) === 'string') {
         aStep = aPath;
         aPath = [];
      }
      else aStep = aPath.shift ();

      var label;
      if (teishi.type (aStep [0]) === 'string') label = aStep.shift ();

      if (a.validate.aStep (aStep) === false) {
         return a.aReturn (aStack, false);
      }

      aStack.k.count [aStack.k.count.length - 1] ++;

      var step = aStack.k.count.join ('.');

      log (((step + ':').asBold.asUnderscore.red + (' ' + (label ? label : 'Kaboot executing step')).asBold.asUnderscore.magenta));

      a.aCond (aStack, aStep, {
         false: [function (aStack) {
            aStack.k.log [teishi.s (step)] = label ? [label, aStack.k.last_log] : aStack.k.last_log;
            a.aReturn (aStack, false);
         }],
         default: [function (aStack) {
            aStack.k.log [teishi.s (step)] = label ? [label, aStack.k.last_log] : aStack.k.last_log;
            kaboot.do (aStack, aPath, true);
         }]
      });
   }

/*

Most of the unix commands we want to run will be commands in remote servers. This allows us to run a kaboot script in a single server (your computer counts as a server!) that can deploy or monitor several servers.

The good thing is that remote unix commands are just a special kind of ordinary unix commands, since we can invoke the ssh command and pass it the remote command.

We'll now write a function ssh that receives an unix command plus connection parameters and returns a properly formatted unix command.

There are many ways to handle authentication, but they fall into two approaches:
- Applying configuration changes on the target server (such as adding a ssh key in .ssh/authorized_keys or setting a password).
- Giving access information to the source server (namely, providing a .pem key for accessing the target server).

I'm going to use the second approach, for I consider it cleaner. For one, it applies the lean thinking principle of pull. Here, kaboot pulls info (the .pem file) from the source of that information. In the other approach, we push information about the source server onto the target server. When we do that, we now have to keep state of what access info is stored in the target server. With our approach, we can either give the source server access to the .pem file when it needs it. To ensure access, grant the .pem file. To revoke access, remove access to the .pem. There's no state to be held in the target server, except for the .pem that grants access to it.

Also, the first time that the source server connects to the target server, ssh will ask if we trust that server, to ensure that we don't fall prey to a man-in-the-middle attack. While this indeed has a purpose, it's standard practice to blindly enter "yes" manually, so instead of that, we're going to automate that standard practice by overriding the default to the StrictHostKeyChecking option. If there's a better standard practice that can be automated, I will be glad to change this in the future.

Besides placing the hostname and the keyPath, ssh must quote it so that the shell of the source server doesn't modify it before sending it to the target server. Of course, I assume that you're passing literal commands to the target server and you're not relying on local variables within the source server; if you have variables that affect the command, they should be part of your kaboot code. We will wrap the command between double quotes and escape any double quotes already present in the command.

One further note: ssh expects that the file permissions of the key should be strict enough. While we could automatically chmod this file in this function to always ensure this, I believe it's more elegant to do it when the .pem file is created. Thus, that operation belongs elsewhere, and the ssh function will take it for granted.

*/

kaboot.ssh = function ssh (command, connection) {
   if (kaboot.v.connection (connection) === false) return false;
   if (teishi.stop ({
      compare: command,
      to: 'string',
      test: teishi.test.type,
      label: 'command passed to kaboot.ssh'
   })) return false;

   command = command.replace (/'/g, '\'');
   var command = [
      'ssh',
      // http://stackoverflow.com/a/7122115
      '-t -t',
      '-i',
      connection.key,
      '-o StrictHostKeyChecking=no',
      connection.host,
      command
   ];

   if (connection.path) command.splice ([command.length - 1], 0, 'cd ' + connection.path + ';');

   return command.join (' ');
}

   kaboot.path = function () {
      if (teishi.stop ({
         compare: arguments,
         to: ['array', 'string'],
         test: teishi.test.type,
         multi: 'each_of',
         label: 'Arguments passed to kaboot.path'
      })) return false;

      var output = '';

      dale.stop_on (arguments, false, function (v, k) {
         if (teishi.type (v) === 'array') {
            v = kaboot.path (v);
            if (v === false) {
               output = false;
               return false;
            }
         }

         if (output.length === 0) output += v;
         else if (output [output.length - 1] !== '/') {
            if (v [v.length - 1] !== '/') output += '/' + v;
            else output += v;
         }
         else {
            if (v [v.length - 1] !== '/') output += v;
            else output += v.substr (1, v.length);
         }
      });

      return output;
   }

/*

if connection, pass it to kaboot.ssh

can be string, array, or two arrays
if it's string, string is command
if it's array, command is array merged with spaces. array must be array of strings.
if it's two arrays, first is an array of strings, which is cded before running the command.

create logging object or find it in the aStack.

log command.
run command.
send outputs to stdout/stderr and logging object.

aReturns false or last_log

nested connections. undefined is ignored. {} calls toplevel.

path overrides path in connection

*/

   // return true anyway vs return false on error code!
   kaboot.run = function run (aStack) {

      // XXX parametrize
      var verbose = true;

      if (a.validate.aStack (aStack) === false) return false;

      if (arguments [2] !== undefined) {
         var path = arguments [1];
         var command = arguments [2];
      }
      else var command = arguments [1];

      if (teishi.stop ([{
         compare: path,
         to: ['array', 'string', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'path argument passed to kaboot.run'
      }, {
         compare: command,
         to: ['array', 'string'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'command argument passed to kaboot.run'
      }, {
         // path and command, if they are arrays, should be composed of strings. The following two tests check for this.
         // Notice that if path is a string or undefined, or if command is a string, the test will pass succesfully, because of how dale.do works (it iterates 0 times with undefined and 1 with a string.)
         compare: path,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'elements of path argument passed to kaboot.run',
      }, {
         compare: command,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'elements of path argument passed to kaboot.run',
      }])) return a.aReturn (aStack, false);

      if (teishi.type (command) === 'array') command = command.join (' ');

      var error;
      var nestedness = 0;
      var localPath;

      dale.stop_on (aStack.k.connections, true, function (v, k) {
         var current = aStack.k.connections [aStack.k.connections.length - 1 - k];
         if (current === undefined) return;
         else if (kaboot.v.connection (current) === false) {
            error = true;
            return true;
         }
         else if (current.host === undefined) {
            if (nestedness === 0) {
               if (path) localPath = path;
               else {
                  if (current.path) localPath = path;
               }
            }
            return true;
         }
         else {
            // XXX
            //if (path && k === aStack.k.connections.length - 1) {
            if (path && k === 0) {
               // XXX explain that we make a copy to not affect the object for consecutive calls.
               var otherCurrent = teishi.p (teishi.s (current));
               otherCurrent.path = path;
               command = kaboot.ssh (command, otherCurrent);
            }
            else command = kaboot.ssh (command, current);
         }
      });

      if (error) return a.aReturn (aStack, false);

      if (verbose) log (('\nRunning unix command: ' + command + '\n').asBold.blue);

      aStack.k.last_log = {
         stdout: '',
         stderr: '',
         error: ''
      }

      if (command.indexOf (' ') === -1) {
         var stream = spawn (command);
      }
      else {
         // notice how we only put cwd if aStack.k.connection.host is not defined
         var stream = spawn (command.substr (0, command.indexOf (' ')), command.substr (command.indexOf (' ') + 1, command.length).split (' '), {cwd: localPath});
      }

      stream.stdout.on ('data', function (data) {
         aStack.k.last_log.stdout += data;
         log ((data + '').green);
      });

      stream.stderr.on ('data', function (data) {
         aStack.k.last_log.stderr += data;
         log ((data + '').yellow);
      });

      // stdout, stderr, stream -> 3 events we are waiting
      var wait_for = 3;
      var value_returned;

      var complete = function (value_returned) {
         if (wait_for > 1) wait_for--;
         else a.aReturn (aStack, value_returned);
      }

      stream.on ('error', function (error) {
         aStack.k.last_log.error = error;
         if (error) {log ((error + '').red)}
         value_returned = false;
         complete (value_returned);
      });

      stream.stdout.on ('end', function () {
         complete (value_returned);
      });

      stream.stderr.on ('end', function () {
         complete (value_returned);
      });

      stream.on ('exit', function () {
         aStack.k.last_log.code = stream.exitCode;
         value_returned = stream.exitCode === 0 ? aStack.k.last_log : false;
         complete (value_returned);
      });
   }

   // XXX The stuff below must go in libraries

   kaboot.unix = {};

   kaboot.unix.scp = function (aStack, options) {

      // VALIDATION

      if (teishi.stop ([{
         compare: options,
         to: 'object',
         test: teishi.test.type,
         label: 'options passed to kaboot.unix.scp'
      }, {
         compare: dale.do (options, function (v, k) {return k}),
         to: ['from', 'to', 'recursive'],
         multi: 'each_of',
         label: 'Keys within options passed to kaboot.unix.scp'
      }, {
         compare: [options.from, options.to],
         to: ['string', 'object'],
         test: teishi.test.type,
         multi: 'each_of',
         label: 'options.from and options.to passed to kaboot.unix.scp'
      }, {
         compare: options.recursive,
         to: [true, false, undefined],
         multi: 'one_of',
         label: 'options.recursive passed to kaboot.unix.scp'
      }])) return a.aReturn (aStack, false);

      var remote;
      if (teishi.type (options.from) === 'string') remote = options.to;
      else if (teishi.type (options.to) === 'string') {
         remote = options.from;
      }
      else {
         log ('options.from or options.to passed to kaboot.unix.scp must be a string path!');
         return a.aReturn (aStack, false);
      }

      if (teishi.stop ([{
         compare: remote,
         to: 'object',
         test: teishi.test.type,
         label: 'remote object (either options.from or options.to) passed to kaboot.unix.scp'
      }, {
         compare: dale.do (remote, function (v, k) {return k}),
         to: ['host', 'key', 'path'],
         multi: 'each_of',
         label: 'Keys of remote object (either options.from or options.to) passed to kaboot.unix.scp'
      }, {
         compare: remote,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'remote.host, remote.key and remote.path within remote object passed to kaboot.unix.scp'
      }])) return a.aReturn (aStack, false);

      var command = ['scp', '-v', '-o StrictHostKeyChecking=no', '-i', remote.key];
      if (options.recursive) command.push ('-r');
      if (teishi.type (options.from) === 'object') {
         options.from = options.from.host + ':' + options.from.path;
      }
      else {
         options.to = options.to.host + ':' + options.to.path;
      }

      command = command.concat ([options.from, options.to]);

      kaboot.do (aStack, [
         ['Perform scp', kaboot.run, command]
      ]);
   }

   kaboot.unix.tar = function (aStack, options) {
      if (teishi.stop ({
         compare: options,
         to: 'object',
         test: teishi.test.type,
         label: 'options passed to kaboot.unix.tar'
      })) return a.aReturn (aStack, false);

      if (teishi.stop ([{
         compare: options.to,
         to: 'string',
         test: teishi.test.type,
         label: 'options.to passed to kaboot.unix.tar'
      }, {
         compare: [options.compress, options.extract],
         to: ['string', 'undefined'],
         test: teishi.test.type,
         multi: 'each_of',
         label: 'options.compress, options.extract'
      }, {
         compare: teishi.test.type (options.compress) === teishi.test.type (options.extract),
         to: false,
         label: 'options.compress and options.extract can\'t be defined simulataneously.'
      }])) return a.aReturn (aStack, false);

      if (options.compress) kaboot.do (aStack, [kaboot.run, ['tar', 'czvf', options.to, options.compress]]);
      else                  kaboot.do (aStack, [kaboot.run, ['tar', 'xzvf', options.extract, '-C', options.to]]);
      // XXX add dvzf check
   }

}).call (this);
