exports.command = 'superservice <command>'
exports.desc = 'Run superservices'
exports.builder = yargs => yargs.commandDir('superservice', { exclude: /\.test\.js$/ })
