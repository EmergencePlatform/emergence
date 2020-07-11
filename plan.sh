pkg_name="emergence"
pkg_origin="jarvus"
pkg_description="Emergence is an SDK for online community operating environments"
pkg_upstream_url="https://github.com/EmergencePlatform/emergence"
pkg_license=("GPL-3.0-or-later")
pkg_maintainer="Chris Alfano <chris@jarv.us>"
pkg_build_deps=(
  core/jq-static
  jarvus/hologit
)
pkg_deps=(
  core/node
)
pkg_bin_dirs=(bin)


# workflow overrides to extract
pkg_version() {
  jq -r .version "${PLAN_CONTEXT}/package.json"
}

do_before() {
  do_default_before
  update_pkg_version
}


# implement build workflow
do_setup_environment() {
 set_buildtime_env GIT_DIR "$(cd ${PLAN_CONTEXT}; git rev-parse --absolute-git-dir)"
}

do_build() {
  pushd "${PLAN_CONTEXT}" > /dev/null

  build_line "Projecting cli holobranch"
  build_tree_hash="$(git holo project --working cli)"

  popd > /dev/null
}

do_install() {
  pushd "${pkg_prefix}" > /dev/null

  build_line "Installing cli holobranch"
  git archive --format=tar "${build_tree_hash}" | tar xf -

  build_line "Generating binstub"
  mv -v "bin/" "node-bin/"
  mkdir -v "bin/"
  sed -e "s#\#\!/usr/bin/env node#\#\!$(pkg_path_for node)/bin/node#" --in-place "node-bin/cli.js"
  cat > "bin/emergence" <<- EOM
#!/bin/sh
export PATH="\${PATH}:${pkg_prefix}/node_modules/.bin:$(_assemble_runtime_path)"
exec ${pkg_prefix}/node-bin/cli.js \$@
EOM
  chmod +x "bin/emergence"

  popd > /dev/null
}

do_strip() {
  return 0
}
