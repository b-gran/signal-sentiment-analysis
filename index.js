const R = require('ramda')
const fs = require('fs')
const yargs = require('yargs')
const Sentiment = require('sentiment')

const sentiment = new Sentiment({})

const TOKEN_NEW_MESSAGE = 'NEW_MESSAGE'
const TOKEN_MESSAGE_LINE = 'MESSAGE_LINE'

// Detect the start of messages.
const re_chatMessage = /^(\d{2}\/\d{2}\/\d{4}), (\d{2}:\d{2}) - (.+): (.*)$/
const re_systemMessage = /^(\d{2}\/\d{2}\/\d{4}), (\d{2}:\d{2}) - (.*)$/

// Pick out the date and time from the message start lines.
const re_date = /^(\d{2})\/(\d{2})\/(\d{4})$/
const re_time = /^(\d{2}):(\d{2})$/

const argv = yargs
  .command('$0 <input>', 'perform sentiment analysis on WhatsApp chats')
  .parse()

const { input } = argv

readFile(input)
  .then(lines => {
    const rawMessages = normalize(lines)
    const messagesWithSentiment = addSentiment(rawMessages)
    console.log(messagesWithSentiment)
  })

  .catch(err => {
    console.error('Encountered a fatal error')
    console.log(err)
  })

// Add sentiment to normalized messages of the form returned by normalize()
function addSentiment (messages) {
  return messages.map(message => ({
    timestamp: message.timestamp,
    who: message.who,
    text: message.text,
    sentiment: sentiment.analyze(message.text)
  }))
}

/*
 * Given the lines of a WhatsApp backup, returns the messages in normalized format.
 * {
 *    timestamp: Date,
 *    who: string,
 *    text: string,
 * }
 */
function normalize (whatsappBackupRawText) {
  const lines = whatsappBackupRawText.split(/[\r\n]/g)
  const tokens = tokenize(lines)
  return regenerateMessages(tokens)
}

// Turn the lines of a backup into tokenized messages
function tokenize (whatsappBackupLines) {
  const tokens = []
  let lineIndex = 0

  while (lineIndex < whatsappBackupLines.length) {
    const line = whatsappBackupLines[lineIndex]
    lineIndex += 1

    // Detect start of new messages
    const newMessageMatch = re_chatMessage.exec(line)
    if (newMessageMatch) {
      const [ , date, time, who, messageLine ] = newMessageMatch
      tokens.push({
        type: TOKEN_NEW_MESSAGE,
        date,
        time,
        who,
      })
      tokens.push({
        type: TOKEN_MESSAGE_LINE,
        line: messageLine,
      })
      continue
    }

    // Skip system messages
    if (re_systemMessage.test(line)) {
      continue
    }

    // Anything else is a new line of an existing message
    tokens.push({
      type: TOKEN_MESSAGE_LINE,
      line: line,
    })
  }

  return tokens
}

// Turns tokens back into messages with the sender, time sent, and message text
function regenerateMessages (messageTokens) {
  let i = 0
  const messages = []

  while (i < messageTokens.length) {
    const token = messageTokens[i]

    if (token.type === TOKEN_MESSAGE_LINE) {
      const err = 'Invalid message tokens: message lines must not precede message start tokens'
      console.error(err)
      throw new Error(err)
    }

    if (token.type !== TOKEN_NEW_MESSAGE) {
      const err = `Token type (${token.type}) not recognized`
      console.error(err)
      throw new Error(err)
    }

    // The token is the start of a new message

    i += 1

    const message = {
      // date: token.date,
      // time: token.time,
      timestamp: getMessageTimestamp(token.date, token.time),
      who: token.who,
    }

    // Parse all message lines until we hit another message
    let messageText = []
    let lineToken
    while (i < messageTokens.length && (lineToken = messageTokens[i]).type === TOKEN_MESSAGE_LINE) {
      messageText.push(lineToken.line)
      i += 1
    }
    message.text = messageText.join('\n')

    messages.push(message)
  }

  return messages
}

function getMessageTimestamp (messageDate, messageTime) {
  const dateMatch = re_date.exec(messageDate)
  if (!dateMatch) {
    return panic(`Invalid message date: ${messageDate}`)
  }

  const timeMatch = re_time.exec(messageTime)
  if (!timeMatch) {
    return panic(`Invalid message time: ${messageTime}`)
  }

  const [ , day, month, year ] = dateMatch
  const [ , hour, minute ] = timeMatch

  return new Date(Date.UTC(year, month - 1, day, hour, minute))
}

// Promisified fs.readFile()
function readFile (whatsappBackupName) {
  return new Promise((resolve, reject) => {
    fs.readFile(whatsappBackupName, (err, contents) => {
      return err
        ? reject(err)
        : resolve(contents.toString())
    })
  })
}

function panic (message) {
  console.error(message)
  throw new Error(message)
}
