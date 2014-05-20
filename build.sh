#!/usr/bin/env bash

: ${TBONE_S3?"Set TBONE_S3 to TBone's S3 bucket"}

set -e
rm -rf _sitegen/
rm -rf _cdn/

echo Fetching TBone...

if [ ! -d "_tbone" ]; then
    git clone git@github.com:appneta/tbone.git _tbone
fi
cd _tbone
git fetch origin
git checkout master
git reset --hard origin/master

../node_modules/docco-husky/bin/generate src/
rm -rf ../docs/
mv docs ../

grunt templates
cd test/
npm install
rm -rf ../../test/
cp -R ./ ../../test/
sed -i "s/dist\/tbone'/http:\/\/cdn.tbonejs.org\/tbone-master'/g" ../../test/*.html
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

cd _sitegen/
# Make no-extension copies of all HTML files
mkdir tmp
cp *.html tmp/
rename 's/\.html//' *.html
mv tmp/* ./
rmdir tmp/
cd ..

echo "Syncing to s3://$TBONE_S3/..."

aws s3 sync \
    --cache-control "max-age=60" \
    --content-encoding "gzip" \
    --acl "public-read" \
    _sitegen/ s3://tbonejs/ \
    --exclude '*.*' --include '*.html' --include '*.js' --include '*.css'

aws s3 sync \
    --cache-control "max-age=60" \
    --acl "public-read" \
    _sitegen/ s3://tbonejs/ \
    --exclude '*.html' --exclude '*.js' --exclude '*.css'
