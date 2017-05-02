/*
 * Runs sentiment analysis on exported Signal messages located on the file system.
 * The export format should be the default XML "plaintext backup."
 *
 * BE CAREFUL WITH YOUR PLAINTEXT BACKUPS.
 *
 * This project was created partially to experiment with the Ramda library and point-free
 * style, so some functions are more verbose than they otherwise could be.
 */

const yargs = require('yargs')
const xml = require('xml2js')
const fs = require('fs')
const R = require('ramda')
const sentiment = require('sentiment')

const assert = require('assert')

const Promise = require('bluebird')
Promise.promisifyAll(fs)
Promise.promisifyAll(xml)

const pickMessages = R.compose(
  R.map(R.path([ '$' ])),
  R.path([ 'smses', 'sms' ])
)
assert.deepEqual(
  pickMessages({
    smses: {
      sms: [ { $: 'foo' } ]
    }
  }),
  [ 'foo' ]
)

// Ordinary non-point-free
// const getNumberFilter = number => R.filter(obj => obj.address === number)
//
// Point free version
const getNumberFilter = R.compose(
  R.filter,
  R.apply(R.pipe),
  R.concat([ R.path([ 'address' ])]),
  R.of,
  R.equals
)
assert.deepEqual(
  getNumberFilter('foo')([
    { address: 'foo' },
    { address: 'bar' },
  ]),
  [{
    address: 'foo'
  }]
)

const sortByDate = R.sort(
  R.compose(
    R.apply(R.subtract),
    R.unapply(R.map(R.path([ 'date' ])))
  )
)
assert.deepEqual(
  sortByDate([
    { date: 10 },
    { date: 5 },
    { date: 7 },
  ]),
  [
    { date: 5 },
    { date: 7 },
    { date: 10 },
  ]
)

const parseDigit = R.curry(parseInt)(R.__, 10)
assert.equal(parseDigit('12'), 12)

const normalize = R.applySpec({
  who: R.ifElse(
    R.compose(R.equals(2), parseDigit, R.path([ 'type' ])),
    R.always('ME'),
    R.path([ 'address' ])
  ),
  content: R.path([ 'body' ]),
  date: R.path([ 'date' ])
})
assert.deepEqual(
  normalize({
    type: 2,
    body: 'foo',
    date: 0
  }),
  {
    who: 'ME',
    content: 'foo',
    date: 0
  }
)
assert.deepEqual(
  normalize({
    type: 999,
    address: 'bar',
    body: 'foo',
    date: 0
  }),
  {
    who: 'bar',
    content: 'foo',
    date: 0
  }
)

const addSentiment = R.converge(
  R.set(R.lensProp('sentiment')),
  [
    R.compose(
      sentiment,
      R.path([ 'content' ])
    ),
    R.identity
  ]
)
assert(
  R.where({
    sentiment: R.where({
      score: R.is(Number),
      comparative: R.is(Number),
      tokens: R.isArrayLike,
    })
  })(addSentiment({
    content: 'This text has some bad words and some good ones'
  }))
)

const replace = R.invoker(2, 'replace')
assert.equal(replace(',', ' ')('a,b'), 'a b')
assert.equal(replace(',')(' ')('a,b'), 'a b')

const join = R.invoker(1, 'join')
assert.equal(join(',')([ 'foo', 'bar' ]), 'foo,bar')

const toFormattedLocaleString = R.compose(
  replace(',', ' '),
  R.invoker(0, 'toLocaleString'),
  R.constructN(1, Date),
  R.converge(parseInt, [ R.path([ 'date' ]), R.always(10) ])
)

const removeCommaNewLine = R.compose(
  replace(/(\r|\n)/g, ' '),
  replace(',', ';')
)

const formatOutput = R.compose(
  join(','),
  R.juxt([
    toFormattedLocaleString,
    R.path([ 'who' ]),
    R.compose(
      removeCommaNewLine,
      R.path([ 'content' ])
    ),
    R.path([ 'sentiment', 'score' ])
  ])
)
const now = Date.now()
assert.deepEqual(
  formatOutput({
    date: now,
    who: 'ME',
    content: 'foo,bar\nbaz',
    sentiment: { score: 5 }
  }),
  join(',')([ toFormattedLocaleString({ date: now }), 'ME', 'foo;bar baz', 5 ])
)

const getAddresses = R.compose(
  R.uniq,
  R.map(R.path([ 'address' ]))
)
assert.deepEqual(
  getAddresses([
    { address: 'foo' },
    { address: 'bar' },
    { address: 'foo' },
  ]),
  [ 'foo', 'bar' ]
)

const joinLines = R.unapply(join('\n'))
assert.equal(joinLines('foo', 'bar'), 'foo\nbar')

const argv = yargs
  .options({
    input: {
      alias: 'i',
      type: 'string',
      describe: 'The signal message XML backup',
      demandOption: true
    },
    number: {
      alias: 'n',
      type: 'string',
      describe: 'The phone number to analyse'
    }
  })
  .help()
  .usage(joinLines(
    `$0 -i path/to/input [-n '+448675309']`,
    `Perform sentiment analysis on exported Signal messages`,
    `The output is written as CSV to stdout`
  ))
  .argv

fs.readFileAsync(argv.input, 'utf8')
  .then(xml.parseStringAsync)
  .then(R.pipe(
    pickMessages,
    R.tap(messages => {
      if (!argv.number) {
        console.log('Available phone numbers:')
        console.log(getAddresses(messages))
        console.log('Re-run with --number to analyse messages')
        return process.exit(0)
      }
    }),
    getNumberFilter(argv.number),
    sortByDate,
    R.map(normalize),
    R.map(addSentiment),
    R.map(formatOutput),
    outputLines => {
      console.log('Date,Who,Message,Sentiment')
      console.log(outputLines.join('\n'))
      return process.exit(0)
    }
  ))

  .catch(err => console.log('error', err) || process.exit(1))
