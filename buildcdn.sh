#!/usr/bin/env bash

: ${TBONECDN_S3?"Set TBONECDN_S3 to TBone's CDN S3 bucket"}

set -e
rm -rf _cdn/
mkdir -p _cdn/

echo Fetching TBone...

if [ ! -d "_tbone" ]; then
    git clone git@github.com:appneta/tbone.git _tbone
fi
cd _tbone
git fetch origin
git checkout master
git reset --hard origin/master
for ref in `git ls-remote origin | grep ".*refs/[^p]" | sed "s/.*\///" | sort -r`; do
    echo "Building tbone $ref"
    git checkout -q $ref
    if [ -f "compile.py" ]; then
        # Old build method, 0.5 and older
        OPTIMIZATION_LEVEL=ADVANCED_OPTIMIZATIONS ./compile.py > ../_cdn/tbone-$ref.min.js
        # compile with debug=true has the side effect of generating build/tbone.debug.js
        TBONE_DEBUG=TRUE OPTIMIZATION_LEVEL=WHITESPACE_ONLY ./compile.py > /dev/null
        cp build/tbone.debug.js ../_cdn/tbone-$ref.js
        cp build/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
    else
        cp dist/tbone.js ../_cdn/tbone-$ref.js
        cp dist/tbone.min.js ../_cdn/tbone-$ref.min.js
        cp dist/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
    fi
    sed -i s/tbone.min.js.map/tbone-$ref.min.js.map/ ../_cdn/tbone-$ref.min.js
    if [ -f "package.json" ]; then
        mkdir -p tbone/
        cp ../_cdn/tbone-$ref.js tbone/tbone.js
        cp package.json LICENSE README.md tbone/
        sed -i "s/build\/tbone\.debug\.js/tbone\.js/" tbone/package.json
        sed -i "s/dist\/tbone\.js/tbone\.js/" tbone/package.json
        tar czf ../_cdn/tbone-$ref.tgz tbone/
        rm -rf tbone/
    fi
done
git checkout -q master
cd ..

cd _cdn
for name in `ls *.js | sed s/\.js//`; do
    # for the non-gzip-encoded version to work right,
    # we shouldn't set Content-encoding: gzip on them.
    # cp $name.js $name.raw.js
    gzip $name.js
    mv $name.js.gz $name.js
done
cd ..

echo "Syncing to s3://$TBONECDN_S3/..."

s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude '*.*' --include 'tbone-master.*'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude 'tbone-master.*'
