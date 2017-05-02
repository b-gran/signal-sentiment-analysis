# `signal-sentiment-analysis`

Runs sentiment analysis on exported Signal messages located on the file system.
The export format should be the default XML "plaintext backup."

This project was created partially to experiment with the Ramda library and point-free
style, so some functions are more verbose than they otherwise could be.

> BE CAREFUL WITH YOUR PLAINTEXT BACKUPS!


# Installation and Usage

`signal-sentiment-analysis` is a command line utility that has dependencies on `npm`.

__Installation__
```
git clone https://github.com/b-gran/signal-sentiment-analysis
cd signal-sentiment-analysis
npm i
```

__Usage__

```
# Generate a CSV analysis file for your messages with someone
# The analysis is written to stdout
node main.js --number 'phone number to analyse' --input backup.xml > analysis.csv

# Print out the possible phone numbers to analyse
node main.js --input backup.xml

# Get more info about the CLI options
node main.js --help
```
