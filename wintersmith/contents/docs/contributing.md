---
title: Contributing
---

Bugfix?  Cool new feature?  Alternate style?  Send us a pull request!

Below are some instructions for developing with TBone:

1. Make sure [Node.js](http://nodejs.org/) is installed.

1. Clone TBone

    ```bash
    $ git clone git@github.com:appneta/tbone.git
    $ cd tbone
    ```

1. We use [gulp](http://gulpjs.com/) to develop, test, and compile TBone
   into `/dist`:

    ```bash
    $ npm install -g gulp
    $ npm install
    $ gulp
    ```

1. Create a feature branch and make some code changes

1. Add unit tests (in `/test`) and ensure your tests pass by running
   `gulp`.

1. Send us a detailed pull request explaining your changes.
