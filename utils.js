const R = require('ramda')
const assert = require('assert')

const replace = module.exports.replace = R.invoker(2, 'replace')
assert.equal(replace(',', ' ')('a,b'), 'a b')
assert.equal(replace(',')(' ')('a,b'), 'a b')