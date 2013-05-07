#!/usr/bin/env bash

# sudo gem install jekyll
# sudo gem install jekyll-less
# sudo gem install therubyracer
# sudo gem install RedCloth
# sudo apt-get install python-pygments
# npm install docco
# git clone git://github.com/tillberg/pygments.rb.git
# cd pygments.rb
# sudo gem build pygments.rb.gemspec
# sudo gem install --local pygments.rb-0.3.7.gem
# cd ..

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
    echo "Building tbone $tag"
    git checkout -q $ref
    OPTIMIZATION_LEVEL=ADVANCED_OPTIMIZATIONS ./compile.py > ../_cdn/tbone-$tag.min.js
    # XXX compile with debug=true has the side effect of generating build/tbone.debug.js
    TBONE_DEBUG=TRUE OPTIMIZATION_LEVEL=WHITESPACE_ONLY ./compile.py > /dev/null
    cp build/tbone.debug.js ../_cdn/tbone-$tag.js
    cp build/tbone.min.js.map ../_cdn/tbone-$tag.min.js.map
    sed -i s/tbone.min.js.map/tbone-$tag.min.js.map/ ../_cdn/tbone-$tag.min.js
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
jekyll --no-auto --no-server ./_sitegen

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

s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' --add-header 'Content-Encoding:gzip' _sitegen/ s3://$TBONE_S3/ --exclude '*.*' --include '*.html' --include '*.js' --include '*.css'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=600' _sitegen/ s3://$TBONE_S3/ --exclude '*.html' --exclude '*.js' --exclude '*.css'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=3600' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude '*.*' --include 'tbone-master.*'
s3cmd sync --progress --guess-mime-type --no-preserve --acl-public --add-header 'Cache-Control: max-age=86400' --add-header 'Content-Encoding:gzip' _cdn/ s3://$TBONECDN_S3/ --exclude 'tbone-master.*'
