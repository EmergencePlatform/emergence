exports.command = 'hypervisor <command>'
exports.desc = 'Manage hypervisor'
exports.builder = yargs => yargs.commandDir('hypervisor', { exclude: /\.test\.js$/ })
