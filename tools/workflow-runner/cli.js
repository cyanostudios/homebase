#!/usr/bin/env node
'use strict';

/**
 * CLI for Workflow Runner.
 *
 * Usage:
 *   node tools/workflow-runner/cli.js start --id <id> --type <WorkflowType> [--gate-na Grind3] [--dod "item"]
 *   node tools/workflow-runner/cli.js handover --id <id> --file <path> | --stdin
 *   node tools/workflow-runner/cli.js resume --id <id> --decision "<text>" [--file <handover>]
 *   node tools/workflow-runner/cli.js show --id <id>
 *   node tools/workflow-runner/cli.js cancel --id <id> [--reason "<text>"]
 */

const fs = require('fs');
const path = require('path');
const { WorkflowRunner } = require('./runner');

function usage() {
  console.error(`Workflow Runner CLI

Commands:
  start    --id <InstanceId> --type <WorkflowType> [--gate-na Grind2,Grind3] [--dod item]* [--brief text]
  handover --id <InstanceId> (--file <path> | --stdin)
  resume   --id <InstanceId> --decision <text> [--file <handover to re-eval>]
  show     --id <InstanceId>
  cancel   --id <InstanceId> [--reason <text>]

Emissions include Activate: (manual @role fallback) and Delegate: (Pivot 1 Task delegation).
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        if (key === 'dod') {
          args.dod = args.dod || [];
          args.dod.push(next);
        } else {
          args[key] = next;
        }
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cmd = args._[0];

  if (!cmd || args.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  const runner = new WorkflowRunner({
    storeRoot: args['store-root'] ? path.resolve(args['store-root']) : undefined,
  });

  try {
    if (cmd === 'start') {
      const gateNA = args['gate-na']
        ? String(args['gate-na'])
            .split(/[,]/)
            .map((s) => s.trim())
        : [];
      const result = runner.start({
        InstanceId: args.id,
        WorkflowType: args.type,
        GateNA: gateNA,
        DoD: args.dod || [],
        brief: args.brief,
      });
      printResult(result);
      return;
    }

    if (cmd === 'handover') {
      const raw = readInput(args);
      const result = runner.onHandover(args.id, raw);
      printResult(result);
      return;
    }

    if (cmd === 'resume') {
      const opts = {};
      if (args.file || args.stdin) {
        opts.resumeHandover = readInput(args);
      }
      const result = runner.resume(args.id, args.decision || '', opts);
      printResult(result);
      return;
    }

    if (cmd === 'show') {
      const instance = runner.store.load(args.id);
      if (!instance) {
        console.error(`Instance not found: ${args.id}`);
        process.exit(1);
      }
      console.log(JSON.stringify(instance, null, 2));
      return;
    }

    if (cmd === 'cancel') {
      const result = runner.cancel(args.id, args.reason);
      console.log(JSON.stringify(result.instance, null, 2));
      return;
    }

    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

function readInput(args) {
  if (args.stdin) {
    return fs.readFileSync(0, 'utf8');
  }
  if (args.file) {
    return fs.readFileSync(path.resolve(args.file), 'utf8');
  }
  throw new Error('Provide --file <path> or --stdin');
}

function printResult(result) {
  if (result.emission && result.emission.text) {
    console.log(result.emission.text);
    console.log('');
  }
  console.log(
    JSON.stringify(
      {
        InstanceId: result.instance.InstanceId,
        EngineState: result.instance.EngineState,
        ActiveRole: result.instance.ActiveRole,
        LastCommand: result.instance.LastCommand,
        command: result.emission && result.emission.command,
        Role: result.emission && result.emission.Role,
        idempotent: result.idempotent || false,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
