#!/usr/bin/env node

// env and then logger must be loaded first
require('../app_modules/env')
const { logger } = require('../app_modules/logger')

// Allows app_modules to be required like node_modules without ../../.. mess
require('app-module-path').addPath(`${__dirname}/../app_modules`)

// route command line
// eslint-disable-next-line no-unused-expressions
require('yargs')
  .version(require('../package.json').version)
  .option('d', {
    alias: 'debug',
    type: 'boolean',
    default: false,
    global: true
  })
  .option('q', {
    alias: 'quiet',
    type: 'boolean',
    default: false,
    global: true
  })
  .check(function (argv) {
    if (argv.debug) {
      logger.level = 'debug'
    } else if (argv.quiet) {
      logger.level = 'error'
    }

    return true
  })
  .commandDir('../commands', { exclude: /\.test\.js$/ })
  .demandCommand()
  .showHelpOnFail(false, 'Specify --help for available options')
  .fail((msg, err) => {
    console.error(msg || err.message)

    if (err) {
      console.error(err.stack)
    }

    process.exit(1)
  })
  .strict()
  .help()
  .argv
