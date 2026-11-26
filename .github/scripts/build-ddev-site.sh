#!/usr/bin/env bash
# Build the test site of this pack in a DDEV project: Kanboard's own image on the project's own MariaDB, its core only,
# an administrator of this site in the place of the one Kanboard's schema starts with (its password made for this site,
# never printed), the accounts of the suite in their roles of the project Webship site, and the sample content the
# features read (three tasks in the board's columns, one of them closed, a category, a tag, a comment, a subtask). It
# is what CI runs; on a machine with Docker, DDEV and 1 GB of free memory it makes the same site.
#
#   SITE_DIR=<folder>        where the project goes (default: ../kanboard-site beside the pack)
#   RELEASE=<X.Y.Z>          the release of the image (default: 1.2.58; the image is tagged v<release>)
#   COUNTS_ONLY=1            build nothing: print what the site holds, one count a line (a run must leave them)
#   TIDY_ONLY=1              build nothing: remove the tasks a stopped run left ("Webship test …" of the suite's
#                            accounts in Webship site), with what Kanboard keeps of them
#
# The site answers at https://kanboardsteps.ddev.site, the address cucumber.js opens by default. The site script
# (site/kanboard-site.php) is the one of the Webship Workspace's Kanboard plugin: it runs in Kanboard's container, on
# Kanboard's own models, and what it reads (the accounts, their passwords) comes on its input.
set -euo pipefail

PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${PACK}/../kanboard-site}"
NAME=kanboardsteps
RELEASE="${RELEASE:-1.2.58}"
IMAGE="docker.io/kanboard/kanboard:v${RELEASE}"
PASSWORD='dD.123123ddd'

# The site script, in Kanboard's container; its input reaches it.
site() {
  docker exec -i "ddev-${NAME}-kanboard" sh -c "cd /var/www/app && php /opt/webship/kanboard-site.php $*"
}

if [ "${COUNTS_ONLY:-}" = 1 ] ; then
  site counts < /dev/null | grep -E '^[a-z ]+: [0-9]+$'
  exit 0
fi
if [ "${TIDY_ONLY:-}" = 1 ] ; then
  site tidy < /dev/null
  exit 0
fi

secret() { head -c 200 /dev/urandom | base64 -w0 | tr -dc 'A-Za-z0-9' | head -c "$1" ; }

mkdir -p "${SITE_DIR}/kanboard" "${SITE_DIR}/.ddev"
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
cd "${SITE_DIR}"
# MariaDB 11.4, as the Webship Workspace builds Kanboard (Kanboard supports SQLite, MySQL, MariaDB and PostgreSQL).
ddev config --project-type=generic --project-name="${NAME}" --database=mariadb:11.4 < /dev/null

cp "${PACK}/site/kanboard-site.php" kanboard/
( umask 077
  cat > kanboard/env <<ENVEOF
KANBOARD_RELEASE=${RELEASE}
KANBOARD_URL=https://${NAME}.ddev.site
DB_DRIVER=mysql
DB_HOSTNAME=db
DB_PORT=3306
DB_USERNAME=db
DB_PASSWORD=db
DB_NAME=db
MAIL_TRANSPORT=smtp
MAIL_SMTP_HOSTNAME=web
MAIL_SMTP_PORT=1025
MAIL_FROM=kanboard@example.com
ENVEOF
)
printf 'KANBOARD_IMAGE=%s\n' "${IMAGE}" > .ddev/.env
cat > .ddev/docker-compose.kanboard.yaml <<'YAMLEOF'
# Kanboard: its own image on the project's MariaDB, at the project's address; the project's web container keeps the
# mail catcher. The same service as the Webship Workspace's Kanboard plugin.
services:
  web:
    environment:
      - HTTP_EXPOSE=8093:80,8025:8025
      - HTTPS_EXPOSE=8457:80,8026:8025
  kanboard:
    image: "${KANBOARD_IMAGE:-docker.io/kanboard/kanboard:v1.2.58}"
    container_name: ddev-${DDEV_SITENAME}-kanboard
    labels:
      com.ddev.site-name: ${DDEV_SITENAME}
      com.ddev.approot: ${DDEV_APPROOT}
    restart: "no"
    expose:
      - "80"
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - ${DDEV_APPROOT}/kanboard/env
    volumes:
      - ${DDEV_APPROOT}/kanboard:/opt/webship:ro
      - data:/var/www/app/data
      - plugins:/var/www/app/plugins
    environment:
      VIRTUAL_HOST: ${DDEV_HOSTNAME}
      HTTP_EXPOSE: "80:80"
      HTTPS_EXPOSE: "443:80"
volumes:
  data:
    name: ddev-${DDEV_SITENAME}-kanboard-data
  plugins:
    name: ddev-${DDEV_SITENAME}-kanboard-plugins
YAMLEOF

echo "Starting Kanboard ${RELEASE}."
ddev start -y < /dev/null
code=''
for attempt in $(seq 1 100) ; do
  code="$(ddev exec "curl -s -o /dev/null -m 15 -w '%{http_code}' http://kanboard/login" < /dev/null 2>/dev/null | tr -d '\r' | tail -1 || true)"
  [ "${code}" = 200 ] && break
  [ "${attempt}" = 100 ] && { echo "Kanboard did not answer (${code:-none})." ; ddev logs -s kanboard --tail 80 < /dev/null || true ; exit 1 ; }
  sleep 3
done

# An administrator of this site in the place of Kanboard's own (admin, password admin): its password made for this
# site, never printed. Then the accounts of the suite and the sample content: the project Webship site, managed by
# owner, with member (a member) and reader (a viewer); stranger not in it.
ADMIN_PASSWORD="Aa1.$(secret 20)" python3 -c 'import base64, json, os; print(base64.b64encode(json.dumps({"login": "webmaster", "mail": "webmaster@example.com", "password": os.environ["ADMIN_PASSWORD"], "name": "Webmaster Workspace"}).encode()).decode())' | site install
python3 - "${PASSWORD}" <<'PYEOF' | site accounts
import base64, json, sys
password = sys.argv[1]
rows = [{'login': login, 'mail': login + '@example.com', 'password': password, 'name': login.capitalize() + ' Test', 'role': role, 'action': ''}
        for login, role in [('owner', 'owner'), ('member', 'member'), ('reader', 'reader'), ('stranger', '')]]
print(base64.b64encode(json.dumps({'rows': rows}).encode()).decode())
PYEOF
site content list < /dev/null

echo "The site: https://${NAME}.ddev.site (Kanboard $(site version < /dev/null | sed -n 's/^VERSION //p'))"
[ -n "${GITHUB_ENV:-}" ] && echo "LAUNCH_URL=https://${NAME}.ddev.site" >> "${GITHUB_ENV}"
exit 0
