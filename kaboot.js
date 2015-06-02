/*
kaboot - v0.9.0

Written by Federico Pereiro (fpereiro@gmail.com) and released into the public domain.

Please refer to readme.md to read the annotated source (but not just yet!).
*/

(function () {

   // *** SETUP ***

   var http   = require ('http');
   var spawn  = require ('child_process').spawn;
   var path   = require ('path');

   var dale   = require ('dale');
   var teishi = require ('teishi');
   var a      = require ('astack');
   var stil   = require ('stil');
   var log    = teishi.l;

   var k = exports;

   // *** HELPERS ***

   k.return = a.return;

   k.extend = function () {
      dale.stopOn ([].slice.call (arguments), false, function (v) {
         dale.stopOn (require (v), false, function (v2, k2) {
            if (k [k2] !== undefined) {
               log ('k.extend', 'Requiring module', k2, 'but a module with that name is already attached to the kaboot object!');
               process.exit (1);
            }
            k [k2] = v2;
         });
      });
   }

   var pathWrapper = function (method) {
      return function (input) {
         var Arguments = [].slice.call (arguments);
         if (teishi.stop ('kaboot path function', ['arguments', Arguments, ['string', 'integer'], 'eachOf'])) return false;
         return method.apply (method, Arguments);
      }
   }

   k.path = {
      join: pathWrapper (path.join),
      last: pathWrapper (path.basename),
      root: pathWrapper (path.dirname)
   }

   k.toString = function (input, varname, funname, join) {
      if (teishi.stop ('k.toString', [
         ['varname', varname, 'string'],
         ['funname', funname, 'string'],
         ['join', join, ['string', 'function'], 'oneOf'],
      ])) return false;

      var recursive = function (input, output) {
         output = output || [];
         if (teishi.stop (funname, ['elements of ' + varname, input, ['string', 'integer', 'array', 'undefined'], 'eachOf'])) return output = false;
         dale.stopOn (input, false, function (v) {
            if (teishi.complex (v)) return recursive (v, output);
            if (v === undefined || v === '') return;
            output.push (v + '');
         });
         return output;
      }

      input = recursive (input);

      if (input === false) return false;

      var Join = teishi.t (join) === 'function' ? join : function () {
         return [].slice.apply (arguments).join (join);
      };

      return Join.apply (Join, input);
   }

   k.prompt = function (s, message, options) {
      var inputs = dale.keys (options);
      process.stdout.write ('You are about to ' + message + ' Are you sure? (' + inputs.join ('/') + ')');
      process.stdin.setEncoding ('utf8');
      process.stdin.once ('data', function (val) {
         val = val.replace ('\n', '');
         if (inputs.indexOf (val) === -1) {
            console.log ('Invalid option: ' + val);
            return k.prompt (s, message, options);
         }
         k.return (s, options [val]);
      });
   }

   // *** K.RUN ***

   k.run = function (s) {

      var Arguments = [].slice.call (arguments, 1);
      var path      = (Arguments.length > 1 && teishi.t (Arguments [1]) !== 'object') ? Arguments [0] : null;
      var command   = path === null ? Arguments [0] : Arguments [1];
      var options   = (Arguments.length > 1 && path === null) ? Arguments [2] : undefined;

      if (teishi.stop ('k.run', [
         ['arguments length', Arguments.length, {min: 1, max: 3}, teishi.test.range],
         [path !== null, ['path', path, ['array', 'string'], 'oneOf']],
         ['command', command, ['array', 'string'], 'oneOf'],
         ['options', options, ['object', 'undefined'], 'oneOf'],
         [options !== undefined, [
            ['options keys', dale.keys (options), ['host', 'key'], 'oneOf', teishi.test.equal],
            function () {return [
               ['options.host', options.host, ['array', 'string', 'undefined'], 'oneOf'],
               ['options.key',  options.key,  ['array', 'string', 'undefined'], 'oneOf'],
            ]}
         ]]
      ])) return false;

      command = k.toString (command, 'command', 'k.run', ' ');

      if (command === false) return false;

      var ssh = function (command, connection) {

         return k.toString ([
            'ssh',
            // http://stackoverflow.com/a/7122115
            '-t -t',
            connection.key ? ['-i', connection.key] : connection.key,
            '-o StrictHostKeyChecking=no',
            connection.host,
            command
         ], 'command', 'k.run', ' ');
      }

      var stack = {
         host: (teishi.c (s.vars.host) || []).reverse (),
         key:  (teishi.c (s.vars.key)  || []).reverse (),
         path: (teishi.c (s.vars.path) || []).reverse ()
      }

      if ((options && options.host) || path !== null) {
         stack.host.unshift ((options && options.host) || stack.host [0]);
         stack.key.unshift  ((options && options.key)  || stack.key  [0]);
         stack.path.unshift (path !== null ? path : stack.path [0]);
      }

      dale.stopOn (stack.host, undefined, function (v, k) {
         if (v === undefined) {
            path = stack.path [k];
            return;
         }
         if (stack.path [k] && (k === 0 || stack.path [k - 1] !== stack.path [k])) command = ['cd', exports.toString (stack.path [k], 'path', 'k.run', '/'), ';', command];
         if (stack.host [k] && (k === 0 || stack.host [k - 1] !== stack.host [k])) command = ssh (command, {host: v, key: stack.key [k], path: stack.path [k]});
      });

      log ('k.run executing command'.cyan.asBold.onBlack, command.asBold.blue);

      var Data = {
         stdout: '',
         stderr: '',
         error: ''
      }

      var commands = command.split (' ');
      var first    = commands.shift ();
      var stream   = spawn (first, commands, {cwd: path});

      stream.stdout.on ('data', function (data) {
         Data.stdout += data;
         console.log (('\n' + data).replace (/\n$/, '').split ('\n').join ('\nstdout: '.asBold.green));
      });

      stream.stderr.on ('data', function (data) {
         Data.stderr += data;
         console.log (('\n' + data).replace (/\n$/, '').split ('\n').join ('\nstderr: '.asBold.yellow));
      });

      var wait_for = 3;
      var value_returned;

      var complete = function (value_returned) {
         if (wait_for > 1) wait_for--;
         else              k.return (s, value_returned);
      }

      stream.stdout.on ('end', function () {complete (value_returned)});
      stream.stderr.on ('end', function () {complete (value_returned)});

      stream.on ('error', function (error) {
         Data.error = error;
         if (error) console.log (('\n' + error).split ('\n').join ('\nerror:  '.asBold.red));
         value_returned = false;
         complete (value_returned);
      });

      stream.on ('exit', function () {
         Data.code = stream.exitCode;
         value_returned = stream.exitCode === 0 ? Data : false;
         complete (value_returned);
      });
   }

   // *** K.DO ***

   k.print = function (s, message) {
      var count = s.run.count;
      count [count.length - 1]++;
      log (('Step ' + count.join ('.')).magenta.asBold.onBlack, k.toString ([message], 'tag', 'k.do', ' ').green.asBold);
      k.return (s, true);
   }

   k.vpush = function (s, vars) {
      var stackVars = ['host', 'key', 'path'];
      if (teishi.v (['', dale.keys (vars), stackVars, 'oneOf'], true)) {
         dale.do (stackVars, function (v) {
            if (dale.keys (vars).indexOf (v) === -1) {
               s.vars [v] = s.vars [v] || [];
               s.vars [v].push (s.vars [v].length === 0 ? s.vars [v] [s.vars [v].length - 1] : undefined);
            }
         });
      }
      dale.do (vars, function (v, k) {
         s.vars [k] = s.vars [k] || [];
         s.vars [k].push (v);
         s [k] = v;
      });
      k.return (s, true);
   }

   k.vpop = function (s, vars) {
      dale.do (vars, function (v, k) {
         s.vars [k].pop ();
         s [k] = s.vars [k].length === 0 ? undefined : s.vars [k] [s.vars [k].length - 1];
      });
      k.return (s, true);
   }

   k.do = function () {

      var arg   = 0;
      var s     = teishi.t (arguments [0]) === 'object' ? arguments [arg++] : a.create ();
      var steps = arguments [arg++];

      s.run = s.run || {
         count: [0],
         steps: [],
         rollback: [],
         run: []
      }

      s.vars = s.vars || {};

      var Steps = [];

      var parse = function (steps, next) {
         if (steps === undefined) return;
         if (teishi.stop ('kaboot', ['steps', steps, ['array', 'function'], 'oneOf'])) return false;

         if (teishi.t (steps) === 'array') {
            if (steps [0] === undefined || teishi.t (steps [0]) === 'array') {
               if (next) {
                  Steps.push ([function (s) {
                     s.run.count.push (0);
                     k.return (s, true);
                  }]);
               }
               dale.stopOn (steps, false, function (v) {
                  if (parse (v) === false) return Steps = false;
               });
               if (next) {
                  Steps.push ([function (s) {
                     s.run.count.pop ();
                     k.return (s, true);
                  }]);
               }
               return;
            }
         }

         if (teishi.t (steps) === 'function') steps = [steps];

         var arg = 0;

         var tag  = teishi.t (steps [arg]) === 'string'   ? Steps.push ([k.print, steps [arg++]]) : false;
         var push = teishi.t (steps [arg]) === 'object'   ? Steps.push ([k.vpush, steps [arg++]]) : false;
         var term = teishi.t (steps [arg]) === 'function' ? Steps.push (steps.slice (arg)) : false;

         if (! term) {
            parse (steps [arg], tag);
            if (Steps === false) return;
         }
         if (push) Steps.push ([k.vpop, steps [arg - 1]]);
      }

      parse (steps);

      if (Steps === false) return k.return (s, false);

      s.run.steps = Steps.concat (s.run.steps);

      if (s.run.steps.length === 0) return log ('All actions succesfully executed!');

      var step = s.run.steps.shift ();

      var fun  = step.shift ();

      a.cond (s, [function (s) {
         var result = fun.apply (fun, [s].concat (step));
         if (teishi.stop (['value returned by kaboot function', result, ['array', 'boolean', 'undefined'], 'oneOf'])) {
            return k.return (s, false);
         }
         if (teishi.t (result) === 'array') return k.do (s, result);
         if (result === false)              return k.return (s, false);
      }], {
         false:   [k.return, false],
         default: [function (s) {
            k.do (s);
         }]
      });
   }

   // *** K.FIRE ***

   k.fire = function (actions) {
      if (teishi.stop ('k.fire', [
         ['actions', actions, ['object', 'array'], 'oneOf'],
         [teishi.t (actions) === 'object', ['action', process.argv [2], dale.keys (actions), 'oneOf', teishi.test.equal]]
      ])) return false;

      var action = teishi.t (actions) === 'array' ? actions : actions [process.argv [2]];

      var counter = 3;

      dale.do (action, function (v, k) {
         if (teishi.t (v) === 'string' && v.match (/^@.+$/)) action [k] = process.argv [counter++];
      });

      k.do (action);
   }

}) ();
