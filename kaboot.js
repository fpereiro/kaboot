/*
kaboot - v0.1.0

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to README.md to see what this is about.
*/

(function () {

   // *** SETUP ***

   // Useful shorthand.
   var log = console.log;

   // Require the OS.
   var spawn = require ('child_process').spawn;

   // Require the 'net.
   var http = require ('http');

   // Require path, for helper functions.
   var path = require ('path');

   // Require astack (asynchronous handling), dale (looping) and teishi (validation).
   var a = require ('astack');
   var dale = require ('dale');
   var teishi = require ('teishi');

   // Require stil, for colors and formatting.
   var stil = require ('stil');

   var kaboot = exports;

   // *** INCLUDES ***

   // Copy-pasted from litre.combine (github.com/fpereiro/litre), because I didn't want to add litre as an extra dependency just for this function.
   kaboot.extend = function (first, second) {
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

   // *** PATH HELPER METHODS ***

   function pathMethodWrapper (method) {
      return function () {
         if (teishi.stop ({
            compare: arguments,
            to: 'string',
            test: teishi.test.type,
            multi: 'each',
            label: 'arguments passed to kaboot.join'
         })) return false;
         return method.apply (method, arguments);
      }
   }

   kaboot.join = pathMethodWrapper (path.join);
   kaboot.last = pathMethodWrapper (path.basename);
   kaboot.root = pathMethodWrapper (path.dirname);

   // *** VALIDATION ***

   kaboot.v = {};

   // A kaboot connection is an object with keys 'host', 'key' and 'path', which can be either strings or undefined. If 'host' is defined, so should be 'key'.

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

   /*
      A kObject (the object placed on aStack.k by kaboot.do) is an object with keys 'connections', 'count', 'log' and 'last_log':
         - connections is an array containing kaboot connections (but these are not validated in this function).
         - count is an array with integers (but in this function we only validate that it is an array).
         - log is an object where kaboot.do stores the outputs of the kFunctions.
         - last_log is where kaboot.do retrieves the logs produced by the last kFunction executed. It can have any value.
   */

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

      // last_log can hold any value, so we don't validate it.
      return ! teishi.stop ([{
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
      }]);
   }

   // *** KABOOT.HIT ***

   kaboot.hit = function (aStack, options, returnAnyResponse) {

      // Validation
      if (a.validate.aStack (aStack) === false) return false;

      if (teishi.stop ([{
         compare: options,
         to: 'object',
         test: teishi.test.type,
         label: 'options passed to kaboot.hit'
      }, {
         compare: options.host,
         to: ['string', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'options.host passed to kaboot.hit'
      }, {
         compare: options.port,
         to: ['number', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'options.port passed to kaboot.hit'
      }, {
         compare: options.path,
         to: ['string', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'options.path passed to kaboot.hit'
      }, {
         compare: options.method,
         // Taken from http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
         to: ['get', 'head', 'post', 'put', 'delete', 'trace', 'connect', undefined],
         multi: 'one_of',
         label: 'options.method passed to kaboot.hit'
      }, {
         compare: options.headers,
         to: ['object', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'options.headers passed to kaboot.hit'
      }, {
         compare: dale.do (options.headers, function (v, k) {return k}),
         // http://en.wikipedia.org/wiki/List_of_HTTP_header_fields
         to: ['accept', 'accept-charset', 'accept-encoding', 'accept-language', 'accept-datetime', 'authorization', 'cache-control', 'connection', 'cookie', 'content-length', 'content-md5', 'content-type', 'date', 'expect', 'from', 'host', 'if-match', 'if-modified-since', 'if-none-match', 'if-range', 'if-unmodified-since', 'max-forwards', 'origin', 'pragma', 'proxy-authorization', 'range', 'referer', 'te', 'user-agent', 'via', 'warning', 'x-requested-with', 'dnt', 'x-forwarded-for', 'x-forwarded-for:', 'x-forwarded-proto', 'front-end-https', 'x-att-deviceid', 'x-wap-profile', 'proxy-connection', 'x-github-event', 'x-github-delivery'],
         multi: 'each_of',
         label: 'keys of options.headers passed to kaboot.hit'
      }, {
         compare: options.headers,
         to: 'string',
         test: teishi.test.type,
         multi: 'each',
         label: 'values of options.headers passed to kaboot.hit'
      }, {
         compare: options.body,
         to: ['string', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'options.body passed to kaboot.hit'
      }])) return a.return (aStack, false);

      if (options.port) {
         if (options.port < 1 || options.port > 65535 || (! teishi.is_integer (options.port))) {
           log ('Port must be an integer in the range 1-65535');
           return a.return (aStack, false);
         }
      }

      if (options.body !== undefined && method !== 'post' && method !== 'put') {
         log ('kaboot.hit received an options.body but options.method isn\'t either "post" or "put".');
         return a.return (aStack, false);
      }

      // We set three elements on aStack.k.last_log: 1) stdout, to store all the data sent by the response, 2) error, to store possible errors in the request, and result, to hold the result of the request (an array with the response's status code, status headers and body).
      aStack.k.last_log = {
         stdout: '',
         error: '',
         result: undefined
      }

      if (options.body !== undefined && options.headers && options.headers ['content-length'] === undefined) {
         // If we have options.body and options.headers.content-length is not specified, we set it.
         options.headers ['content-length'] = body.length;
      }

      // We change host to hostname, since it's the preferred option (http://nodejs.org/api/http.html#http_http_request_options_callback).
      options.hostname = options.host;
      delete options.host;

      // We fire the request.
      var request = http.request (options, function (response) {

         if (response.statusCode >= 300 && response.statusCode < 400) {
         // If we are here, we're dealing with a redirect

            // We need a location to be redirected somewhere. Otherwise, we return false.
            if (response.headers.location === undefined) return a.return (aStack, false);

            // We set the redirect location as the host, and the path as a single slash.
            options.host = response.headers.location;
            options.path = '/';

            // If the status code is 303, we need to repeat the request but using the 'get' method.
            if (response.statusCode === 303) options.method = 'get';

            // kaboot.hit calls itself.
            kaboot.hit (aStack, options, returnAnyResponse);
            // We return to exit the execution flow in case of a redirection. Further actions are taken by the call to kaboot.hit above. By doing this, we avoid to wrap the rest of this function in an else clause.
            return;
         }

         // This is the result that will be returned if the request was considered successful.
         var result = [response.statusCode, response.headers, ''];

         response.on ('data', function (data) {
            // We send the data to three places: 1) stdout, 2) aStack.k.last_log.stdout, and 3) the third element of result.
            log (data + '');
            aStack.k.last_log.stdout += data;
            result [2] += data;
         });

         response.on ('end', function () {
            aStack.k.last_log.result = result;
            if (returnAnyResponse !== true && response.statusCode >= 400) {
               // Unless returnAnyResponse was set to true, if we get a 4xx or 5xx status code, we consider the request not to be successful. Hence, we return false.
               return a.return (aStack, false);
            }
            // We consider the request to be successful, hence we return the result.
            return a.return (aStack, result);
         });
      });

      request.on ('error', function (error) {
         // If there's an error, we send it to two places: 1) stdout, and 2) aStack.k.last_log.error
         aStack.k.last_log.error = error;
         return a.return (aStack, false);
      });

      // We send the body of the request (if we have one) and finish the request.
      if (options.body !== undefined) request.write (options.body);
      request.end ();
   }

   // *** KABOOT.RUN ***

   // This is a helper function to convert an OS call into a remote OS call (or into a nested remote call), using ssh.
   // Notice that this function is a synchronous, run-of-the-mill function that simply does some string processing.
   kaboot.ssh = function (command, connection) {
      if (kaboot.v.connection (connection) === false) return false;
      if (teishi.stop ({
         compare: command,
         to: 'string',
         test: teishi.test.type,
         label: 'command passed to kaboot.ssh'
      })) return false;

      // We wrap the command with a path. If command is 'ls -l' and path is '/home', command will now be: 'cd /home; ls -l'
      if (connection.path) command = 'cd ' + connection.path + '; ' + command;

      // Wrap the command in single quotes, and escape the single quotes within the command.
      command = "'" + command.replace (/'/g, "\\'") + "'";

      // We convert the command into a ssh command. More detail about this is given at the very end of example #1 in the README.
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

      return command.join (' ');
   }

   // This function is the most important of the library, with the exception of kaboot.do.

   kaboot.run = function (aStack) {

      if (a.validate.aStack (aStack) === false) return false;

      // The arguments are an optional path (which must be a string) and a mandatory command (which can be either a string or an array of strings.
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
      }])) return a.return (aStack, false);

      if (teishi.type (path) === 'array') path = kaboot.join.apply (kaboot.join, path);

      if (teishi.type (command) === 'array') command = command.join (' ');

      var error;
      var localPath;

      // We copy aStack.k.connections and then reverse it.
      var connections = teishi.p (teishi.s (aStack.k.connections)).reverse ();

      dale.stop_on (connections, true, function (v, k) {

         if (kaboot.v.connection (v) === false) {
            error = true;
            return true;
         }

         else if (v.host === undefined) {
            if (k === 0) {
               if (path) localPath = path;
               // If it is defined, setted, if it is undefined, nothing's changed.
               else      localPath = v.path;
            }
            // We stop the iteration
            return true;
         }

         else {
            if (path && k === 0) v.path = path;
            if (k === 0 || (v.host !== connections [k - 1].host)) command = kaboot.ssh (command, v);
         }
      });

      if (error) return a.return (aStack, false);

      if (arguments [arguments.length - 1] === true) log (('\nRunning unix command: ' + command + '\n').asBold.blue);
      if (true) log (('\nRunning unix command: ' + command + '\n').asBold.blue);

      aStack.k.last_log = {
         stdout: '',
         stderr: '',
         error: ''
      }

      if (command.indexOf (' ') === -1) {
         var stream = spawn (command);
      }
      else {
         var first = command.substr (0, command.indexOf (' '));
         var second = command.substr (command.indexOf (' ') + 1, command.length);
         // Explain the dilemma that led to this voodoo.
         second = second.replace ("'", '').replace (/'$/, '').replace ("\\'", "'").replace (/\\'$/, "'");
         var stream = spawn (first, second.split (' '), {cwd: localPath});
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
         else a.return (aStack, value_returned);
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

   kaboot.do = function (aStack) {

      // If the aStack is undefined, we initialize it.
      aStack = a.createIf (aStack);

      if (a.validate.aStack (aStack) === false) return false;

      // Besides the aStack and the label, the arguments are an optional connection object and a mandatory aPest (which is an array). There's a possible fourth argument that we will discuss in a moment.
      if (teishi.type (arguments [1]) !== 'array') {
         // We set variables for the connection and the aPest.
         var connection = arguments [1];
         var aPest = arguments [2];
      }
      else var aPest = arguments [1];

      var Return = function (aStack, value) {
         if (aStack.k) {
            aStack.k.count.pop ();
            aStack.k.connections.pop ();
         }
         a.return (aStack, value);
         return value;
      }

      // VALIDATION!!!

      /*
         We define which type of call we are. It can be three things:
            - 'initial' if it is the initial call to kaboot.do
            - 'consecutive if it's neither initial nor a recursive call. We'll mark this with a true argument appended after the two or three arguments (aStack, connection (which is optional) and an aPest (aStep/aPath))
            - 'recursive', if the caller of kaboot.do is kaboot.do
      */


      var callType;
      if (aStack.k === undefined) callType = 'initial';
      else if (arguments [arguments.length - 1] === true) callType = 'consecutive';
      else callType = 'recursive';

      // We validate the aPest.
      if (a.validate.aPest (aPest) === false) return Return (aStack, false);

      if (aPest.length === 0) {
      // Here we have no more aSteps in our aPath. If we're here and the call is not recursive, it means that the outermost k.do was called with an empty array. If we're here and the call is recursive, we need to pop the count and the connections.
         return Return (aStack, aStack.last);
      }

      if (callType === 'initial') {
         aStack.k = {
            connections: [],
            count: [],
            log: {},
            last_log: undefined,
         }
      }

      if (kaboot.v.kObject (aStack.k) === false) return Return (aStack, false);

      // Last connection has to be defined, if kaboot.do was run before.
      if (connection === undefined && aStack.k.connections.length > 0) connection = aStack.k.connections [aStack.k.connections.length - 1];

      if (kaboot.v.connection (connection) === false) {
         if (connection === undefined) log ('Undefined connection passed to kaboot.do. If you are using nested kaboot.do calls, check that the outermost call has a connection defined.');
         return Return (aStack, false);
      }

      if (callType !== 'consecutive') {
         // All connections are valid, undefined is overriden by previously defined connection.
         aStack.k.connections.push (connection);
         aStack.k.count.push (0);
      }

      var aPath = a.pestToPath (aPest);
      var aStep = aPath.shift ();

      var label;
      if (teishi.type (aStep [0]) === 'string') label = aStep.shift ();

      if (a.validate.aStep (aStep) === false) {
         return Return (aStack, false);
      }

      aStack.k.count [aStack.k.count.length - 1] ++;

      var step = aStack.k.count.join ('.');

      log (((step + ':').asBold.asUnderscore.red + (' ' + (label ? label : 'Kaboot executing step')).asBold.asUnderscore.magenta));

      a.cond (aStack, aStep, {
         false: [function (aStack) {
            aStack.k.log [teishi.s (step)] = label ? [label, aStack.k.last_log] : aStack.k.last_log;
            return Return (aStack, false);
         }],
         default: [function (aStack) {
            aStack.k.log [teishi.s (step)] = label ? [label, aStack.k.last_log] : aStack.k.last_log;
            kaboot.do (aStack, aPath, true);
         }]
      });
   }

   kaboot.cond = function (aStack) {

      var connection;
      var aCond;
      var aMap;

      if (arguments.length === 4) {
         connection = arguments [1];
         aCond = arguments [2];
         aMap = arguments [3];
      }
      else {
         aCond = arguments [1];
         aMap = arguments [2];
      }

      dale.do (aMap, function (v, k) {
         aMap [k] = [kaboot.do, v];
      });

      // We don't validate the arguments because kaboot.do and a.cond will do that for us.
      kaboot.do (aStack, connection, [a.cond, [kaboot.do, aCond], aMap]);
   }

   kaboot.fork = function (aStack) {
      var connection;
      var aPest;

      if (arguments.length === 3) {
         connection = arguments [1];
         aPest = arguments [2];
      }

      else aPest = arguments [1];

      var aPath = a.pestToPath (aPest);

      kaboot.do (aStack, connection, [
         [a.fork, aPath],
         [function (aStack) {
            var isError = dale.stop_on (aStack.last, true, function (v) {
               if (v === false) return true;
            });
            if (isError) a.return (aStack, false);
            else a.return (aStack, aStack.last);
         }]
      ]);
   }

   kaboot.cFork = function (aStack, connections, aPest) {
      var aPath = a.pestToPath (aPest);

      var to = [];
      dale.do (connections, function (v) {
         to.push ([kaboot.do, v, aPath]);
      });

      kaboot.fork (aStack, to);
   }

   kaboot.test = function (aStack, test, actions) {
      kaboot.cond (aStack, test, {
         true: [],
         false: actions
      });
   }

   kaboot.fire = function (actions, apres) {
      if (teishi.stop ([{
         compare: actions,
         to: ['object', 'array'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'actions parameter passed to kaboot.fire'
      }, {
         compare: apres,
         to: ['object', 'array', 'undefined'],
         test: teishi.test.type,
         multi: 'one_of',
         label: 'apres parameter passed to kaboot.fire'
      }])) return false;

      var action;
      if (teishi.type (actions) === 'array') {
         var singleAction = true;
         action = actions;
      }
      else action = actions [process.argv [2]];

      if (action === undefined) {
         log ('Invalid action', process.argv [2]);
         log ('Possible actions are:', dale.do (actions, function (v, k) {return k}).join (', '));
         return false;
      }

      if (a.validate.aPest (action) === false) return false;

      function replaceAtSignWithValue (kPath) {
         dale.do (kPath, function (v, k) {
         // v is each kStep
            dale.do (v, function (v2, k2) {
            // v2 are the elements of each kStep
               if (teishi.type (v2) === 'string' && v2.match (/^@[\d]+$/)) {
                  // @1 is the fourth argument, hence we sum two, since the fourth argument of a zero-indexed array is 3. However, if singleAction is set to true, this is one less, because we didn't use the third argument to specify which action to run.
                  kPath [k] [k2] = process.argv [parseInt (v2.match (/^@[\d]+$/) [0].replace ('@', '')) + (singleAction ? 1 : 2)];
               }
            });
         });
         // Notice how the function, without returning anything, modifies its inputs. This is possible because javascript is pass-by-reference when an argument is an object or an array (and we'll always pass an array (more precisely, a kPath) to this function).
      }

      action = a.pestToPath (action);
      replaceAtSignWithValue (action);

      if (teishi.type (apres) === 'array') {
         apres = {default: apres};
      }

      var apresStepCount = 0;

      dale.stop_on (apres, false, function (v, k) {
         if (a.validate.aPest (v) === false) return false;
         apres [k] = a.pestToPath (v);
         replaceAtSignWithValue (v);
         dale.do (v, function () {
            apresStepCount++;
         });
      });

      if (apresStepCount === 0) {
         kaboot.do (undefined, {}, action);
      }
      else kaboot.cond (undefined, {}, action, apres);
   }

}).call (this);
