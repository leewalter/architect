var waterfall = require('run-waterfall')
var aws = require('aws-sdk')
var getAttributeDefinitions = require('./_get-attribute-definitions')
var print = require('../../_print')
var getGsiName = require('./_get-gsi-name')
var getGlobalSecondaryIndexes = require('./_get-global-secondary-indexes')

module.exports = function _createTable(name, attr, callback) {

  var dynamo = new aws.DynamoDB({region: process.env.AWS_REGION})
  var gsiName = `${name}-${getGsiName(attr)}`

  waterfall([
    function _maybeWaitForCreateComplete(callback) {
      // poll for ready table
      check()

      function check() {
        let timeout = 2010
        dynamo.describeTable({
          TableName: name
        },
        function _tbl(err, result) {
          if (err) {
            callback(err)
          }
          else if (result.Table.TableStatus === 'ACTIVE') {
            // cool the table is active but does it have the index?
            if (result.Table.GlobalSecondaryIndexes) {
              var found = result.Table.GlobalSecondaryIndexes.find(idx=> idx.IndexName === gsiName)
              // if they just deleted wait a few secs to create
              if (found && found.IndexStatus === 'DELETING') {
                setTimeout(check, timeout)
              }
              else if (found) {
                // creating/updating/active then skip
                print.skip('@table', gsiName)
                callback('skipping')
              }
              else {
                // index not found continue
                callback()
              }
            }
            else {
              // no indexes exist so continue
              callback()
            }
          }
          else {
            setTimeout(check, timeout)
          }
        })
      }
    },
    function _updateTableIndex(callback) {
      dynamo.updateTable({
        TableName: name,
        AttributeDefinitions: getAttributeDefinitions(attr),
        GlobalSecondaryIndexUpdates: getGlobalSecondaryIndexes(gsiName, attr),
      }, callback)
    }
  ],
  function _updated(err) {
    if (err && err != 'skipping') {
      console.log(err)
    }
    callback()
  })
}
