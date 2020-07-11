const debugDotEnv = (process.env.DEBUG && (process.env.DEBUG === '*' || process.env.DEBUG.includes('dotenv')))
const traceEnv = (process.env.TRACE && (process.env.TRACE === '*' || process.env.TRACE.includes('env'))) ? {} : false
// this approximates: require('debug')('dotenv').enabled without requiring debug (which dotenv doesn't use)

const YAML = require('yaml')
const envSchema = require('env-schema')

// HACK: dotEnv likes to spam the console with debug logs, this will intercept/accumulate them and log them with debug
const ogConsoleLog = console.log

if (traceEnv) {
  traceEnv.ogProcessEnv = JSON.parse(JSON.stringify(process.env))
}

if (debugDotEnv) {
  const debugDotEnvLines = []
  console.log = (line) => debugDotEnvLines.push(line.slice(16))
  const logDeferredLines = () => {
    const debug = require('debug')('dotenv')
    // proper usage of .enable to make up for earlier approximation
    if (debug.enabled) debugDotEnvLines.forEach(debug)
  }
  // defer until after logger is run so that output will go to pino-debug
  process.nextTick(logDeferredLines)
}

// Keep track of which keys come from a variable source (rather than file) so we can build better errors if validation fails
const ogEnvKeys = Object.keys(process.env)

try {
  const schemaPath = require('path').join(__dirname, '../../env.yaml')
  const schema = YAML.parse(require('fs').readFileSync(schemaPath).toString('utf8'), { prettyErrors: true })

  const config = module.exports = envSchema({
    schema,
    data: process.env,
    dotenv: { debug: debugDotEnv }
  })

  // Populate process.env with missing values and coerce present strings to proper types
  Object.keys(config)
    .filter(key => process.env[key] === undefined || (config[key] == process.env[key] && config[key] !== process.env[key])) // eslint-disable-line eqeqeq
    .forEach(key => {
      process.env[key] = config[key]
    })

  // Enforce forbidProductionDefault: true
  if (process.env.NODE_ENV !== 'development') {
    const forbiddenDefaults = Object.keys(schema.properties)
      .filter(key => schema.properties[key].forbidProductionDefault && process.env[key] == schema.properties[key].default) // eslint-disable-line eqeqeq
      .map(key => ({
        dataPath: `/${key}`,
        message: 'may not use default in production'
      }))

    if (forbiddenDefaults.length > 0) throw { errors: forbiddenDefaults } // eslint-disable-line no-throw-literal
  }
} catch (e) {
  const { errors } = e

  // Parsing error
  if (!errors) {
    console.error('Error parsing env-schema file (.env.yaml):')
    console.error(e)
    process.exit(1)
  }

  // Schema errors
  console.error(`ERROR: Found ${errors.length} invalid environment variable(s):`)

  errors.forEach(error => {
    console.error() // separator
    const key = error.dataPath.slice(1)
    const keySource = ogEnvKeys.includes(key) ? 'variable' : 'file'

    if (key) console.error(`${key}=${process.env[key]}`)

    if (error.params && error.params.allowedValues) {
      console.error('> ', error.message, ':', error.params.allowedValues)
    } else {
      console.error('> ', error.message)
    }

    if (key) console.error(`source: ${keySource}`)
    console.error() // separator
  })

  process.exit(1)
}

// Restore original console.log from earlier hack
if (debugDotEnv) console.log = ogConsoleLog

if (traceEnv) {
  traceEnv.effectiveEnv = JSON.parse(JSON.stringify(process.env))
  traceEnv.processEnvGets = {}
  traceEnv.processEnvSets = {}
  traceEnv.processEnvGetValues = {}
  traceEnv.processEnvSetValues = {}

  const { processEnvGets, processEnvGetValues, processEnvSets, processEnvSetValues } = traceEnv

  // These values are read by node.js core, rather than our code
  const nodeEnvKeys = {
    FORCE_COLOR: 1,
    NODE_DISABLE_COLORS: 1,
    NO_COLOR: 1,
    TERM: 1,
    TMUX: 1,
    CI: 1,
    TERM_PROGRAM: 1,
    COLORTERM: 1,
    NODE_V8_COVERAGE: 1,
    hasOwnProperty: 1
  }

  // eslint-disable-next-line no-inner-declarations
  function traceMethodCalls (obj) {
    const handler = {
      get (target, propKey, receiver) {
        const val = Reflect.get(target, propKey, receiver)
        const callSite = new Error(propKey).stack.toString().split('\n')[2]
        if (!nodeEnvKeys[propKey]) {
          if (processEnvGets[propKey] === undefined) processEnvGets[propKey] = []
          if (processEnvGetValues[propKey] === undefined) processEnvGetValues[propKey] = []
          if (!callSite.includes(__filename)) {
            processEnvGets[propKey].push(callSite)
            processEnvGetValues[propKey].push(val)
          }
        }

        return val
      },
      set (obj, prop, val) {
        const callSite = new Error(prop).stack.toString().split('\n')[2]
        if (processEnvSets[prop] === undefined) processEnvSets[prop] = []
        if (processEnvSetValues[prop] === undefined) processEnvSetValues[prop] = []
        processEnvSets[prop].push(callSite)
        processEnvSetValues[prop].push(val)
        obj[prop] = val
        return true
      }
    }
    return new Proxy(obj, handler)
  }

  process.env = traceMethodCalls(process.env)

  process.nextTick(() => {
    // TODO: turn this into a snapshot in jest tests
    const { processEnvGets, processEnvGetValues, processEnvSetValues } = traceEnv

    // These are keys that are set in the environment but never read
    const unreadKeys = Object.keys(traceEnv.effectiveEnv).filter(k => !processEnvGets[k] || processEnvGets[k].length === 0)
    // DISCUSS: we can use this to filter pretty-print output and diagnostic reports to exclude noise

    const changedKeys = Object.keys(traceEnv.effectiveEnv).filter(k => processEnvSetValues[k] && !processEnvSetValues[k].every((val, i, arr) => val === arr[0]))
    // These are keys that have its value changed after initialization (setting the same value multiple times will not appear here)

    const dirtyReads = Object.keys(traceEnv.effectiveEnv).filter(k => processEnvGetValues[k] && !processEnvGetValues[k].every((val, i, arr) => val === arr[0]))
    // These are keys that have had multiple values read

    const typeChanges = Object.keys(traceEnv.effectiveEnv).filter(k => processEnvGetValues[k] && !processEnvGetValues[k].every((val, i, arr) => val == arr[0] && val !== arr[0])) // eslint-disable-line eqeqeq
    // These are keys that have had their types coerced between reads

    const typeChanged = Object.keys(traceEnv.effectiveEnv).filter(k => processEnvSetValues[k] && !processEnvSetValues[k].every((val, i, arr) => val == arr[0] && val !== arr[0])) // eslint-disable-line eqeqeq
    // These are keys that have had their types coerced between reads

    console.log('unused:', unreadKeys)
    // If something is in our .env.example (or env-schema) and it is not used, it could be conditionally used, or an indication of an error

    console.log('changed:', changedKeys)
    console.log('dirtyReads', dirtyReads)
    console.log('typeChanges', typeChanges)
    console.log('typeChanged', typeChanged)
  })
}
