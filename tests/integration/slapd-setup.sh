#!/usr/bin/env bash
# Menjalankan OpenLDAP (slapd) sementara di port 3899 untuk uji integrasi login LDAP.
#   apt-get install -y slapd ldap-utils   (sekali)
#   bash tests/integration/slapd-setup.sh
set -euo pipefail
DIR="${SLAPD_DIR:-/tmp/epr-slapd}"
pkill -f "slapd.*$DIR" 2>/dev/null || true
rm -rf "$DIR" && mkdir -p "$DIR/db"
ROOTPW=$(slappasswd -s adminpass)
cat > "$DIR/slapd.conf" <<CONF
include /etc/ldap/schema/core.schema
include /etc/ldap/schema/cosine.schema
include /etc/ldap/schema/inetorgperson.schema
pidfile $DIR/slapd.pid
modulepath /usr/lib/ldap
moduleload back_mdb
database mdb
suffix "dc=contoh,dc=local"
rootdn "cn=admin,dc=contoh,dc=local"
rootpw $ROOTPW
directory $DIR/db
access to attrs=userPassword by anonymous auth by self write by * none
access to * by users read by * none
CONF
slapd -f "$DIR/slapd.conf" -h "ldap://127.0.0.1:3899/"
sleep 1
ldapadd -x -H ldap://127.0.0.1:3899 -D "cn=admin,dc=contoh,dc=local" -w adminpass > /dev/null <<LDIF
dn: dc=contoh,dc=local
objectClass: dcObject
objectClass: organization
o: Contoh
dc: contoh

dn: ou=karyawan,dc=contoh,dc=local
objectClass: organizationalUnit
ou: karyawan

dn: ou=service,dc=contoh,dc=local
objectClass: organizationalUnit
ou: service

dn: uid=300001,ou=karyawan,dc=contoh,dc=local
objectClass: inetOrgPerson
uid: 300001
cn: Rudi Hartono
sn: Hartono
employeeNumber: 300001
userPassword: $(slappasswd -s Rahasia123)

dn: uid=maya.putri,ou=karyawan,dc=contoh,dc=local
objectClass: inetOrgPerson
uid: maya.putri
cn: Maya Putri
sn: Putri
employeeNumber: 300002
userPassword: $(slappasswd -s Rahasia456)

dn: cn=svc-epr,ou=service,dc=contoh,dc=local
objectClass: inetOrgPerson
cn: svc-epr
sn: service
userPassword: $(slappasswd -s svcpass)
LDIF
echo "slapd berjalan di ldap://127.0.0.1:3899 (data: $DIR)"
