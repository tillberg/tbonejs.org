#!/usr/bin/env bash

: ${TBONE_S3?"Set TBONE_S3 to TBone's S3 bucket"}
: ${TBONECDN_S3?"Set TBONECDN_S3 to TBone's CDN S3 bucket"}

set -e
rm -rf _sitegen/
rm -rf _cdn/
mkdir -p _sitegen/
mkdir -p _cdn/

echo Fetching TBone...

if [ ! -d "_tbone" ]; then
    git clone git@github.com:appneta/tbone.git _tbone
fi
cd _tbone
git fetch origin
git checkout master
git reset --hard origin/master
for ref in `git ls-remote origin | grep ".*refs/[^p]" | sed "s/.*\///"`; do
    echo "Building tbone $ref"
    git checkout -q $ref
    OPTIMIZATION_LEVEL=ADVANCED_OPTIMIZATIONS ./compile.py > ../_cdn/tbone-$ref.min.js
    # compile with debug=true has the side effect of generating build/tbone.debug.js
    TBONE_DEBUG=TRUE OPTIMIZATION_LEVEL=WHITESPACE_ONLY ./compile.py > /dev/null
    cp build/tbone.debug.js ../_cdn/tbone-$ref.js
    cp build/tbone.min.js.map ../_cdn/tbone-$ref.min.js.map
    sed -i s/tbone.min.js.map/tbone-$ref.min.js.map/ ../_cdn/tbone-$ref.min.js
    if [ -f "package.json" ]; then
        mkdir -p tbone/
        cp build/tbone.debug.js tbone/tbone.js
        cp package.json LICENSE README.md tbone/
        sed -i "s/build\/tbone\.debug\.js/tbone\.js/" tbone/package.json
        tar czf ../_cdn/tbone-$ref.tgz tbone/
        rm -rf tbone/
    fi
done
git checkout -q master

cd src/
../../node_modules/docco-husky/bin/generate ./
rm -rf ../../docs/
mv docs ../../
cd ..

cd test/
npm install
./gen-templates.js
rm -rf ../../test/
cp -R static/ ../../test/
sed -i "s/tbone'/http:\/\/cdn.tbonejs.org\/tbone-master'/g" ../../test/*.html
cd ..

cd ..

pygmentize -S default -f html > css/pygments.less
jekyll build --destination ./_sitegen

# Gzip html/js/css
find _sitegen/ -iname '*.html' -exec gzip -n {} +
find _sitegen/ -iname '*.js' -exec gzip -n {} +
find _sitegen/ -iname '*.css' -exec gzip -n {} +
find _sitegen/ -iname '*.gz' -exec rename 's/\.gz$//i' {} +

cd _cdn
for name in `ls *.js | sed s/\.js//`; do
    # for the non-gzip-encoded version to work right,
    # we shouldn't set Content-encoding: gzip on them.
    # cp $name.js $name.raw.js
    gzip $name.js
    mv $name.js.gz $name.js
done
cd ..

cd _sitegen/
# Make no-extension copies of all HTML files
mkdir tmp
cp *.html tmp/
rename 's/\.html//' *.html
mv tmp/* ./
rmdir tmp/
cd ..

echo Syncing to S3...

s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=300' --add-header 'Content-Encoding:gzip' _sitegen/ s3://$TBONE_S3/ --exclude '*.*' --include '*.html' --include '*.js' --include '*.css'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=300' _sitegen/ s3://$TBONE_S3/ --exclude '*.html' --exclude '*.js' --exclude '*.css'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude '*.*' --include 'tbone-master.*'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude 'tbone-master.*'
