pkg_name="cron-superservice"
pkg_origin="emergence"
pkg_description="Superservice to provide cron execution within emergence environments"

pkg_upstream_url="https://github.com/EmergencePlatform/emergence"
pkg_license=("GPL-3.0-or-later")
pkg_maintainer="Chris Alfano <chris@jarv.us>"
pkg_build_deps=(
  core/jq-static
)
pkg_deps=(
  jarvus/emergence
)
pkg_svc_run="emergence superservice cron --hypervisor-port='{{cfg.hypervisor_port}}'"


# workflow overrides to extract
pkg_version() {
  jq -r .version "${PLAN_CONTEXT}/../../package.json"
}

do_before() {
  do_default_before
  update_pkg_version
}


# implement build workflow
do_build() {
  return 0
}

do_install() {
  return 0
}

do_strip() {
  return 0
}
