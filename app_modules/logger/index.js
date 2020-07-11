/*
 * WARNING: This file runs *before* .env files are parsed. process.env contains only "real" environment variables
 */

// Forwards debug() calls to pino to avoid console logging in production
const pinoDebug = require('pino-debug')

// @ts-ignore
// eslint-disable-next-line no-unused-vars
const path = require('path')

const DEV = (process.env.NODE_ENV === 'development')

const prettyPrintOptions = {
  suppressFlushSyncWarning: true,
  colorize: true
}

// @ts-ignore
const DEBUGGER_ATTACHED = typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '))
const DEBUG_WILDCARD = process.env.DEBUG === '*'

const pinoOptions = {
  level: process.env.PINO_LEVEL === 'trace' ? 'trace' : DEBUGGER_ATTACHED || DEBUG_WILDCARD ? 'debug' : process.env.PINO_LEVEL || 'info',
  prettyPrint: DEV ? prettyPrintOptions : false
}

const pino = require('pino')

// In development mode, populate each log entry with "caller" information (line-number and file)
// ex: "caller":"Application.use (/full-path-to/nodejs-api-template/node_modules/koa/lib/application.js:128:5)"
const logger = DEV ? require('pino-caller')(pino(pinoOptions)) : pino(pinoOptions)

if (DEBUGGER_ATTACHED) logger.info('Debugger detected, forcing log-level to: debug')
if (DEBUG_WILDCARD) logger.info('DEBUG=*, forcing log-level to: debug')

logger.on('level-change', (level, val, previousLevel, previousVal) => {
  if (val === previousVal) return
  logger.debug({ level, val, previousLevel, previousVal }, `Log level changed to: ${level} (${val})`)
})

// The default log level to use for unknown namespaces, this should prevent developers from never seeing their output
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'trace' : 'info'

const pinoDebugMap = {
  // These should be in the context of our application and always relevant
  'koa:application': 'info',
  node_app: 'info',

  'koa-session': 'info',

  // Probably not generally useful
  'koa-session:context': 'trace',
  'json-schema-ref-parser': 'trace',

  // Useful for troubleshooting avvio/routing ordering issues (should be uncommon)
  avvio: 'trace',
  'koa-router': 'trace',

  // Behavior for namespaces that are not classified above:
  '*': defaultLogLevel
}

const pinoDebugOptions = {
  auto: true, // default
  map: pinoDebugMap
}

pinoDebug(logger, pinoDebugOptions)

const debug = require('debug')('node_app')

function pathToNamespace (modulePath) {
  const projectPath = path.join(__dirname, '../..')
  const moduleRelativePath = path.relative(projectPath, modulePath)
  return moduleRelativePath.split(/[\W]/).slice(1, -1).join(':')
}

function getScopedDebugger (module) {
  const filename = module.filename
  const ns = pathToNamespace(filename)
  if (!pinoDebugMap[ns]) {
    // Remind developers to add new debug namespaces to the pinoDebugMap
    logger.warn(`debug namespace: ${ns} is missing from pinoDebugMap, defaulting to: ${defaultLogLevel}`)
  }
  return require('debug')(ns)
}

function getScopedLogger (module) {
  return logger.child({
    ns: pathToNamespace(module.filename),
    src: module.filename
  })
}

module.exports = {
  logger,
  // During catastrophic failures, use finalLogger to synchronously flush on every write
  finalLogger: pino.final(logger),
  debug,
  getScopedDebugger,
  getScopedLogger
}
