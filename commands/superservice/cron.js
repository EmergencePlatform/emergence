exports.command = 'cron'
exports.desc = 'Run the cron superservice'
exports.builder = {
  hypervisorPort: {
    describe: 'TCP port to connect to emergence hypervisor on',
    type: 'number'
    // default: 9083
  }
}

exports.handler = async function superserviceCron ({ hypervisorPort }) {
  const logger = require('logger').getScopedLogger(module)
  const cron = require('node-cron')

  // TODO: bind to hypervisor
  logger.info({ hypervisorPort }, 'connecting to emergence hypervisor')

  cron.schedule('* * * * *', () => {
    logger.info('booooop')
  })
}
