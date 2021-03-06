var aws = require('aws-sdk')
var parallel = require('run-parallel')
var mime = require('mime-types')
var glob = require('glob')
var chalk = require('chalk')
var path = require('path')
var fs = require('fs')

module.exports = function factory(bucket, callback) {

  var s3 = new aws.S3({region: process.env.AWS_REGION})

  console.log(`${chalk.green('✓ Success!')} ${chalk.green.dim('Deployed public')}`)

  var s3Path = path.join(process.cwd(), 'public', '/**/*')
  glob(s3Path, function _glob(err, files) {
    if (err) console.log(err)
    var fns = files.map(file=> {
      return function _maybeUpload(callback) {
        let stats = fs.lstatSync(file)
        if (stats.isDirectory()) {
          callback() // noop
        }
        else if (stats.isFile()) {
          function getContentType(file) {
            var bits = file.split('.')
            var last = bits[bits.length - 1]
            return mime.lookup(last)
          }
          s3.putObject({
            ACL: 'public-read',
            Bucket: bucket,
            Key: file.replace(path.join(process.cwd(), 'public'), '').substr(1),
            Body: fs.readFileSync(file),
            ContentType: getContentType(file),
          },
          function _putObj(err) {
            if (err) {
              console.log(err)
              callback()
            }
            else {
              var before = file.replace(process.cwd(), '').substr(1)
              var after = before.replace('public', '')
              var domain = `https://s3.${process.env.AWS_REGION}.amazonaws.com/`
              let last = `${domain}${bucket}${after}`
              console.log(chalk.underline.cyan(last))
              console.log(chalk.cyan.dim('-'.padEnd(last.length, '-')))
              console.log(' ') //spacer.gif
              callback()
            }
          })
        }
        else {
          callback()
        }
      }
    })
    parallel(fns, callback)
  })
}
