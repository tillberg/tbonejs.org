#!/usr/bin/env bash

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
        # echo "Using compile.py build method..."
        # Old build method, 0.5 and older
        OPTIMIZATION_LEVEL=ADVANCED_OPTIMIZATIONS ./compile.py > ../_cdn/tbone-$ref.min.js
        # compile with debug=true has the side effect of generating build/tbone.debug.js
        TBONE_DEBUG=TRUE OPTIMIZATION_LEVEL=WHITESPACE_ONLY ./compile.py > /dev/null
        cp build/tbone.debug.js ../_cdn/tbone-$ref.js
        cp build/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
    elif [ -f "gulpfile.js" ]; then
        # echo "Using gulp build method..."
        npm install
        gulp clean
        gulp
        cp dist/tbone.js ../_cdn/tbone-$ref.js
        cp dist/tbone.min.js ../_cdn/tbone-$ref.min.js
        cp dist/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
        if [ -f "dist/tbone_legacy.js" ]; then
            cp dist/tbone_legacy.js ../_cdn/tbone_legacy-$ref.js
            cp dist/tbone_legacy.min.js ../_cdn/tbone_legacy-$ref.min.js
            cp dist/tbone_legacy.min.js.map ../_cdn/tbone_legacy-$ref.min.js.map
        fi
        if [ -f "dist/tbone_core.js" ]; then
            cp dist/tbone_core.js ../_cdn/tbone_core-$ref.js
            cp dist/tbone_core.min.js ../_cdn/tbone_core-$ref.min.js
            cp dist/tbone_core.min.js.map ../_cdn/tbone_core-$ref.min.js.map
        fi
    else
        # echo "Using dist/ build..."
        cp dist/tbone.js ../_cdn/tbone-$ref.js
        cp dist/tbone.min.js ../_cdn/tbone-$ref.min.js
        cp dist/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
    fi
    sed "s/tbone.min.js.map/tbone-$ref.min.js.map/" "../_cdn/tbone-$ref.min.js" > .tmp
    mv .tmp "../_cdn/tbone-$ref.min.js"
    if [ -f "package.json" ]; then
        mkdir -p tbone/
        cp ../_cdn/tbone-$ref.js tbone/tbone.js
        cp package.json LICENSE README.md tbone/
        sed "s/build\/tbone\.debug\.js/tbone\.js/" tbone/package.json > .tmp
        mv .tmp tbone/package.json
        sed "s/dist\/tbone\.js/tbone\.js/" tbone/package.json > .tmp
        mv .tmp tbone/package.json
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
    gzip -9 $name.js
    mv $name.js.gz $name.js
done
cd ..

echo "Syncing to s3://tbonejscdn/..."

aws s3 sync \
    --cache-control "max-age=600" \
    --content-encoding "gzip" \
    --acl "public-read" \
    _cdn/ s3://tbonejscdn/
